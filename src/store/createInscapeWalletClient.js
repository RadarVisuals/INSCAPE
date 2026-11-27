import { createClient } from 'viem';
import { signMessage, writeContract } from 'viem/actions';

// Keep Viem's account parsing, transport and wallet actions. Inscape's callers
// need only upload-authorisation signatures and explicit contract writes.
export function createInscapeWalletClient({ chain, transport, account }) {
  return createClient({ chain, transport, account, key: 'wallet', name: 'Wallet Client', type: 'walletClient' })
    .extend(client => ({
      signMessage: parameters => signMessage(client, parameters),
      writeContract: parameters => writeContract(client, parameters),
    }));
}
