import test from 'node:test';
import assert from 'node:assert/strict';
import { svgDocumentViewport } from './svgDocumentViewport.js';
const svg = attributes => ({ getAttribute: name => attributes[name] ?? null });
test('responsive SVG exports use the complete authored viewBox, including an offset origin', () => {
  assert.deepEqual(svgDocumentViewport(svg({ width: '100%', height: '100%', viewBox: '-200 80 3000 2500' })), { width: 3000, height: 2500 });
  assert.deepEqual(svgDocumentViewport(svg({ viewBox: '0,0,640,480' })), { width: 640, height: 480 });
});
test('fixed pixel and physical-unit documents retain their existing runtime layout', () => {
  for (const width of ['640', '640px', '8in']) assert.equal(svgDocumentViewport(svg({ width, height: '480', viewBox: '0 0 3000 2500' })), null);
});
test('large coordinate systems are bounded without treating coordinates as an unbounded pixel allocation', () => {
  assert.deepEqual(svgDocumentViewport(svg({ viewBox: '0 0 300000 250000' })), { width: 4096, height: 3413 });
  for (const viewBox of ['', '0 0 0 100', '0 0 -1 100', '0 0 Infinity 100', '0 0 1', '0 0 1 2 3']) assert.equal(svgDocumentViewport(svg({ viewBox })), null);
});
