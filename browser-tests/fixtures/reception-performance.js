import { createReceptionExample } from '../../design-system/lab/receptionExample.js';
import { createReceptionEditorDocument, withReceptionModuleWindow, assertReceptionEditorDocument } from '../../src/reception/receptionEditorDocument.js';
import { createArticle } from '../../src/text/domain/article.js';

export const RECEPTION_PERFORMANCE_CASES = ['raster-14', 'svg-6', 'mixed-16'];
export function receptionPerformanceDocument(kind, origin) {
  if (!RECEPTION_PERFORMANCE_CASES.includes(kind)) throw Error(`Unknown workload: ${kind}`);
  let value = createReceptionEditorDocument();
  const svg = kind === 'svg-6', mixed = kind === 'mixed-16';
  const count = svg ? 6 : mixed ? 16 : 14, columns = svg ? 3 : 4;
  const width = 1440 / columns, height = svg ? 400 : 300;
  value.workbench.area = { left: 0, top: 0, width: 1440, height: Math.ceil(count / columns) * height };
  value.branding.name = 'Reception performance fixture';
  value.bento = { gap: 0, padding: 0 };
  value.surface = '#171717';
  for (let index = 0; index < count; index++) {
    const cellId = `shape:perf-${index}`, imageId = `image:perf-${index}`, textId = `text:perf-${index}`;
    const left = index % columns * width, top = Math.floor(index / columns) * height;
    value.shapes.push({ id: cellId, name: `Study ${index + 1}`, color: '#171717', opacity: 1, visibility: 'PUBLIC' });
    value.cells.push({ id: cellId, members: [imageId, ...(mixed ? [textId] : [])], mobile: { columns: 2, height } });
    value.artworkLayers.push(cellId, imageId);
    value = withReceptionModuleWindow(value, cellId, { left, top, width, height });
    const artwork = structuredClone(createReceptionExample().imageModules[0].artwork);
    artwork.id = `artwork:perf-${index}`;
    artwork.crop = null;
    artwork.asset.media = { url: `${origin}/__perf-media/${svg ? `nomad-${index}.svg` : index % 2 ? 'reaper.webp' : 'eye.webp'}`,
      type: 'image', width: svg ? 720 : 2000, height: svg ? 800 : 2000 };
    const imageFrame = mixed ? { left: left + 16, top: top + 10, width: 120, height: 110 } : { left, top, width, height };
    value.imageModules.push({ id: imageId, name: `Image ${index + 1}`, visibility: 'PUBLIC', artwork, width: imageFrame.width, height: imageFrame.height });
    value = withReceptionModuleWindow(value, imageId, imageFrame);
    if (mixed) {
      const article = createArticle();
      article.title = '';
      article.appearance = { ...article.appearance, compact: true, background: null, color: '#ffffff', fontSize: 16, scale: 1 };
      article.content = { type: 'doc', content: Array.from({ length: 24 }, (_, paragraph) => ({ type: 'paragraph', content: [
        { type: 'text', text: `Field note ${paragraph + 1}. `, marks: [{ type: 'bold' }] },
        { type: 'text', text: 'I feel out of place here. I cannot remember being anywhere else. The layers remain alive while their arrangement changes. ' },
        { type: 'text', text: 'Source', marks: [{ type: 'link', attrs: { href: 'https://inscape.id' } }] },
      ] })) };
      value.texts.push({ id: textId, article, visibility: 'PUBLIC' });
      value.artworkLayers.push(textId);
      value = withReceptionModuleWindow(value, textId, { left: left + 16, top: top + 138, width: width - 32, height: 146 });
    }
  }
  return assertReceptionEditorDocument(value);
}
