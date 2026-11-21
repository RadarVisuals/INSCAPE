// Geometry for authoring-test scenarios. Production has one drawCell operation;
// tests explicitly choose the rectangle they need, as the pointer tool does.
import { receptionModuleWindow } from '../receptionEditorDocument.js';
import { receptionBentoSettings } from '../receptionBento.js';
export function drawnCellArgs(value, side = 'right', id = 'shape:' + crypto.randomUUID(), sourceId) {
  const { gap, padding } = receptionBentoSettings(value), area = value.workbench.area;
  const r = sourceId ? receptionModuleWindow(value,sourceId) : { left:area.left+padding, top:area.top+padding, width:area.width-2*padding, height:area.height-2*padding };
  const horizontal = ['left','right'].includes(side), leading = ['left','top'].includes(side);
  const size = horizontal?'width':'height', pos = horizontal?'left':'top', amount=horizontal?320:240;
  return [id,{...r,[size]:amount,[pos]:r[pos]+(leading?-amount-gap:r[size]+gap)},side,sourceId];
}
export function drawOuterCell(scope, side = 'right', id, presentation) {
  return scope.editBento('drawCell',drawnCellArgs(scope.getReception(),side,id),scope.getGeneration(),presentation);
}
export function drawBesideCell(scope, source, side, id) {
  return scope.editBento('drawCell',drawnCellArgs(scope.getReception(),side,id,source),scope.getGeneration());
}
