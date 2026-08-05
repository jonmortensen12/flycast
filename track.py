"""Track the fly rod through the video.

The video has a hi-vis colour treatment applied, which is a gift: rod and fly
line both sit in a narrow green band that almost nothing else in the scene
occupies except the grass strip along the bottom.

Method per frame:
  1. HSV threshold to a green mask.
  2. Drop the grass band and keep the connected component that contains the rod.
  3. Find the butt as the lowest point of that component near the caster.
  4. Walk a geodesic distance transform out from the butt. The rod is the first
     2.74 m of that chain; everything past it is fly line. So the rod tip is
     simply the mask point whose geodesic distance from the butt equals the rod
     length in pixels.

Scale comes from the caster's height, checked against the rod's own length.
"""
import cv2, numpy as np, json, sys

SRC = '/mnt/user-data/uploads/YTDown.com_YouTube_How-to-Fly-Cast-Slow-Motion-Hi-Vis-Fly-C_Media_hxMSwFg1cn0_001_1080p'
GRASS_Y = 900          # below this is the bank, which is also green
TOP_Y = 150


def green_mask(bgr):
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    H = hsv[:, :, 0].astype(np.int16)
    S = hsv[:, :, 1].astype(np.int16)
    V = hsv[:, :, 2].astype(np.int16)
    m = ((H >= 32) & (H <= 92) & (S >= 90) & (V >= 70)).astype(np.uint8)
    m[GRASS_Y:, :] = 0
    m[:TOP_Y, :] = 0
    return m


def rod_component(mask, hint_x):
    """Connected component most likely to hold the rod: tall, near the caster."""
    n, lab, stats, cent = cv2.connectedComponentsWithStats(mask, 8)
    best, bestscore = -1, -1e9
    for i in range(1, n):
        x, y, w, h, a = stats[i]
        if a < 150 or h < 120:
            continue
        # prefer components whose lowest point is deep (the hand) and near hint_x
        low = y + h
        score = low - 0.6 * abs(cent[i][0] - hint_x)
        if score > bestscore:
            bestscore, best = score, i
    if best < 0:
        return None
    return (lab == best).astype(np.uint8)


def geodesic(mask, seed, maxd):
    """BFS distance within the mask from seed, capped at maxd (in px)."""
    h, w = mask.shape
    dist = np.full((h, w), -1, np.int32)
    sy, sx = seed
    if mask[sy, sx] == 0:
        return None
    dist[sy, sx] = 0
    cur = [(sy, sx)]
    d = 0
    while cur and d < maxd:
        nxt = []
        d += 1
        for y, x in cur:
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and dist[ny, nx] < 0:
                        dist[ny, nx] = d
                        nxt.append((ny, nx))
        cur = nxt
    return dist


def track(start=0, stop=None, every=1, hint_x=1000, dump=None):
    cap = cv2.VideoCapture(SRC)
    fps = cap.get(cv2.CAP_PROP_FPS)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    stop = stop or total
    out = []
    prev_hint = hint_x
    i = -1
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        i += 1
        if i < start:
            continue
        if i >= stop:
            break
        if (i - start) % every:
            continue
        m = green_mask(frame)
        comp = rod_component(m, prev_hint)
        if comp is None:
            out.append(None)
            continue
        ys, xs = np.where(comp > 0)
        # butt = lowest point of the component
        k = np.argmax(ys)
        by, bx = int(ys[k]), int(xs[k])
        prev_hint = bx
        d = geodesic(comp, (by, bx), 700)
        rec = {'f': i, 't': round(i / fps, 4), 'bx': bx, 'by': by}
        if d is not None:
            for name, px in (('tip', 285),):
                band = (d >= px - 6) & (d <= px + 6)
                if band.sum() > 0:
                    yy, xx = np.where(band)
                    rec[name + 'x'] = float(xx.mean())
                    rec[name + 'y'] = float(yy.mean())
            rec['maxd'] = int(d.max())
        out.append(rec)
        if dump and i in dump:
            v = cv2.cvtColor(comp * 255, cv2.COLOR_GRAY2BGR)
            cv2.circle(v, (bx, by), 9, (0, 0, 255), -1)
            if 'tipx' in rec:
                cv2.circle(v, (int(rec['tipx']), int(rec['tipy'])), 9, (255, 0, 0), -1)
            cv2.imwrite(f'/tmp/dbg{i}.png', cv2.resize(v, (960, 540)))
    cap.release()
    return out, fps


if __name__ == '__main__':
    a = [int(x) for x in sys.argv[1:4]] if len(sys.argv) > 3 else [560, 700, 1]
    res, fps = track(a[0], a[1], a[2], dump={a[0] + 5, a[0] + 30, a[0] + 60})
    print('fps', fps, 'tracked', sum(1 for r in res if r))
    for r in res[:14]:
        print(r)
    json.dump(res, open('track.json', 'w'))
