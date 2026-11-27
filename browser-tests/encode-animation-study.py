"""Encode browser-rendered frames, without reinterpreting the source SVG geometry."""
import json
import sys
import math
import os
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

root = Path(sys.argv[1])
manifest = json.loads((root / 'manifest.json').read_text())
frame_root = Path(os.environ.get('INSCAPE_ANIMATION_FRAMES', str(root/'frames')))
frames = [Image.open(p).convert('RGBA') for p in sorted(frame_root.glob('*.png'))]
times = manifest['frameTimes'] + [manifest['loopMs']]
durations = [b-a for a, b in zip(times, times[1:])]
lossless = os.environ.get('INSCAPE_WEBP_LOSSLESS') == '1'
frames[0].save(root / 'poster.webp', lossless=True, exact=True)
frames[0].save(root / 'loop.webp', save_all=True, append_images=frames[1:], duration=durations,
               loop=0, lossless=lossless, quality=80 if lossless else 90, alpha_quality=100, exact=True, method=4)
decoded = Image.open(root / 'loop.webp')
assert decoded.n_frames == len(frames)
differences = []
errors = []
for i, original in enumerate(frames):
    decoded.seek(i)
    actual = decoded.convert('RGBA')
    # Transparent RGB is not visible. Compare both alpha and premultiplied colour.
    alpha_ok = ImageChops.difference(original.getchannel('A'), actual.getchannel('A')).getbbox() is None
    difference = ImageChops.difference(original.convert('RGBa'), actual.convert('RGBa'))
    errors.append(sum(v*v for v in ImageStat.Stat(difference).rms[:3])/3)
    if not alpha_ok:
        differences.append(i)
assert not differences, differences
mean_squared_error = sum(errors)/len(errors)
if lossless:
    assert mean_squared_error == 0, 'Lossless visible pixels changed'
frame_mib = manifest['width']*manifest['height']*4/1024**2
manifest.update(encodedBytes=(root/'loop.webp').stat().st_size, decodedFrames=len(frames),
                encoding='lossless WebP' if lossless else 'WebP quality 90, lossless alpha',
                alphaExact=True, premultipliedRgbPsnr=10*math.log10(255**2/mean_squared_error) if mean_squared_error else None,
                fullFrameRgbaMiB=frame_mib, allFramesRgbaMiB=frame_mib*len(frames))
(root/'manifest.json').write_text(json.dumps(manifest, indent=2))
print(json.dumps({k: v for k, v in manifest.items() if k != 'frameTimes'}))
