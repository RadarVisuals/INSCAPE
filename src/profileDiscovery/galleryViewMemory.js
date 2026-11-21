// Tab-local browsing preferences. The verified publication still decides which IDs are visible.
export function readGalleryView(address) {
  try {
    const value = JSON.parse(sessionStorage.getItem('inscape.gallery.view.' + address));
    if (!value || typeof value !== 'object') return {};
    return {
      ...(['grid', 'list'].includes(value.layout) && { layout: value.layout }),
      ...(typeof value.quickView === 'boolean' && { quickView: value.quickView }),
      ...(typeof value.wrap === 'boolean' && { wrap: value.wrap }),
      ...([1, 2, 3].includes(value.cardSize) && { cardSize: value.cardSize }),
      ...(Number.isInteger(value.viewportSize) && value.viewportSize >= 0 && value.viewportSize <= 100 && { viewportSize: value.viewportSize }),
      ...(typeof value.selectedId === 'string' && { selectedId: value.selectedId }),
    };
  } catch { return {}; }
}

export function rememberGalleryView(address, patch) {
  try {
    sessionStorage.setItem('inscape.gallery.view.' + address, JSON.stringify({ ...readGalleryView(address), ...patch }));
  } catch { /* Browsing still works when tab storage is unavailable. */ }
}
