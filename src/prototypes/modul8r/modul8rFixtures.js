export const MODUL8R_THEMES = ['carbon', 'graphite', 'slate', 'ash', 'mist', 'paper'];
export const MODUL8R_VIEWPORTS = Object.freeze({
  desktop: { label: 'DESKTOP', width: 1280, height: 820 }, compact: { label: 'COMPACT WIDTH', width: 760, height: 720 },
  minimum: { label: 'MINIMUM RACK', width: 520, height: 700 }, laptop: { label: '900PX', width: 900, height: 680 },
  narrow: { label: '640PX', width: 640, height: 720 }, mobile: { label: '390 × 844', width: 390, height: 844 },
});
export const MODUL8R_SCENARIOS = ['ready', 'loading', 'partial', 'empty', 'failed', 'unresolved', 'stress'];
export const LIBRARY_CATEGORIES = [
  { id: 'all', label: 'ALL ASSETS' }, { id: 'owned', label: 'OWNED' }, { id: 'created', label: 'CREATED' },
  { id: 'unsorted', label: 'UNSORTED' }, { id: 'afterimages', label: 'AFTERIMAGES' }, { id: 'field-notes', label: 'FIELD NOTES' },
];
export const LIBRARY_ASSETS = Object.freeze([
  { id: 'asset-01', name: 'Signal Garden', ratio: 'landscape', relationships: ['OWNED', 'CREATED'], categories: ['afterimages'], provenance: 'CREATOR / PROFILE ISSUER', visual: 1 },
  { id: 'asset-02', name: 'Soft Machine', ratio: 'portrait', relationships: ['OWNED'], categories: [], provenance: 'OWNERSHIP / FIXTURE LABEL', visual: 2 },
  { id: 'asset-03', name: 'Index of Air', ratio: 'square', relationships: ['CREATED'], categories: ['field-notes'], provenance: 'CREATOR / AUTHORED, UNVERIFIED', visual: 3 },
  { id: 'asset-04', name: 'Glass Memory', ratio: 'transparent', relationships: ['OWNED', 'CREATED'], categories: ['afterimages', 'field-notes'], provenance: 'RELATIONSHIPS / OWNED + CREATED', visual: 4 },
  { id: 'asset-05', name: 'Waiting Field', ratio: 'landscape', relationships: ['OWNED'], categories: [], provenance: 'MEDIA / LOADING', state: 'loading', visual: 5 },
  { id: 'asset-06', name: 'Absent Image', ratio: 'portrait', relationships: ['CREATED'], categories: [], provenance: 'MEDIA / UNAVAILABLE', state: 'unavailable', visual: 6 },
  { id: 'asset-01', name: 'Signal Garden', ratio: 'landscape', relationships: ['OWNED'], categories: ['field-notes'], provenance: 'DUPLICATE RELATIONSHIP INPUT', visual: 1 },
]);
export const ACTIVITY_EVENTS = Object.freeze([
  { id: 'event-01', kind: 'PLACEMENT', title: 'Signal Garden placed on TABLE 05', detail: 'INDEXED EVENT HISTORY / TARGET RESOLVED', time: '14:08' },
  { id: 'event-02', kind: 'PUBLICATION', title: 'Workspace revision 8 published', detail: 'INDEXED EVENT HISTORY / COMPLETE', time: '12:42' },
  { id: 'event-03', kind: 'CREATOR', title: 'Index of Air attributed', detail: 'INDEXED EVENT HISTORY / PARTIAL PROVENANCE', time: '09:17', state: 'partial' },
  { id: 'event-04', kind: 'ASSET', title: 'Target cannot be resolved', detail: 'INDEXED EVENT HISTORY / UNRESOLVED TARGET', time: '08:03', state: 'unresolved' },
  { id: 'event-05', kind: 'INDEXER', title: 'Event batch failed', detail: 'FAILED / RETRY AVAILABLE IN FIXTURE HARNESS', time: '07:51', state: 'failed' },
]);
export const PEOPLE = Object.freeze([
  { id: 'profile-01', name: 'Ada Ellery', address: '0x7A18…4C20', note: 'PUBLIC DIRECTORY / COMPLETE', visual: 1 },
  { id: 'profile-02', name: 'Mori Signal', address: '0x21B4…0E91', note: 'PUBLIC DIRECTORY / COMPLETE', visual: 2 },
  { id: 'profile-03', name: 'Unresolved Profile', address: '0xB019…91F2', note: 'PUBLIC DIRECTORY / UNRESOLVED PROFILE', state: 'unresolved', visual: 3 },
  { id: 'profile-04', name: 'Loading Profile', address: 'ADDRESS PENDING', note: 'PUBLIC DIRECTORY / LOADING', state: 'loading', visual: 4 },
  { id: 'profile-05', name: 'Directory Failure', address: 'NOT AVAILABLE', note: 'PUBLIC DIRECTORY / FAILED', state: 'failed', visual: 5 },
]);
export const INITIAL_LAYERS = Object.freeze([
  { id: 'placement-a', assetId: 'asset-01', name: 'Signal Garden / A', table: 'TABLE 05' },
  { id: 'placement-b', assetId: 'asset-04', name: 'Glass Memory', table: 'TABLE 05' },
  { id: 'placement-c', assetId: 'asset-01', name: 'Signal Garden / B', table: 'TABLE 05' },
  { id: 'placement-d', assetId: 'asset-02', name: 'Soft Machine', table: 'TABLE 05' },
]);
export const USED_ELSEWHERE = Object.freeze([
  { id: 'elsewhere-1', assetId: 'asset-01', label: 'Signal Garden', table: 'TABLE 02' },
  { id: 'elsewhere-2', assetId: 'asset-03', label: 'Index of Air', table: 'TABLE 08' },
]);
