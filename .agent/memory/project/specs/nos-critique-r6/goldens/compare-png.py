"""Compare two header screenshots with a tolerance (f9). Usage: compare-png.py BASE.png DEV.png
Why a tolerance: BASE renders the NOS header 46.14px down, under the utility bar, so its box sits on a fractional pixel row; f9 removes the bar and the header sits at y=0.
That alone shifts anti-aliasing and image resampling (measured BASE vs head: mean per-pixel diff 0.2 to 1.5, at most 0.14 percent of pixels above 96 of 255).
A real regression is far larger: a 1px move measures mean 4.5 to 5.0 and 1.1 to 1.7 percent above 96; a 2px move 7.7+ and 3.4+ percent.
Limits: mean <= 2.5 and share of pixels above 96 <= 0.5 percent. Prints the metrics, exits 1 when either is exceeded or the sizes differ."""
import sys
import numpy as np
from PIL import Image

MEAN_LIMIT = 2.5
BIG_SHARE_LIMIT = 0.5
BIG = 96

a = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(int)
b = np.asarray(Image.open(sys.argv[2]).convert('RGB')).astype(int)
if a.shape != b.shape:
    print(f'size differs: {a.shape[1]}x{a.shape[0]} vs {b.shape[1]}x{b.shape[0]}')
    sys.exit(1)
d = np.abs(a - b).max(axis=2)
mean = float(d.mean())
share = float((d > BIG).mean() * 100)
print(f'mean {mean:.3f} (limit {MEAN_LIMIT}), pixels above {BIG}: {share:.3f}% (limit {BIG_SHARE_LIMIT}%)')
sys.exit(1 if mean > MEAN_LIMIT or share > BIG_SHARE_LIMIT else 0)
