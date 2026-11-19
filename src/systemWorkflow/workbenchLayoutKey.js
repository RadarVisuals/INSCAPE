import { FIRST_WORKBENCH_ID } from './domain/workbenchCollection.js';

// The original canvas uses the profile's unsuffixed layout cache key.
export const workbenchLayoutKey = (profile, id = FIRST_WORKBENCH_ID) =>
  `inscape:workbench:layout:v1:${profile.toLowerCase()}${id === FIRST_WORKBENCH_ID ? '' : `:${id}`}`;
