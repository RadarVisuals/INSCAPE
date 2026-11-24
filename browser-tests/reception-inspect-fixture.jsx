import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReceptionRestorePreview from '../src/reception/ReceptionRestorePreview.jsx';
import ReceptionDocumentCanvas from '../src/reception/ReceptionDocumentCanvas.jsx';
import { createReceptionEditorDocument, withReceptionModuleWindow } from '../src/reception/receptionEditorDocument.js';
import { createReceptionExample } from '../design-system/lab/receptionExample.js';
import { createArticle } from '../src/text/domain/article.js';
import { TextContentPage } from '../src/text/TextContentPage.jsx';
import '../src/index.css';
import '../src/text/text.css';
import '../src/public/ownerSystemWorkflow/workflowTokens.css';

let value = createReceptionEditorDocument();
value.workbench.area = { left: 0, top: 0, width: 1000, height: 500 };
value.bento = { gap: 0, padding: 0 };
for (const [id, top, height, color, members] of [
  ['shape:mixed', 0, 400, '#333333', ['image:nomad', 'image:keeper', 'text:long']],
  ['shape:short', 400, 100, '#080808', ['text:short']],
]) {
  value.shapes.push({ id, name: id === 'shape:mixed' ? 'Nomad' : 'Introduction', color, opacity: 1, visibility: 'PUBLIC' });
  value.cells.push({ id, members, mobile: { columns: 2, height } });
  value.artworkLayers.push(id);
  value = withReceptionModuleWindow(value, id, { left: 0, top, width: 1000, height });
}
const artwork = createReceptionExample().imageModules[0].artwork;
artwork.crop = null;
artwork.asset.media = { ...artwork.asset.media, url: 'https://raw.githubusercontent.com/RadarVisuals/INSCAPE/226945490a3598b99ddb654f0b15c230348f866e/public/assets/actors/skull_reaper/full.webp', width: 2000, height: 2000 };
for (const [id, left, top, width, height] of [['image:nomad', 110, 40, 260, 320], ['image:keeper', 20, 24, 90, 100]]) {
  value.imageModules.push({ id, name: id, width, height, visibility: 'PUBLIC', artwork: structuredClone(artwork) });
  value.artworkLayers.push(id);
  value = withReceptionModuleWindow(value, id, { left, top, width, height });
}
for (const [id, top, height, text] of [['text:long', 0, 400, 'I feel out of place here. I cannot remember being anywhere else. '.repeat(100)],
  ['text:short', 430, 40, 'Human Underneath']]) {
  const article = createArticle(); article.title = '';
  article.appearance = { ...article.appearance, compact: true, background: null, color: '#ffffff', fontSize: 16, scale: 1 };
  article.content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] };
  value.texts.push({ id, article, visibility: 'PUBLIC' }); value.artworkLayers.push(id);
  value = withReceptionModuleWindow(value, id, { left: 510, top, width: 470, height });
}
const query = new URLSearchParams(location.search);
if (query.has('fade')) {
  const top = Number(query.get('top') ?? 60), height = Number(query.get('height') ?? 600);
  const cellHeight = Number(query.get('cellHeight') ?? 400), article = value.texts[0].article;
  Object.assign(value.workbench.texts.find(item => item.id === 'text:long').window, { left: 60, top, width: 880, height });
  Object.assign(value.workbench.shapes.find(item => item.id === 'shape:mixed').window, { height: cellHeight });
  value.cells[0].clipContent = !query.has('noClip');
  value.cells[0].radius = 24;
  value.imageModules = [];
  value.cells[0].members = ['text:long'];
  Object.assign(article.appearance, { fontSize: Number(query.get('font') ?? 26), lineHeight: 1.5, scale: Number(query.get('scale') ?? 1) });
  const paragraphs = query.has('short') ? ['A short paragraph stays fully visible.'] : [
    'A universe built from skeletal remains and malfunctioning machinery.',
    'The Underneath is a place where nothing human is sacred, and nothing exists by choice.',
    'Beneath the crushing weight of a starless, pitch-black sky, you are just another stray parasite left to drift across desolate plains.',
    'Here, scale itself exists to erase you. Salvaged flesh and rusted industrial parts are stripped down and welded together into the modular pieces of a cold, indifferent landscape.',
  ];
  article.content.content = (query.has('short') ? paragraphs : [...paragraphs, ...paragraphs]).map(text => ({ type: 'paragraph', content: [{ type: 'text', text }] }));
}
if (query.has('single')) {
  const image = value.imageModules[0];
  image.artwork.asset.media = { url: `https://reception.test/single.${query.get('single') === 'webp' ? 'webp' : query.get('single') === 'raster' ? 'png' : 'svg'}`, width: 900, height: 600 };
  image.artwork.crop = { x: .65, y: .6, zoom: 1.5 };
  image.artwork.transform = { quarterTurns: query.has('rotated') ? 1 : 0, mirrorX: true, mirrorY: false };
  if (query.has('cover')) value = withReceptionModuleWindow(value, image.id, { left: 0, top: 0, width: 1000, height: 400 });
  value.imageModules = [value.imageModules.find(item => item.id === image.id)]; value.texts = [];
  value.cells = [{ ...value.cells[0], members: [image.id] }];
  value.shapes = value.shapes.filter(item => item.id === 'shape:mixed');
  const ids = ['shape:mixed', image.id];
  value.artworkLayers = value.artworkLayers.filter(id => ids.includes(id));
  for (const key of ['imageModules', 'texts', 'shapes']) value.workbench[key] = value.workbench[key].filter(item => ids.includes(item.id));
}
if (query.has('preview')) {
  const id = 'shape:offstage';
  value.shapes.push({ id, color: '#171717', opacity: 1, visibility: 'PUBLIC' });
  value.artworkLayers.push(id);
  value = withReceptionModuleWindow(value, id, { left: 950, top: 0, width: 800, height: 100 });
}
if (query.has('stacked')) value.texts[0].article.appearance.writingDirection = 'stacked';
window.inspectionFixture = { value };
function LiveIdentityProbe() {
  useEffect(() => {
    const canvas = document.querySelector('.reception-document-canvas'), probe = document.querySelector('[data-live-cell-probe]');
    const selector = '[data-cell-group="shape:mixed"], [data-cell-group="shape:mixed"] .reception-image, [data-cell-group="shape:mixed"] article';
    let original;
    const measure = () => {
      const nodes = [...canvas.querySelectorAll(selector)];
      if (!original && nodes.length === 4) original = nodes;
      if (original) probe.dataset.sameNodes = String(original.length === nodes.length && original.every((node, i) => node === nodes[i]));
      probe.dataset.imageCount = String(canvas.querySelectorAll('.reception-image').length);
    };
    const observer = new MutationObserver(measure); observer.observe(canvas, { childList: true, subtree: true }); measure();
    return () => observer.disconnect();
  }, []);
  return <output hidden data-live-cell-probe />;
}
function Fixture() {
  const [current, setCurrent] = useState(value);
  window.inspectionFixture.replace = next => { window.inspectionFixture.value = next; setCurrent(next); };
  return <div className="system-workflow" style={{ minHeight: '100vh', padding: 24, boxSizing: 'border-box', background: '#171717' }}>
  {query.has('native') ? <div style={{ width: 1000, height: current.workbench.shapes[0].window.height, position: 'relative', background: '#333', borderRadius: 24, overflow: 'hidden',
    zoom: query.get('zoom') || 1 }} data-fade-native-cell>
    <div className="text-window" data-fade-native-text style={{ position: 'absolute', ...current.workbench.texts[0].window, display: 'flex' }}>
      <TextContentPage article={current.texts[0].article} defaultOverflow="clip" excerpt={{ clipBounds: {
        left: -current.workbench.texts[0].window.left, top: -current.workbench.texts[0].window.top,
        right: 1000 - current.workbench.texts[0].window.left, bottom: current.workbench.shapes[0].window.height - current.workbench.texts[0].window.top,
      } }} />
    </div>
  </div> : query.has('preview') ? <ReceptionRestorePreview label="Profile Bento restore preview" reception={current} onClose={() => {}} /> : <ReceptionDocumentCanvas reception={current} />}
  {!query.has('native') && <LiveIdentityProbe />}
</div>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
