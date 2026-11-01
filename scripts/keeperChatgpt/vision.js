import { KEEPER_VISION } from '../../src/keeper/keeperVision.js';

// Accept only bounded local PNG previews. Never fetch a model-supplied URL or
// keep image bytes in conversation history, logs, drafts or the status endpoint.
export function keeperImageInputs(images, scene) {
  if (images === undefined) return [];
  const invalid = () => { throw Object.assign(new Error('Invalid artwork preview. Send again or turn artwork previews off.'), { status: 400 }); };
  if (!Array.isArray(images) || images.length > KEEPER_VISION.count) return invalid();
  const seen = new Set();
  return images.flatMap(image => {
    if (!image || seen.has(image.id) || !scene?.artworks.some(item => item.id === image.id)
      || typeof image.dataUrl !== 'string' || image.dataUrl.length > KEEPER_VISION.imageChars
      || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(image.dataUrl)) return invalid();
    const bytes = Buffer.from(image.dataUrl.slice(22), 'base64');
    if (bytes.length < 33 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      || bytes.readUInt32BE(8) !== 13 || bytes.toString('ascii', 12, 16) !== 'IHDR'
      || bytes.readUInt32BE(16) < 1 || bytes.readUInt32BE(16) > KEEPER_VISION.edge
      || bytes.readUInt32BE(20) < 1 || bytes.readUInt32BE(20) > KEEPER_VISION.edge) return invalid();
    seen.add(image.id);
    return [{ type: 'input_text', text: `Source artwork preview for ${image.id}. This is a still of the source artwork, not the surrounding workspace or its current crop.` },
      { type: 'input_image', image_url: image.dataUrl, detail: 'auto' }];
  });
}
