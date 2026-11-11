"""Offline artwork conversion. Originals and all world-space layer bounds stay intact."""
import base64, copy, hashlib, io, json, math, re
from pathlib import Path
import xml.etree.ElementTree as ET
import cv2
import numpy as np
from PIL import Image, ImageChops
from fontTools.svgLib.path import parse_path
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.misc.transform import Transform

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / '../../nomad-webp-svg'
OUT = ROOT / 'output/nomad-export-study-2026-10-21'
OUT.mkdir(parents=True, exist_ok=True)
text = (SOURCE / 'NOMAD-animated.svg').read_text(encoding='utf-8')
prepared = json.loads((SOURCE / 'nomad-prepared-parts.json').read_text())
assert len(prepared['layers']) == 39
report = {'sourceSha256': hashlib.sha256(text.encode()).hexdigest(), 'raster': [], 'vector': {}}
image_pattern = r'(<image\b[^>]*\bhref=")data:image/webp;base64,([^"]+)("[^>]*>)'
assert len(re.findall(image_pattern, text)) == 39
for name, scale in [('half', .5), ('quarter', .25)]:
    records = []
    def resize(match):
        image = Image.open(io.BytesIO(base64.b64decode(match[2]))).convert('RGBA')
        size = tuple(max(1, math.ceil(v * scale)) for v in image.size)
        # Filter premultiplied colour to avoid dark fringes at transparent edges.
        small = image.convert('RGBa').resize(size, Image.Resampling.LANCZOS).convert('RGBA')
        out = io.BytesIO(); small.save(out, format='WEBP', lossless=True, exact=True, method=6)
        decoded = Image.open(io.BytesIO(out.getvalue())).convert('RGBA')
        assert ImageChops.difference(small, decoded).getbbox(alpha_only=False) is None
        records.append({'from': image.size, 'to': size})
        return match[1] + 'data:image/webp;base64,' + base64.b64encode(out.getvalue()).decode() + match[3]
    result = re.sub(image_pattern, resize, text)
    ET.fromstring(result)
    (OUT / f'raw-{name}.svg').write_text(result, encoding='utf-8')
    report['raster'].append({'name': name, 'scale': scale, 'layers': records, 'bytes': len(result.encode()),
                             'pixels': sum(r['to'][0] * r['to'][1] for r in records), 'webpEncodingLossless': True})

source = ET.parse(SOURCE / 'source.svg').getroot()
def flatten(node, parent=Transform(), inherited=''):
    transform = parent
    if node.get('transform'):
        match = re.fullmatch(r'matrix\(([^)]+)\)', node.get('transform')); assert match
        transform = parent.transform(Transform(*map(float, re.split(r'[,\s]+', match[1].strip()))))
    style = inherited + ';' + node.get('style', '')
    if node.tag.endswith('path'):
        pen = RecordingPen(); parse_path(node.get('d'), TransformPen(pen, transform))
        parts = []
        for command, points in pen.value:
            letter = {'moveTo': 'M', 'lineTo': 'L', 'curveTo': 'C', 'closePath': 'Z', 'endPath': ''}[command]
            parts.append(letter + ' '.join(f'{x:.4f},{y:.4f}' for x, y in points))
        yield {'d': ''.join(parts), 'style': style}
    for child in node: yield from flatten(child, transform, style)

groups = {g.get('id'): list(flatten(g, inherited=source.get('style', ''))) for g in source}
layers = []
layers.append({'id': 'body-core', 'pass': 'core', 'paths': groups['silhouette-full'], 'clip': 'nomad-core-clip'})
for layer in prepared['layers']:
    if layer['pass'] != 'backing': continue
    image = Image.open(io.BytesIO(base64.b64decode(layer['png'].split(',')[1]))).convert('RGBA')
    alpha = np.array(image.getchannel('A'))
    contours, _ = cv2.findContours((alpha >= 128).astype('uint8'), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    b = layer['box']; paths = []
    for contour in contours:
        contour = cv2.approxPolyDP(contour, .6, True)
        if len(contour) < 3: continue
        points = [(b['x'] + (float(p[0][0]) + .5) / image.width * b['w'],
                   b['y'] + (float(p[0][1]) + .5) / image.height * b['h']) for p in contour]
        paths.append('M' + 'L'.join(f'{x:.4f},{y:.4f}' for x, y in points) + 'Z')
    layers.append({'id': layer['id'], 'pass': 'backing', 'paths': [{'d': ''.join(paths), 'style': 'fill:black;fill-rule:evenodd'}]})
for layer in prepared['layers']:
    if layer['pass'] == 'front': layers.append({'id': layer['id'], 'pass': 'front', 'paths': groups[layer['id']]})
assert len(layers) == 39
payload = {'layers': layers, 'coreClip': 'M 130 -60 H 2120 V 2030 H 130 V 1530 H 350 C 475 1420 535 1210 605 970 C 655 790 680 625 740 490 H 130 Z'}
(OUT / 'vector-layers.json').write_text(json.dumps(payload, separators=(',', ':')), encoding='utf-8')
report['vector'] = {'layers': len(layers), 'paths': sum(len(l['paths']) for l in layers),
    'originalFrontCurvesPreserved': True, 'backingMethod': 'Trace existing prepared alpha at 128/255; contour simplification <=0.6 source pixel. Must be visually compared.',
    'sourcePaths': len(source.findall('.//{http://www.w3.org/2000/svg}path'))}
(OUT / 'conversion.json').write_text(json.dumps(report, indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='raster'}))
for item in report['raster']:print(item['name'],item['pixels'],item['bytes'])
