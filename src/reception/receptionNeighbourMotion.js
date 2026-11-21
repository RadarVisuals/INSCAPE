// Temporary paint only. Authored frames and hit geometry settle immediately;
// only displaced neighbours receive a short additive translation to catch up.
export function createReceptionNeighbourMotion() {
  const running = new Map();
  let pending = [];
  const dispose = () => { pending = []; for (const animation of running.values()) animation.cancel(); running.clear(); };
  return {
    capture(nodes, reducedMotion) {
      pending = reducedMotion ? [] : [...new Set(nodes)].filter(node => node?.isConnected && node.animate)
        .map(node => ({ node, before: node.getBoundingClientRect() }));
      if (reducedMotion) dispose();
    },
    paint() {
      const frames = pending; pending = [];
      // Read every endpoint before starting any effect.
      const endpoints = frames.filter(({ node }) => node.isConnected).map(({ node, before }) => {
        running.get(node)?.cancel(); running.delete(node);
        return { node, before, after: node.getBoundingClientRect() };
      });
      for (const { node, before, after } of endpoints) {
        const x = before.left - after.left, y = before.top - after.top;
        if (Math.abs(x) + Math.abs(y) < .5) continue;
        const animation = node.animate([{ translate: `${x}px ${y}px` }, { translate: '0px 0px' }],
          { duration: 140, easing: 'cubic-bezier(.2,.8,.2,1)', composite: 'add' });
        running.set(node, animation);
        animation.onfinish = () => { if (running.get(node) === animation) running.delete(node); };
      }
    },
    dispose,
  };
}
