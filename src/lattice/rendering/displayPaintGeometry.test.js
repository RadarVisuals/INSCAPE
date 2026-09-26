import assert from 'node:assert/strict';
import test from 'node:test';
import { displayPaintRectangle, projectDisplayPlacementRectangle } from './displayPaintGeometry.js';

test('shared Display edges land on the same native-zoom layout pixel without changing source coordinates', () => {
  const field = Object.freeze({left:0,top:0,cellSize:601.3/32});
  const a=Object.freeze({column:0,row:0,columnSpan:16,rowSpan:9});
  const b=Object.freeze({column:16,row:9,columnSpan:16,rowSpan:9});
  for(const scale of [.25,.41,.73,.9,1,1.37,2]) {
    const first=projectDisplayPlacementRectangle(a,field,scale), second=projectDisplayPlacementRectangle(b,field,scale);
    const layout=value=>Math.floor(value*scale*64)/64;
    assert.equal(layout(first.left)+layout(first.width),layout(second.left));
    assert.equal(layout(first.top)+layout(first.height),layout(second.top));
    assert.ok(Math.abs(first.width-16*field.cellSize)*scale <= .501);
    const frame=displayPaintRectangle({left:-200.7,top:25.1,width:601.3,height:338.23125},scale);
    assert.equal(layout(frame.width)%1,0);
  }
  assert.equal(a.columnSpan,16); assert.equal(field.cellSize,601.3/32);
});
