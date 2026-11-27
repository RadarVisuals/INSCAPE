"""Prepare these two authored snake layouts as cropped, lossless WebP rigs.

Requires Inkscape and Pillow. Originals are read-only. Example:
  python scripts/convertKeeperSnake.py "D:/art/keeper-snake" --resolution 2048
"""
import argparse
import base64
import copy
import io
import json
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image

SVG = 'http://www.w3.org/2000/svg'
ET.register_namespace('', SVG)


def prepare(source, variant):
    original = ET.parse(source).getroot()
    if original.get('viewBox') != '0 0 2000 2000':
        raise ValueError('Expected the supplied 2000 × 2000 snake artwork.')
    root = ET.Element(f'{{{SVG}}}svg', dict(original.attrib))
    children = {node.get('id'): node for node in original}
    head_id = 'head-complete17' if variant == 'big' else 'head-complete'
    # Keep the source stacking order. Small ribs have separate fill and ink
    # groups; pair those before rasterizing so their linework moves with them.
    if variant == 'big':
        ids = ['body-part'] + [f'body-part{i}' for i in range(1, 18)]
        segments = [[children[id]] for id in ids]
    else:
        skeleton = children['skeleton-complete']
        pieces = list(skeleton)
        if len(pieces) != 76:
            raise ValueError('Expected 38 paired fill/linework ribs.')
        segments = []
        for a, b in [(i, i + 37) for i in range(2, 39)] + [(0, 1)]:
            wrapper = ET.Element(f'{{{SVG}}}g', {'transform': skeleton.get('transform')})
            wrapper.extend([copy.deepcopy(pieces[a]), copy.deepcopy(pieces[b])])
            segments.append([wrapper])
    ids = []
    for id, content in [(f'segment-{i+1}', part) for i, part in enumerate(segments)] + [
        ('body', [children[head_id]]), ('eye', [children['eye-stabilizer']])]:
        group = ET.SubElement(root, f'{{{SVG}}}g', {'id': id})
        group.extend(copy.deepcopy(content))
        ids.append(id)
    return root, ids


def convert(folder, variant, resolution, ink):
    source = folder / f'keeper-snake-{variant}-size.svg'
    prepared, ids = prepare(source, variant)
    output = folder / f'keeper-snake-{variant}-webp-{resolution}.svg'
    parts_dir = folder / f'keeper-snake-{variant}-webp-parts-{resolution}'
    parts_dir.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='keeper-snake-') as temporary:
        temp = Path(temporary)
        working = temp / 'parts.svg'
        ET.ElementTree(prepared).write(working, encoding='utf-8', xml_declaration=True)

        def render(id):
            png = temp / f'{id}.png'
            subprocess.run([ink, str(working), '--export-id='+id, '--export-id-only',
                '--export-area-page', f'--export-width={resolution}', '--export-background-opacity=0',
                '--export-filename='+str(png)], check=True, capture_output=True)
            with Image.open(png) as opened:
                image = opened.convert('RGBA')
                bounds = image.getbbox()
                if not bounds:
                    raise ValueError(f'{id} is empty')
                # Two transparent pixels retain antialiasing at every edge.
                bounds = (max(0, bounds[0]-2), max(0, bounds[1]-2),
                          min(resolution, bounds[2]+2), min(resolution, bounds[3]+2))
                cropped = image.crop(bounds)
                buffer = io.BytesIO()
                cropped.save(buffer, format='WEBP', lossless=True, method=6)
                data = buffer.getvalue()
                (parts_dir / f'{id}.webp').write_bytes(data)
                return id, bounds, data

        with ThreadPoolExecutor(max_workers=4) as pool:
            rendered = list(pool.map(render, ids))

    root = ET.Element(f'{{{SVG}}}svg', {'viewBox': f'0 0 {resolution} {resolution}',
        'width': str(resolution), 'height': str(resolution)})
    keeper = ET.SubElement(root, f'{{{SVG}}}g', {'id': 'keeper', 'data-keeper-rig': 'snake'})
    pixels = 0
    for id, (x, y, right, bottom), data in rendered:
        group = ET.SubElement(keeper, f'{{{SVG}}}g', {'id': id})
        ET.SubElement(group, f'{{{SVG}}}image', {'x': str(x), 'y': str(y),
            'width': str(right-x), 'height': str(bottom-y),
            'href': 'data:image/webp;base64,' + base64.b64encode(data).decode('ascii')})
        pixels += (right-x)*(bottom-y)
    ET.ElementTree(root).write(output, encoding='utf-8', xml_declaration=True)
    report = {'source': str(source), 'output': str(output), 'parts': len(ids),
        'sourceBytes': source.stat().st_size, 'svgBytes': output.stat().st_size,
        'decodedPixels': pixels, 'rgbaMiB': round(pixels*4/1024**2, 2)}
    (parts_dir / 'conversion.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('folder', type=Path)
    parser.add_argument('--resolution', type=int, default=2048, choices=[1024, 2048, 4096])
    parser.add_argument('--inkscape', default=r'C:\Program Files\Inkscape\bin\inkscape.com')
    args = parser.parse_args()
    for variant in ['big', 'small']:
        convert(args.folder, variant, args.resolution, args.inkscape)
