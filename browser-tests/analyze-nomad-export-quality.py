import json
from pathlib import Path
import numpy as np
from PIL import Image

folder = Path('.browser-test-runtime/nomad-export-study/quality')
results = []
for pixels, dpr in [(120, 1), (800, 1), (320, 2)]:
    original = np.asarray(Image.open(folder / f'full-{pixels}-{dpr}-pose.png').convert('RGB')).astype(float)
    background = original[0, 0]
    mask = np.max(np.abs(original-background), axis=2) > 8
    for variant in ['half', 'quarter', 'vector']:
        other = np.asarray(Image.open(folder / f'{variant}-{pixels}-{dpr}-pose.png').convert('RGB')).astype(float)
        diff = np.abs(original-other)
        results.append({'variant': variant, 'pixels': pixels, 'dpr': dpr,
                        'meanChannelDeltaWholeImage': float(diff.mean()),
                        'meanChannelDeltaReferenceArtwork': float(diff[mask].mean()),
                        'referenceArtworkFractionChannelsOver16': float((diff[mask] > 16).mean())})
frames = Path('.browser-test-runtime/nomad-export-study/loop')
first = np.asarray(Image.open(frames/'frames30/0000.png')).astype(int)
seam = np.asarray(Image.open(frames/'seam.png')).astype(int)
data = {'samePoseComparisons': results,
        'loopSeamAt0And8Seconds': {'maxChannelDelta': int(np.abs(first-seam).max()), 'meanChannelDelta': float(np.abs(first-seam).mean())},
        'note': 'Raster downsampling and vector antialias/warp differences are mixed in these metrics; inspect images. Loop has a different baked pose and is not pixel-compared to the reactive versions.'}
(folder/'pixel-comparisons.json').write_text(json.dumps(data, indent=2))
print(json.dumps(data, indent=2))
