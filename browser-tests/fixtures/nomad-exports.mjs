import { readFile } from 'node:fs/promises';
import { nomadStudy } from './nomad-study.mjs';
const folder = new URL('../../output/nomad-export-study-2026-10-21/', import.meta.url);
const sources = new Map();
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
export async function nomadExport(variant, { active = true, probe = true } = {}) {
  if (!['full', 'half', 'quarter', 'vector', 'loop'].includes(variant)) throw new Error('Unknown Nomad export');
  if (!sources.has(variant)) {
    const file = variant === 'half' || variant === 'quarter' ? new URL(`raw-${variant}.svg`, folder)
      : new URL('../../../../nomad-webp-svg/NOMAD-animated.svg', import.meta.url);
    let source = await readFile(file, 'utf8');
    sources.set(variant, source);
  }
  let source = nomadStudy(sources.get(variant), { fps: 60, active, probe });
  source = source.replace('id="hover" data-animation-control="true" aria-pressed="true"', 'id="hover" data-animation-control="true" aria-pressed="false"')
    .replace('id="fly" data-animation-control="true" aria-pressed="false"', 'id="fly" data-animation-control="true" aria-pressed="true"');
  // Every candidate gets the same embedding behaviour. Keep authoring controls standalone.
  source = source.replace('function showControls(show) {', "function showControls(show) {\n  if (parent !== window) return;");
  source = source.replace("const $ = id => document.getElementById(id), stage = $('stage'), loading = $('loading');",
    "const $ = id => document.getElementById(id), stage = $('stage'), loading = $('loading');\nif (parent !== window) { $('panel').hidden = true; $('show').hidden = true; }");
  if (variant === 'vector') {
    const payload = JSON.parse(await readFile(new URL('vector-layers.json', folder), 'utf8'));
    const parts = payload.layers.map((layer, i) => `<g id="vector-${i}" data-part="${escape(layer.id)}" data-pass="${layer.pass}"${layer.clip ? ` clip-path="url(#${layer.clip})"` : ''}>${layer.paths.map(p => `<path d="${p.d}" style="${escape(p.style)}"/>`).join('')}</g>`).join('');
    source = source.replace(/<g id="nomad-poster"([^>]*)>[\s\S]*?<\/g>\s*<foreignObject/,
      `<defs><clipPath id="nomad-core-clip" clipPathUnits="userSpaceOnUse"><path d="${payload.coreClip}"/></clipPath></defs><g id="nomad-poster"$1>${parts}</g>\n<foreignObject`);
    const renderer = await readFile(new URL('./nomad-vector-renderer.js', import.meta.url), 'utf8');
    source = source.replace(/class ClothRenderer \{[\s\S]*?\nconst WORLD =/, renderer + '\nconst WORLD =');
    source = source.replace('const prepared = await prepareEmbeddedPieces(message =>', 'const prepared = await (async () => ({ unassigned: 0 }))(message =>');
    source = source.replace("status = 'ready'; setRunning(running);", "$('pieces').disabled = true; $('pieces').title = 'Layer tint is unavailable in this vector trial'; status = 'ready'; setRunning(running);");
  }
  if (variant === 'loop') {
    const loopFolder = new URL('../../.browser-test-runtime/nomad-export-study/loop/', import.meta.url);
    const poster = 'data:image/webp;base64,' + (await readFile(new URL('poster.webp', loopFolder))).toString('base64');
    const loop = 'data:image/webp;base64,' + (await readFile(new URL('loop.webp', loopFolder))).toString('base64');
    source = source.replace(/<g id="nomad-poster"([^>]*)>[\s\S]*?<\/g>\s*<foreignObject/,
      `<g id="nomad-poster"$1><image width="720" height="800" preserveAspectRatio="none" transform="translate(1125 985) scale(${1 / ((720 - 16) / 2690)}) translate(-360 -400)" href="${poster}"/></g>\n<foreignObject`);
    const renderer = await readFile(new URL('./nomad-loop-renderer.js', import.meta.url), 'utf8');
    source = source.replace(/class ClothRenderer \{[\s\S]*?\nconst WORLD =/, `const NOMAD_LOOP_DATA = '${loop}';\n${renderer}\nconst WORLD =`);
    source = source.replace('const prepared = await prepareEmbeddedPieces(message =>', 'const prepared = await (async () => ({ unassigned: 0 }))(message =>');
    source = source.replace('function schedule() {', 'function schedule() {\n  renderer?.setActive(running && !rest && hostVisible && pageActive && !document.hidden && !disposed);');
    source = source.replace("status = 'ready'; setRunning(running);", "$('wind').disabled = true; $('pieces').disabled = true; $('rest').disabled = true; $('wind').title = 'Baked cloth: fixed wind 35%, no speed response'; status = 'ready'; setRunning(running);");
    if (probe) source = source.replace('run: setRunning, mode: setMode,', 'loopPreview(active) { setRunning(false); renderer.setActive(active); }, run: setRunning, mode: setMode,');
  }
  if (['vector', 'loop'].includes(variant) && probe) {
    source = source.replace("capture() { draw(); return renderer.canvas.toDataURL('image/png'); },", `capture() {
    draw(); const node = svgRoot.cloneNode(true);
    node.querySelectorAll('script,foreignObject,style,metadata,#nomad-poster').forEach(n => n.remove());
    node.setAttribute('width', renderer.width); node.setAttribute('height', renderer.height);
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(node))));
  },`);
  }
  source = source.replace('<metadata>', `<metadata id="nomad-export-trial">`);
  return source;
}
