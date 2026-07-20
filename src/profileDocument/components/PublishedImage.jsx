import { useEffect, useState } from 'react';

export default function PublishedImage({ src, alt = '', fallback = 'Artwork unavailable', loading, className, style }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  if (!src || failed) return <span className={className} data-published-image-fallback>{fallback}</span>;
  return <img className={className} src={src} alt={alt} loading={loading} decoding="async"
    referrerPolicy="no-referrer" style={style} onError={() => setFailed(true)} />;
}
