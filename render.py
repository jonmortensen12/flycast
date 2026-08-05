"""Render frames.json to a four-view MP4. Stick-figure geometry only — rod, line,
fly, water surface. No textures, no shading; the point is to read the shape."""
import json, math, os, shutil, subprocess
from PIL import Image, ImageDraw, ImageFont

W, H = 1280, 720
TOPBAR, BOTBAR = 32, 28
PW, PH = W // 2, (H - TOPBAR - BOTBAR) // 2
BG = (16, 26, 30)
GRID = (32, 48, 54)
WATER = (46, 92, 96)
ROD = (181, 113, 63)
LINE = (232, 227, 212)
FLY = (255, 90, 43)
TXT = (168, 181, 179)
HI = (224, 164, 94)

F = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
FB = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'
f10 = ImageFont.truetype(F, 13)
f12 = ImageFont.truetype(FB, 16)
f20 = ImageFont.truetype(FB, 22)

clips = json.load(open('frames.json'))

# ── projections: (x,y,z) world -> (u,v) panel, v up ────────────────────────
COS, SIN = math.cos(math.radians(38)), math.sin(math.radians(38))
VIEWS = [
    ('SIDE  (casting plane)', lambda x, y, z: (-z, y)),
    ('FRONT (down the cast)', lambda x, y, z: (x, y)),
    ('TOP   (looking down)',  lambda x, y, z: (-z, x)),
    ('ANGLED',                lambda x, y, z: (-z * COS + x * SIN,
                                               y * 0.86 - (z * SIN + x * COS) * 0.30)),
]


def bounds(clip, proj):
    lo_u = lo_v = 1e9
    hi_u = hi_v = -1e9
    for fr in clip['frames']:
        for arr in (fr['rod'], fr['line']):
            for i in range(0, len(arr), 3):
                u, v = proj(arr[i], arr[i + 1], arr[i + 2])
                lo_u = min(lo_u, u); hi_u = max(hi_u, u)
                lo_v = min(lo_v, v); hi_v = max(hi_v, v)
    pad_u = (hi_u - lo_u) * 0.08 + 0.4
    pad_v = (hi_v - lo_v) * 0.10 + 0.4
    return lo_u - pad_u, hi_u + pad_u, lo_v - pad_v, hi_v + pad_v


def make_mapper(bb, ox, oy):
    lo_u, hi_u, lo_v, hi_v = bb
    su = (PW - 70) / max(hi_u - lo_u, 1e-6)
    sv = (PH - 60) / max(hi_v - lo_v, 1e-6)
    s = min(su, sv)                       # isotropic, so shapes are not skewed
    cu = ox + PW / 2 - s * (lo_u + hi_u) / 2
    cv = oy + PH / 2 + s * (lo_v + hi_v) / 2
    return lambda u, v: (cu + s * u, cv - s * v), s


def draw_panel(d, clip, fr, vi, ox, oy, bb):
    name, proj = VIEWS[vi]
    m, s = make_mapper(bb, ox, oy)
    d.rectangle([ox, oy, ox + PW - 2, oy + PH - 2], outline=GRID)

    # 1 m grid
    lo_u, hi_u, lo_v, hi_v = bb
    for g in range(int(math.floor(lo_u)), int(math.ceil(hi_u)) + 1, 2):
        p0, p1 = m(g, lo_v), m(g, hi_v)
        d.line([p0, p1], fill=GRID)
    for g in range(int(math.floor(lo_v)), int(math.ceil(hi_v)) + 1, 2):
        p0, p1 = m(lo_u, g), m(hi_u, g)
        d.line([p0, p1], fill=GRID)

    # water surface (y = 0) — meaningless in the top view
    if vi != 2:
        p0, p1 = m(lo_u, 0), m(hi_u, 0)
        d.line([p0, p1], fill=WATER, width=2)

    def pts(arr):
        return [m(*proj(arr[i], arr[i + 1], arr[i + 2])) for i in range(0, len(arr), 3)]

    lp = pts(fr['line'])
    d.line(lp, fill=LINE, width=2)
    rp = pts(fr['rod'])
    d.line(rp, fill=ROD, width=5)
    fx, fy = lp[0]
    d.ellipse([fx - 5, fy - 5, fx + 5, fy + 5], fill=FLY)
    hx, hy = rp[0]
    d.ellipse([hx - 6, hy - 6, hx + 6, hy + 6], outline=HI, width=2)

    d.text((ox + 12, oy + 8), name, font=f12, fill=HI)
    d.text((ox + PW - 96, oy + PH - 24), f'{2/s*10:.0f} px/m'.replace('px/m', 'px = 1m'),
           font=f10, fill=GRID)


def render_clip(clip, outdir, start):
    bbs = [bounds(clip, VIEWS[i][1]) for i in range(4)]
    n = len(clip['frames'])
    for k, fr in enumerate(clip['frames']):
        img = Image.new('RGB', (W, H), BG)
        d = ImageDraw.Draw(img)
        for vi, (ox, oy) in enumerate([(0, TOPBAR), (PW, TOPBAR), (0, TOPBAR + PH), (PW, TOPBAR + PH)]):
            draw_panel(d, clip, fr, vi, ox, oy, bbs[vi])
        # banner
        d.rectangle([0, 0, W, TOPBAR], fill=(10, 18, 22))
        d.text((12, 4), clip['name'], font=f20, fill=HI)
        d.text((W - 620, 9), clip['note'][:88], font=f10, fill=TXT)
        # readout strip
        d.rectangle([0, H - BOTBAR, W, H], fill=(10, 18, 22))
        stretch = fr['stretch']
        col = FLY if stretch > 1.03 else TXT
        om = fr.get('omega', 0); df = fr.get('defl', 0)
        d.text((12, H - 21), f"t {fr['t']:5.2f}s  {fr['phase']:<8} "
                             f"rod {fr['pitch']:>4}deg  butt {om:>4}deg/s  "
                             f"defl {df:>3}cm  bend {fr['bend']:>5.1f}deg  "
                             f"tip {fr['tipSp']:>5.2f}m/s  out {fr['lineOut']:>5.2f}m",
               font=f10, fill=TXT)
        d.text((W - 300, H - 21), f"line length / material  {stretch:.3f}", font=f10, fill=col)
        img.save(f'{outdir}/f{start + k:05d}.png')
    return n


os.makedirs('png', exist_ok=True)
shutil.rmtree('png'); os.makedirs('png')
idx = 0
for c in clips:
    idx += render_clip(c, 'png', idx)
    print(f'{c["name"]}: rendered')

fps = clips[0]['fps']
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(fps),
                '-i', 'png/f%05d.png', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                '-crf', '23', '-movflags', '+faststart', 'flycast-sim.mp4'], check=True)
print('flycast-sim.mp4 written —', idx, 'frames at', fps, 'fps')
