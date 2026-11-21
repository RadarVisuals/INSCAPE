import { leaves, validTree, sampleDocument, moveCell, setRatio } from './partition.js';
// Preserve v1's coordinate experiment; this version has a distinct owner/key.
export const STORAGE_KEY = 'inscape:prototype:bento-grid-trial:v2';
export const initialDocument = sampleDocument;
export function assertDocument(doc) {
  if (!doc?.content || !validTree(doc.tree, doc.content)) throw Error('Ongeldige indeling.');
  const ids = leaves(doc.tree);
  if (ids.length > 64 || new Set(ids).size !== ids.length || ids.length !== Object.keys(doc.content).length
    || Object.values(doc.content).some(c => typeof c.name !== 'string' || typeof c.text !== 'string'
      || !/^#[0-9a-f]{6}$/i.test(c.color) || c.image !== undefined && c.image !== '/assets/characters/01/lineart.webp'))
    throw Error('Ongeldige celinhoud of celidentiteiten.');
  return doc;
}
export function createTrialStore(storage) {
  let value = initialDocument(), undo = [], redo = [], revision = 0, notice = '';
  try {
    const source = storage.getItem(STORAGE_KEY);
    if (source !== null) {
      const saved = JSON.parse(source);
      if (saved.version !== 2) throw Error();
      value = assertDocument(saved.document);
    }
  } catch { notice = 'Opgeslagen proef onleesbaar. Reset proef om bewust opnieuw te beginnen; de opgeslagen gegevens zijn behouden.'; }
  const save = next => {
    if (notice) throw Error(notice);
    const source = JSON.stringify({ version: 2, document: assertDocument(next) });
    try {
      storage.setItem(STORAGE_KEY, source);
      if (storage.getItem(STORAGE_KEY) !== source) throw Error();
    } catch { throw Error('De proef kon niet worden opgeslagen. De vorige indeling is behouden.'); }
  };
  const commit = (next, expected = revision) => {
    if (expected !== revision) throw Error('De proef is veranderd. Begin de beweging opnieuw.');
    assertDocument(next);
    if (JSON.stringify(next) === JSON.stringify(value)) return false;
    save(next); undo.push(value); redo = []; value = structuredClone(next); revision++; return true;
  };
  return {
    read: () => ({ document: structuredClone(value), canUndo: undo.length > 0, canRedo: redo.length > 0, revision, notice }),
    move: (id, target, expected) => commit({ ...value, tree: moveCell(value.tree, id, target) }, expected),
    tree: (tree, expected) => commit({ ...value, tree }, expected),
    ratio: (path, ratio) => commit({ ...value, tree: setRatio(value.tree, path, ratio) }),
    sample: count => commit(sampleDocument(count)),
    content(id, patch) {
      if (!Object.hasOwn(value.content, id)) throw Error('Deze cel bestaat niet.');
      return commit({ ...value, content: { ...value.content, [id]: { ...value.content[id], ...patch } } });
    },
    undo() { if (!undo.length) return; const next = undo.at(-1); save(next); redo.push(value); undo.pop(); value = next; revision++; },
    redo() { if (!redo.length) return; const next = redo.at(-1); save(next); undo.push(value); redo.pop(); value = next; revision++; },
    reset() {
      storage.removeItem(STORAGE_KEY);
      if (storage.getItem(STORAGE_KEY) !== null) throw Error('Reset is niet opgeslagen.');
      value = initialDocument(); undo = []; redo = []; notice = ''; revision++;
    },
  };
}
