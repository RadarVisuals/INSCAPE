import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createSystemWorkflowDraftStore } from '../../src/systemWorkflow/systemWorkflowDraftStore.js';
import { createReceptionEditorScope } from '../../src/reception/receptionEditorScope.js';
import { addShape, editShape } from '../../src/shapes/shapeSession.js';
import { addTextModule } from '../../src/text/textSession.js';
import { removeWorkbenchModule } from '../../src/systemWorkflow/removeWorkbenchModule.js';
import { projectReception } from '../../src/profileDocument/domain/receptionPresentation.js';
import { receptionModuleWindow } from '../../src/reception/receptionEditorDocument.js';

const profile = '0x' + '7'.repeat(40), results = {};
function fixture() {
  const data = new Map();
  const root = createSystemWorkflowDraftStore({ profileAddress: profile, storage: { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) } });
  return {root, scope: createReceptionEditorScope(root)};
}
{
  const {scope} = fixture();
  const cell = addShape(scope, profile, { position: {left: 0, top: 0}, size: {width: 700, height: 500} });
  scope.turnShapeIntoCell(cell); scope.setEditingCell(cell);
  const text = addTextModule(scope, profile, {window: {left: 20, top: 20, width: 600, height: 400}}, {visibility: 'PUBLIC'});
  scope.setEditingCell(null);
  editShape(scope, profile, scope.getDraft().shapes.find(s => s.id === cell), {visibility: 'PRIVATE'});
  const before = scope.getReception(), publicBefore = projectReception(before);
  const deleted = removeWorkbenchModule(scope, profile, 'shape', scope.getDraft().shapes.find(s => s.id === cell));
  const after = scope.getReception(), publicAfter = projectReception(after);
  assert.equal(deleted, true); assert.equal(publicBefore.texts.length, 0); assert.equal(publicAfter.texts[0]?.id, text);
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getReception(), before);
  results.privateCellDeletion = {deleted, textId: text, publicTextCountBefore: publicBefore.texts.length, publicTextCountAfter: publicAfter.texts.length, retainedVisibility: after.texts[0].visibility, undoRestores: true, before, after};
  scope.release();
}
{
  const {scope} = fixture();
  scope.generateCellLayout({count:2,width:1440,height:900,gap:16,padding:16,radius:0}, 13, scope.getGeneration());
  const cell = scope.getCells()[0].id;
  scope.setEditingCell(cell);
  const frame = receptionModuleWindow(scope.getReception(),cell);
  const text = addTextModule(scope, profile, {window:frame}, {visibility:'PUBLIC'});
  scope.setEditingCell(null);
  let count=0, error='';
  while(count<15) {try{scope.editBento('addCell',[cell],scope.getGeneration());count++;}catch(e){error=e.message;break;}}
  results.minimumBound = {successfulAdditions:count, error, finalTextFrame:receptionModuleWindow(scope.getReception(),text), finalCellCount:scope.getCells().length};
  assert.match(error,/too full|room|needs/);
  scope.release();
}
await writeFile(new URL('state-probes.json',import.meta.url),JSON.stringify(results,null,2));
console.log(JSON.stringify({privateCellDeletion: {...results.privateCellDeletion,before:undefined,after:undefined},minimumBound:results.minimumBound},null,2));
