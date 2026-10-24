import { BROWSER_ASSET_SIZE, BROWSER_SORTS, BROWSER_VIEW_KINDS } from './browserWorkspaceModel.js';

export const defaultBrowserPreferences = () => ({ view: { kind: BROWSER_VIEW_KINDS.ALL, id: null }, query: '',
  collection: 'all', sort: BROWSER_SORTS.TITLE_ASC, assetSize: BROWSER_ASSET_SIZE.DEFAULT,
  sidebarWidth: 174, hideLabels: false, libraryWidth: null, relationshipView: 'all', collapsedSections: [] });
export function validBrowserPreferences(value) {
  return Boolean(value && value.view && Object.values(BROWSER_VIEW_KINDS).includes(value.view.kind)
    && (value.view.kind === BROWSER_VIEW_KINDS.CATEGORY ? typeof value.view.id === 'string' && value.view.id.length <= 256 : value.view.id === null)
    && typeof value.query === 'string' && value.query.length <= 1000
    && typeof value.collection === 'string' && value.collection.length <= 1000
    && Object.values(BROWSER_SORTS).includes(value.sort) && typeof value.hideLabels === 'boolean'
    && ['all', 'owned', 'created'].includes(value.relationshipView) && Array.isArray(value.collapsedSections)
    && value.collapsedSections.length <= 256 && value.collapsedSections.every(id => typeof id === 'string' && id.length <= 256)
    && Number.isFinite(value.assetSize) && value.assetSize >= BROWSER_ASSET_SIZE.MINIMUM && value.assetSize <= BROWSER_ASSET_SIZE.MAXIMUM
    && Number.isFinite(value.sidebarWidth) && value.sidebarWidth >= 48 && value.sidebarWidth <= 320
    && (value.libraryWidth === null || Number.isFinite(value.libraryWidth) && value.libraryWidth >= 300 && value.libraryWidth <= 8000));
}
