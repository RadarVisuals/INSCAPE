import { useEffect, useMemo, useState } from 'react';
import { luksoProfileDiscoveryRepository } from './data/luksoProfileDiscoveryRepository.js';
import { createInitialProfileDiscoveryState, createProfileDiscoveryController, filterProfileDiscoveryResults } from './profileDiscoveryController.js';

export default function useProfileDiscoveryController({ active = true, repository = luksoProfileDiscoveryRepository } = {}) {
  const [state, setState] = useState(createInitialProfileDiscoveryState);
  const controller = useMemo(() => createProfileDiscoveryController({ onChange: setState, repository }), [repository]);
  useEffect(() => {
    if (active) controller.activate(); else controller.deactivate();
    return () => controller.deactivate();
  }, [active, controller]);
  return {
    ...state,
    activeResult: controller.getActiveResult(),
    moveActive: controller.moveActive,
    resolveSelection: controller.resolveSelection,
    results: filterProfileDiscoveryResults(state.profiles, state.query),
    retry: controller.retry,
    setActiveIndex: controller.setActiveIndex,
    setQuery: controller.setQuery,
  };
}
