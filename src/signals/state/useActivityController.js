import { useEffect, useMemo, useState } from 'react';
import { luksoActivityRepository } from '../data/luksoActivityRepository.js';
import { createActivityController, createInitialActivityState } from './activityController.js';

export default function useActivityController({
  active,
  profileAddress,
  repository = luksoActivityRepository,
} = {}) {
  const [state, setState] = useState(createInitialActivityState);
  const controller = useMemo(() => createActivityController({ onChange: setState, repository }), [repository]);

  useEffect(() => {
    if (active) controller.activate(profileAddress);
    else controller.deactivate();
    return () => controller.deactivate();
  }, [active, controller, profileAddress]);

  return { ...state, refresh: controller.refresh, retry: controller.retry };
}
