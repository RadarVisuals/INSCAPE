// Image groups contain resolution variants of one image. Attachments are
// independent resources, not additional resolutions of the first preview.
export function metadataImages(root = {}, { indexed = false } = {}) {
  const normalize = (entry, index) => ({ ...entry,
    index: indexed && Number.isInteger(entry.image_index) ? entry.image_index : index,
    fileType: entry.fileType || entry.file_type || null,
  });
  const flatten = (entries, groupIndex = 0) => (Array.isArray(entries) ? entries : entries ? [entries] : [])
    .flatMap((entry) => Array.isArray(entry) ? flatten(entry, groupIndex)
      : entry && (entry.url || entry.src) ? [normalize(entry, groupIndex)] : []);
  const images = (Array.isArray(root.images) ? root.images : []).flatMap((entry, index) =>
    Array.isArray(entry) ? flatten(entry, index) : flatten(entry, indexed ? index : 0));
  const primary = images.length ? images : flatten(root.image).length ? flatten(root.image) : flatten(root.icon);
  const seen = new Set(primary.flatMap((entry) => [entry.url, entry.src]).filter(Boolean));
  let index = primary.reduce((maximum, entry) => Math.max(maximum, entry.index), -1) + 1;
  const attachments = flatten(root.assets).filter((entry) => {
    const type = String(entry.fileType || '').split(';')[0].trim().toLowerCase();
    const path = String(entry.url || entry.src || '').split(/[?#]/)[0];
    // Some SVG attachments declare generic XML. Keep their original metadata
    // and admit a .svg path; the existing thumbnail reader validates its SVG.
    const xmlSvg = /^(application|text)\/xml$/.test(type) && /\.svg$/i.test(path);
    const image = type ? /^(image\/(png|jpeg|jpg|gif|webp|svg\+xml|avif)|png|jpe?g|gif|webp|svg|avif)$/.test(type)
      || xmlSvg : /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(path);
    if (!image || seen.has(entry.url || entry.src)) return false;
    seen.add(entry.url || entry.src); return true;
  }).map((entry) => ({ ...entry, index: index++ }));
  return [...primary, ...attachments];
}
