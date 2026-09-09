import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveVisitorGridDragDestination } from './visitorGridDragNavigation.js';

const destination = (overrides = {}) => resolveVisitorGridDragDestination({
  activeIndex: 1, deltaX: -100, deltaY: 10, lastIndex: 2, viewportWidth: 1000, ...overrides,
});

test('visitor Space-drag follows owner Grid direction and respects both boundaries', () => {
  assert.equal(destination(), 2);
  assert.equal(destination({ deltaX: 100 }), 0);
  assert.equal(destination({ activeIndex: 2 }), null);
  assert.equal(destination({ activeIndex: 0, deltaX: 100 }), null);
});

test('visitor Space-drag requires a horizontal gesture beyond the bounded threshold', () => {
  assert.equal(destination({ deltaX: -63 }), null);
  assert.equal(destination({ deltaX: -100, deltaY: 90 }), null);
  assert.equal(destination({ deltaX: -120, viewportWidth: 4000 }), 2);
  assert.equal(destination({ deltaX: -119, viewportWidth: 4000 }), null);
});

test('visitor Space-drag fails closed for malformed gesture state', () => {
  assert.equal(destination({ viewportWidth: 0 }), null);
  assert.equal(destination({ deltaX: Number.NaN }), null);
  assert.equal(destination({ activeIndex: 1.5 }), null);
});
