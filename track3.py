"""Track rod and fly line, version 3.

v2 found the rod correctly in any single frame but was not stable across
frames: a Hough transform has no memory, so it would swap between the rod, a
bit of line, and background clutter, producing an angle trace made of steps.

v3 replaces Hough with a radial scan anchored on the caster, plus a temporal
prior:

  * The shirt centroid is the pivot. From it, cast rays every 0.5 degrees and
    count how much green-and-moving mask each ray passes through between 40 and
    340 px. The rod is the best-scoring ray.
  * Candidate angles are weighted toward the previous frame's angle, so the
    tracker cannot teleport between frames.
  * The rod tip is the furthest point along that ray still supported by mask,
    allowing small gaps for the guides and motion blur.
  * The fly line is then the mask beyond the tip, walked outward by geodesic
    distance so it comes out as an ordered polyline rather than a blob.
"""
import cv2, numpy as np, json, sys

SRC = ('/mnt/user-data/uploads/YTDown.com_YouTube_How-to-Fly-Cast-Slow-Motion'
       '-Hi-Vis-Fly-C_Media_hxMSwFg1cn0_001_1080p')
RMIN, RMAX = 40, 340


def shirt(bgr):
    b = bgr[:, :, 0].astype(np.int16); g = bgr[:, :, 1].astype(np.int16); r = bgr[:, :, 2].astype(np.int16)
    m = (((b + r) - 2 * g > 60) & (b > 60) & (r > 40)).astype(np.uint8)
    m[:400, :] = 0; m[1000:, :] = 0
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, st, ce = cv2.connectedComponentsWithStats(m, 8)
    if n < 2: return None
    i = 1 + int(np.argmax(st[1:, 4]))
    return (float(ce[i][0]), float(ce[i][1])) if st[i, 4] > 200 else None


def green(bgr):
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    H = hsv[:, :, 0].astype(np.int16); S = hsv[:, :, 1].astype(np.int16); V = hsv[:, :, 2].astype(np.int16)
    return ((H >= 38) & (H <= 92) & (S >= 95) & (V >= 55)).astype(np.uint8)


def build_bg(step=13, n=70):
    cap = cv2.VideoCapture(SRC); fr = []; i = 0
    while len(fr) < n:
        ok, f = cap.read()
        if not ok: break
        if i % step == 0: fr.append(f)
        i += 1
    cap.release()
    return np.median(np.stack(fr), axis=0).astype(np.uint8)


def mask_of(f, bg):
    d = cv2.absdiff(f, bg).max(axis=2)
    m = ((d > 26).astype(np.uint8) & green(f))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    m[985:, :] = 0
    return m


def scan_rod(m, px, py, prev):
    H, W = m.shape
    best, bestsc = None, -1e9
    for a10 in range(0, 3600, 5):
        a = np.radians(a10 / 10.0)
        ca, sa = np.cos(a), np.sin(a)
        hits = 0; last = 0; gap = 0
        for r in range(RMIN, RMAX, 3):
            x = int(px + ca * r); y = int(py - sa * r)
            if not (0 <= x < W and 0 <= y < H): break
            if m[y, x]:
                hits += 1; last = r; gap = 0
            else:
                gap += 3
                if gap > 55: break
        sc = hits * 3.0 + last * 0.25
        if prev is not None:
            dd = abs((np.degrees(a) - prev + 180) % 360 - 180)
            sc -= dd * 1.6
        if sc > bestsc: bestsc, best = sc, (np.degrees(a), last)
    return best


def walk_line(m, sx, sy, maxd=1500, step=18):
    """Ordered polyline of the fly line, outward from the rod tip."""
    H, W = m.shape
    sx, sy = int(sx), int(sy)
    found = None
    for rr in range(0, 26, 2):
        for dy in range(-rr, rr + 1):
            for dx in (-rr, rr) if rr else (0,):
                y, x = sy + dy, sx + dx
                if 0 <= y < H and 0 <= x < W and m[y, x]: found = (y, x); break
            if found: break
        if found: break
    if not found: return []
    dist = np.full((H, W), -1, np.int32)
    dist[found] = 0
    cur = [found]; d = 0; buckets = {}
    while cur and d < maxd:
        d += 1; nxt = []
        for y, x in cur:
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < H and 0 <= nx < W and m[ny, nx] and dist[ny, nx] < 0:
                        dist[ny, nx] = d; nxt.append((ny, nx))
        if nxt and d % step == 0:
            ys = [p[0] for p in nxt]; xs = [p[1] for p in nxt]
            buckets[d] = (float(np.mean(xs)), float(np.mean(ys)))
        cur = nxt
    return [buckets[k] for k in sorted(buckets)]


def run(start, stop, out_json):
    bg = build_bg()
    cap = cv2.VideoCapture(SRC)
    fps = cap.get(cv2.CAP_PROP_FPS)
    recs = []; prev = None; i = -1
    while True:
        ok, f = cap.read()
        if not ok: break
        i += 1
        if i < start: continue
        if i >= stop: break
        s = shirt(f)
        if s is None:
            recs.append(None); continue
        m = mask_of(f, bg)
        r = scan_rod(m, s[0], s[1], prev)
        if r is None or r[1] < 90:
            recs.append(None); continue
        ang, rlen = r
        prev = ang
        a = np.radians(ang)
        tx = s[0] + np.cos(a) * rlen; ty = s[1] - np.sin(a) * rlen
        line = walk_line(m, tx, ty)
        recs.append({'f': i, 't': round(i / fps, 4), 'hx': s[0], 'hy': s[1],
                     'ang': round(ang, 2), 'rlen': rlen,
                     'tx': round(tx, 1), 'ty': round(ty, 1),
                     'line': [[round(p[0], 1), round(p[1], 1)] for p in line]})
    cap.release()
    json.dump(recs, open(out_json, 'w'))
    got = sum(1 for r in recs if r)
    print(f'frames {len(recs)}  tracked {got}  fps {fps:.3f}')
    return recs


if __name__ == '__main__':
    run(int(sys.argv[1]), int(sys.argv[2]), sys.argv[3])
