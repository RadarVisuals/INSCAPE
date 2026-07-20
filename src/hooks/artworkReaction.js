import { useStore } from '../store/useStore.js';

export function triggerArtworkReaction(type) {
  const { setParameter } = useStore.getState();
  setParameter('activeReaction', null);
  setParameter('reactionProgress', 1);
  setParameter('activeReaction', type);
}
