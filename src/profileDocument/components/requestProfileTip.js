import { parseEther } from 'viem';
import { sendTransaction } from 'viem/actions';
import { getConnectedProfileAddress, useWalletStore } from '../../store/useWalletStore.js';
import { LUKSO_CHAIN_ID, normalizeProfileAddress } from '../../library/config.js';

export async function requestProfileTip(sender, recipient, amount) {
  if (!/^\d+(\.\d{1,18})?$/.test(amount) || parseEther(amount) <= 0n) throw Error('Enter a positive LYX amount with up to 18 decimal places.');
  const target = normalizeProfileAddress(recipient), source = normalizeProfileAddress(sender);
  const state = useWalletStore.getState();
  if (!target || !source || source === target || normalizeProfileAddress(getConnectedProfileAddress(state)) !== source ||
    normalizeProfileAddress(state.walletClient?.account?.address) !== source || Number(state.chainId) !== LUKSO_CHAIN_ID)
    throw Error('Connect your Universal Profile on LUKSO mainnet to tip.');
  return sendTransaction(state.walletClient, { account: source, chain: state.walletClient.chain, to: target, value: parseEther(amount) });
}
