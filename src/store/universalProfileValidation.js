import { createPublicClient, getAddress, http } from 'viem';
import { lukso } from 'viem/chains';

const LUKSO_MAINNET_RPC = 'https://rpc.mainnet.lukso.network';
const LSP0_ERC165_INTERFACE_ID = '0x24871b3d';
const ERC165_ABI = [{
  type: 'function',
  name: 'supportsInterface',
  stateMutability: 'view',
  inputs: [{ name: 'interfaceId', type: 'bytes4' }],
  outputs: [{ name: '', type: 'bool' }]
}];

const publicClient = createPublicClient({
  chain: lukso,
  transport: http(LUKSO_MAINNET_RPC, { timeout: 30000 })
});

export async function resolveStandaloneUniversalProfile({ accounts }) {
  const candidate = Array.isArray(accounts) ? accounts[0] : null;
  if (!candidate) return [];

  const address = getAddress(candidate);
  const isUniversalProfile = await publicClient.readContract({
    address,
    abi: ERC165_ABI,
    functionName: 'supportsInterface',
    args: [LSP0_ERC165_INTERFACE_ID]
  }).catch(() => false);

  if (!isUniversalProfile) {
    throw Object.assign(new Error('The connected account is not a Universal Profile.'), {
      code: 'NOT_A_UNIVERSAL_PROFILE'
    });
  }

  return [address];
}
