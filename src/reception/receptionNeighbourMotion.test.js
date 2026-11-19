import test from 'node:test';
import assert from 'node:assert/strict';
import { createReceptionNeighbourMotion } from './receptionNeighbourMotion.js';

function node() {
  const animations = [];
  return { isConnected: true, left: 0, animations,
    getBoundingClientRect() { return { left: this.left, top: 0 }; },
    animate(frames, options) {
      const animation = { frames, options, cancelled: 0, cancel() { this.cancelled++; } };
      animations.push(animation); return animation;
    },
  };
}
test('only displaced neighbours animate; repeated frames replace their effect and disposal cancels it', () => {
  const moved=node(), still=node(), motion=createReceptionNeighbourMotion();
  motion.capture([moved,still],false); moved.left=100; motion.paint();
  assert.equal(still.animations.length,0); assert.equal(moved.animations.length,1);
  assert.equal(moved.animations[0].frames[0].translate,'-100px 0px');
  assert.equal(moved.animations[0].options.composite,'add');
  motion.capture([moved],false); moved.left=120; motion.paint();
  assert.equal(moved.animations[0].cancelled,1); assert.equal(moved.animations.length,2);
  motion.dispose(); assert.equal(moved.animations[1].cancelled,1);
  motion.paint(); assert.equal(moved.animations.length,2);
});
test('reduced motion and removed neighbours never start an effect', () => {
  const moved=node(), motion=createReceptionNeighbourMotion();
  motion.capture([moved],true); moved.left=100; motion.paint(); assert.equal(moved.animations.length,0);
  motion.capture([moved],false); moved.isConnected=false; motion.paint(); assert.equal(moved.animations.length,0);
});
