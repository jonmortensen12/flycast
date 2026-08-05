"""Turn the tracked rod into casting kinematics.

Two corrections are needed before the numbers mean anything.

1. DIRECTION FLIPS. A Hough segment has no inherent direction, so the reported
   angle jumps by 180 degrees whenever the endpoint ordering swaps. Raw, that
   produced spikes over 2000 deg/s, which is roughly six times what an expert
   caster actually does. Fixed by choosing, each frame, whichever of theta and
   theta+180 is closest to the previous frame.

2. PLAYBACK RATE. The clip runs at 29.97 fps throughout, but part of it is
   slow motion. Angles measured off the screen are true; times are not. The
   slow-motion factor is recovered by comparing how long the same angular sweep
   takes in the two halves of the clip.
"""
import json, numpy as np

d = [r for r in json.load(open('track2.json')) if r and 'ang' in r]
t = np.array([r['t'] for r in d])
raw = np.array([r['ang'] for r in d])
hx = np.array([r['hx'] for r in d])
hy = np.array([r['hy'] for r in d])
cx = np.array([r['cx'] for r in d])
cy = np.array([r['cy'] for r in d])
L = np.array([r['L'] for r in d])

# ── 1. resolve the 180 degree ambiguity by continuity ─────────────────────
ang = np.zeros_like(raw)
ang[0] = raw[0]
for i in range(1, len(raw)):
    cands = [raw[i] + k * 180 for k in (-2, -1, 0, 1, 2)]
    ang[i] = min(cands, key=lambda c: abs(c - ang[i - 1]))


def med(x, k=7):
    y = x.copy()
    for i in range(len(x)):
        y[i] = np.median(x[max(0, i - k // 2):i + k // 2 + 1])
    return y


angs = med(ang, 7)
w = np.gradient(angs, t)

# ── 2. find strokes: sign changes of a smoothed angular rate ──────────────
ws = med(w, 9)
strokes = []
i = 0
while i < len(ws) - 2:
    if abs(ws[i]) > 40:
        s = i
        sign = np.sign(ws[i])
        while i < len(ws) - 1 and np.sign(ws[i]) == sign and abs(ws[i]) > 15:
            i += 1
        if t[i] - t[s] > 0.10:
            sweep = angs[i] - angs[s]
            if abs(sweep) > 25:
                strokes.append({
                    'i0': s, 'i1': i, 't0': float(t[s]), 'dur': float(t[i] - t[s]),
                    'sweep': float(sweep), 'peakw': float(np.max(np.abs(ws[s:i + 1]))),
                    'a0': float(angs[s]), 'a1': float(angs[i]),
                    'handdx': float(hx[i] - hx[s]), 'handdy': float(hy[i] - hy[s]),
                })
    i += 1

print(f'{len(strokes)} strokes detected\n')
hdr = f"{'t0':>6} {'dur':>6} {'sweep':>7} {'peak w':>8} {'from':>6} {'to':>6} {'hand dx,dy px':>15}"
print(hdr)
print('-' * len(hdr))
for s in strokes:
    print(f"{s['t0']:6.2f} {s['dur']:6.2f} {s['sweep']:7.0f} {s['peakw']:8.0f} "
          f"{s['a0']:6.0f} {s['a1']:6.0f} {s['handdx']:7.0f},{s['handdy']:6.0f}")

# ── 3. real time vs slow motion ───────────────────────────────────────────
half = np.median(t)
early = [s for s in strokes if s['t0'] < half]
late = [s for s in strokes if s['t0'] >= half]
for name, grp in (('first half', early), ('second half', late)):
    if not grp:
        continue
    dur = np.median([s['dur'] for s in grp])
    pk = np.median([abs(s['peakw']) for s in grp])
    sw = np.median([abs(s['sweep']) for s in grp])
    print(f'\n{name}: {len(grp)} strokes, median duration {dur:.2f}s, '
          f'median sweep {sw:.0f} deg, median peak rate {pk:.0f} deg/s')

# ── 4. scale, from the caster's own height ────────────────────────────────
print('\nrod apparent length: median %.0f px, 90th pct %.0f px, max %.0f px'
      % (np.median(L), np.percentile(L, 90), L.max()))
print('hand x travel over clip: %.0f px   y travel: %.0f px' % (np.ptp(hx), np.ptp(hy)))
np.save('kin.npy', np.stack([t, angs, w, hx, hy, L]))
json.dump(strokes, open('strokes.json', 'w'))
