import { normalizeProfileAddress } from '../../library/config.js';

export const PROFILE_CONTRACT_FACT_STATUS = Object.freeze({
  IDLE: 'IDLE', LOADING: 'LOADING', RESOLVED: 'RESOLVED', UNAVAILABLE: 'UNAVAILABLE', ERROR: 'ERROR'
});

export function createContractFact(status = PROFILE_CONTRACT_FACT_STATUS.IDLE, value = null, errorCode = null) {
  return Object.freeze({ status, value, errorCode });
}

export const resolvedContractFact = (value) => createContractFact(PROFILE_CONTRACT_FACT_STATUS.RESOLVED, value);
export const unavailableContractFact = (errorCode = 'UNAVAILABLE') => createContractFact(PROFILE_CONTRACT_FACT_STATUS.UNAVAILABLE, null, errorCode);
export const errorContractFact = (errorCode = 'RPC_ERROR') => createContractFact(PROFILE_CONTRACT_FACT_STATUS.ERROR, null, errorCode);

export function createProfileContractFacts(address, overrides = {}) {
  const normalizedAddress = normalizeProfileAddress(address);
  if (!normalizedAddress) throw new TypeError('A valid address is required');
  const initial = createContractFact(overrides.status || PROFILE_CONTRACT_FACT_STATUS.IDLE);
  return Object.freeze({
    address: resolvedContractFact(normalizedAddress),
    chain: initial,
    isUniversalProfile: initial,
    receivedAssetContracts: initial,
    issuedAssetContracts: initial,
    source: 'DIRECT_RPC',
    ...overrides,
    address: resolvedContractFact(normalizedAddress)
  });
}
