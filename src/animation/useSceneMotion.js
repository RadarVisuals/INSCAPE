import { useEffect } from 'react';
import './placementMotion.css';

// One visibility observer per scene, shared by all animated placements.
export default function useSceneMotion(ref) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    let visible = true;
    const update = () => { node.dataset.motionPaused = String(!visible || document.hidden); };
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; update(); });
    observer.observe(node);
    document.addEventListener('visibilitychange', update);
    update();
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); delete node.dataset.motionPaused; };
  }, [ref]);
}
