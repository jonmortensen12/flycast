"""Track the fly rod. Version 2.

Version 1 failed in an instructive way: the hi-vis colour treatment turns a
mossy tree trunk almost exactly the same green as the rod, and the tracker
happily followed the tree for the whole clip. Colour alone cannot separate rod
from tree from grass — all three land in the same HSV band.

What does separate them is geometry and motion:
  * The caster's shirt is magenta, which nothing else in the scene is. That
    gives a reliable anchor for where the hand must be.
  * The rod is a long straight bright segment starting at the hand. The tree is
    straight but never moves; the grass is not straight.
  * Differencing against a running background kills every static green thing,
    tree trunk included.

So: locate the shirt, difference out the static scene, threshold green, then
Hough for the dominant straight segment whose nearer end sits at the hand.
"""
import cv2, numpy as np, json, sys

SRC = ('/mnt/user-data/uploads/YTDown.com_YouTube_How-to-Fly-Cast-Slow-Motion'
       '-Hi-Vis-Fly-C_Media_hxMSwFg1cn0_001_1080p')


def shirt_mask(bgr):
    """Magenta: blue and red high, green low."""
    b, g, r = bgr[:, :, 0].astype(np.int16), bgr[:, :, 1].astype(np.int16), bgr[:, :, 2].astype(np.int16)
    return (((b + r) - 2 * g > 60) & (b > 60) & (r > 40)).astype(np.uint8)


def find_caster(bgr):
    m = shirt_mask(bgr)
    m[:400, :] = 0
    m[1000:, :] = 0
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, stats, cent = cv2.connectedComponentsWithStats(m, 8)
    if n < 2:
        return None
    i = 1 + int(np.argmax(stats[1:, 4]))
    if stats[i, 4] < 200:
        return None
    return (float(cent[i][0]), float(cent[i][1]), int(stats[i, 4]))


def green(bgr):
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    H = hsv[:, :, 0].astype(np.int16)
    S = hsv[:, :, 1].astype(np.int16)
    V = hsv[:, :, 2].astype(np.int16)
    return ((H >= 40) & (H <= 90) & (S >= 100) & (V >= 60)).astype(np.uint8)


def build_background(step=15, n=60):
    """Median of sampled frames — everything static, including the tree."""
    cap = cv2.VideoCapture(SRC)
    frames, i = [], 0
    while len(frames) < n:
        ok, f = cap.read()
        if not ok:
            break
        if i % step == 0:
            frames.append(cv2.resize(f, (960, 540)))
        i += 1
    cap.release()
    return np.median(np.stack(frames), axis=0).astype(np.uint8)


def rod_from_frame(bgr, bg_small, cast):
    """Return (hand_xy, tip_xy, length_px, angle_deg) or None."""
    small = cv2.resize(bgr, (960, 540))
    d = cv2.absdiff(small, bg_small).max(axis=2)
    moving = (d > 28).astype(np.uint8)
    g = cv2.resize(green(bgr), (960, 540), interpolation=cv2.INTER_NEAREST)
    m = cv2.morphologyEx(moving & g, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    m[500:, :] = 0                                    # kill the bank
    cx, cy = cast[0] / 2.0, cast[1] / 2.0             # shirt centroid, half res
    Y, X = np.mgrid[0:540, 0:960]
    near = ((X - cx) ** 2 + (Y - cy) ** 2) < 210 ** 2
    m = (m & near.astype(np.uint8))
    if m.sum() < 60:
        return None
    lines = cv2.HoughLinesP(m * 255, 1, np.pi / 180, threshold=28,
                            minLineLength=45, maxLineGap=14)
    if lines is None:
        return None
    best, bestlen = None, 0
    for l in lines[:, 0]:
        x1, y1, x2, y2 = [float(v) for v in l]
        L = np.hypot(x2 - x1, y2 - y1)
        d1 = np.hypot(x1 - cx, y1 - cy)
        d2 = np.hypot(x2 - cx, y2 - cy)
        if min(d1, d2) > 95:                          # must start near the hand
            continue
        if L > bestlen:
            bestlen, best = L, (x1, y1, x2, y2, d1, d2)
    if best is None:
        return None
    x1, y1, x2, y2, d1, d2 = best
    if d2 < d1:
        x1, y1, x2, y2 = x2, y2, x1, y1
    ang = np.degrees(np.arctan2(-(y2 - y1), (x2 - x1)))
    return (x1 * 2, y1 * 2), (x2 * 2, y2 * 2), bestlen * 2, ang


def main(start, stop, dumps=()):
    bg = build_background()
    cap = cv2.VideoCapture(SRC)
    fps = cap.get(cv2.CAP_PROP_FPS)
    out = []
    i = -1
    while True:
        ok, f = cap.read()
        if not ok:
            break
        i += 1
        if i < start:
            continue
        if i >= stop:
            break
        c = find_caster(f)
        if c is None:
            out.append(None)
            continue
        r = rod_from_frame(f, bg, c)
        if r is None:
            out.append({'f': i, 't': round(i / fps, 4), 'cx': c[0], 'cy': c[1]})
            continue
        (hx, hy), (tx, ty), L, ang = r
        out.append({'f': i, 't': round(i / fps, 4), 'cx': c[0], 'cy': c[1],
                    'hx': hx, 'hy': hy, 'tx': tx, 'ty': ty,
                    'L': round(L, 1), 'ang': round(ang, 2)})
        if i in dumps:
            v = f.copy()
            cv2.circle(v, (int(c[0]), int(c[1])), 12, (0, 0, 255), 3)
            cv2.line(v, (int(hx), int(hy)), (int(tx), int(ty)), (0, 255, 255), 4)
            cv2.imwrite(f'/tmp/v2_{i}.png', cv2.resize(v, (960, 540)))
    cap.release()
    json.dump(out, open('track2.json', 'w'))
    got = sum(1 for r in out if r and 'ang' in r)
    print(f'fps {fps:.3f}  frames {len(out)}  rod found {got} ({100*got/max(len(out),1):.0f}%)')
    return out


if __name__ == '__main__':
    a, b = int(sys.argv[1]), int(sys.argv[2])
    res = main(a, b, dumps={a + 3, a + 25, a + 50})
    for r in res[:8]:
        print(r)
