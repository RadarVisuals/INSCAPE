import { normalizeProfileAddress } from '../../library/config.js';

export function canReplaceInvalidPublication(resolution, profileAddress) {
  const address = normalizeProfileAddress(profileAddress);
  return Boolean(address && !resolution?.busy && resolution?.status === 'INVALID'
    && resolution.errorCode === 'INVALID_DOCUMENT' && normalizeProfileAddress(resolution.address) === address);
}
