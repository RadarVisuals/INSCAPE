import LibraryArtworkImage from './LibraryArtworkImage.jsx';
import { useState } from 'react';
import { resolvePublishedAssetUrl } from '../../profileDocument/domain/publishedAssetUrl.js';
import { Image } from 'lucide-react';
import { libraryPreviewUrl } from '../../library/data/libraryImagePreview.js';

function ImageSample({ url }) {
  const original = resolvePublishedAssetUrl(url);
  const [src, setSrc] = useState(() => libraryPreviewUrl(url, 64));
  return <span className="workbench-layer-image">
    {src ? <LibraryArtworkImage src={src} alt="" loading="lazy" decoding="async" draggable={false}
      onError={() => setSrc(src === original ? null : original)} /> : <Image />}
  </span>;
}

function LayerSample({ item }) {
  const record = item?.record;
  if (item?.key === 'imageModules') {
    const url = record.artwork?.asset?.media?.url;
    return <ImageSample key={url} url={url} />;
  }
  if (item?.key === 'texts') {
    const article = record.article;
    const text = article.content?.content?.flatMap(block => block.content || []).find(node => node.text?.trim())?.text;
    return <span style={{ backgroundColor: article.appearance?.background }}>{(text?.trim() || article.title || 'Aa').slice(0, 2)}</span>;
  }
  return <span data-grid={record?.kind === 'grid' || undefined} style={{ color: record?.color, backgroundColor: record?.kind === 'grid' ? undefined : record?.color, opacity: record?.opacity }} />;
}

export default function LayerThumbnail({ items }) {
  return <span className="workbench-layer-thumb" aria-hidden="true" data-multiple={items.length > 1 || undefined}>
    {items.map((item, index) => <LayerSample key={item?.id || index} item={item} />)}
  </span>;
}
