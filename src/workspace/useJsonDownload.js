import { useEffect, useRef } from 'react';

export function useJsonDownload(owner) {
  const resources = useRef(new Map());
  useEffect(() => () => {
    for (const [url, timer] of resources.current) {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
    }
    resources.current.clear();
  }, [owner]);

  return (source, filename) => {
    const url = URL.createObjectURL(new Blob([source], { type: 'application/json' }));
    resources.current.set(url, setTimeout(() => { URL.revokeObjectURL(url); resources.current.delete(url); }, 60000));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    try { link.click(); } finally { link.remove(); }
  };
}
