import { decodeErrorResult } from 'viem';

// Signatures are from the official LUKSO LSP6KeyManager and LSP0/LSP20 ABIs.
// Keeping this focused avoids treating unrelated contract failures as permission errors.
export const PUBLICATION_ERROR_ABI = Object.freeze([
  { type: 'error', name: 'NoPermissionsSet', inputs: [{ name: 'from', type: 'address' }] },
  { type: 'error', name: 'NotAuthorised', inputs: [{ name: 'from', type: 'address' }, { name: 'permission', type: 'string' }] },
  { type: 'error', name: 'NoERC725YDataKeysAllowed', inputs: [{ name: 'from', type: 'address' }] },
  { type: 'error', name: 'NotAllowedERC725YDataKey', inputs: [{ name: 'from', type: 'address' }, { name: 'disallowedKey', type: 'bytes32' }] },
  { type: 'error', name: 'InvalidEncodedAllowedERC725YDataKeys', inputs: [{ name: 'value', type: 'bytes' }, { name: 'context', type: 'string' }] },
  { type: 'error', name: 'LSP20CallVerificationFailed', inputs: [{ name: 'postCall', type: 'bool' }, { name: 'returnedStatus', type: 'bytes4' }] },
  { type: 'error', name: 'LSP20CallingVerifierFailed', inputs: [{ name: 'postCall', type: 'bool' }] },
  { type: 'error', name: 'LSP20EOACannotVerifyCall', inputs: [{ name: 'logicVerifier', type: 'address' }] }
]);

const MAX_DEPTH = 12;
const MAX_NODES = 64;
const MAX_REVERT_HEX_LENGTH = 16_384;
const MAX_MESSAGE_LENGTH = 320;
const NESTED_ERROR_KEYS = ['cause', 'error', 'data', 'originalError'];
const TEXT_KEYS = ['shortMessage', 'details', 'message'];

function safeText(value) {
  if (typeof value !== 'string') return '';
  const diagnosticOnly = value.split(/\b(?:Request Arguments|Raw Call Arguments|Request Body|Provider Context):/iu, 1)[0];
  const cleaned = diagnosticOnly.replace(/0x[0-9a-f]{80,}/giu, '[hex data omitted]')
    .replace(/\b(?:token|secret|session|authorization)=\S+/giu, '[private value omitted]')
    .replace(/\s+/gu, ' ').trim();
  return cleaned.length > MAX_MESSAGE_LENGTH ? `${cleaned.slice(0, MAX_MESSAGE_LENGTH - 1)}…` : cleaned;
}

function rawRevertData(value) {
  if (typeof value !== 'string') return null;
  const direct = value.trim();
  if (/^0x[0-9a-f]*$/iu.test(direct) && direct.length <= MAX_REVERT_HEX_LENGTH) return direct;
  const match = value.slice(0, MAX_REVERT_HEX_LENGTH)
    .match(/(?:execution reverted|revert data|return data|error data)\s*:?\s*(0x[0-9a-f]{8,})/iu);
  return match && match[1].length <= MAX_REVERT_HEX_LENGTH ? match[1] : null;
}

function inspectErrorGraph(root) {
  const queue = [{ value: root, depth: 0 }];
  const visited = new WeakSet();
  const inspection = { rejected: false, decoded: null, rawData: null, texts: [], nodes: [] };
  while (queue.length && inspection.nodes.length < MAX_NODES) {
    const { value, depth } = queue.shift();
    if (value === null || value === undefined || depth > MAX_DEPTH) continue;
    if (typeof value === 'string') {
      const raw = rawRevertData(value); if (!inspection.rawData && raw) inspection.rawData = raw;
      continue;
    }
    if (typeof value !== 'object' && typeof value !== 'function') continue;
    if (visited.has(value)) continue;
    visited.add(value); inspection.nodes.push(value);
    if (Number(value.code) === 4001 || value.name === 'UserRejectedRequestError') inspection.rejected = true;
    if (!inspection.decoded && typeof value.errorName === 'string') inspection.decoded = value;
    for (const key of TEXT_KEYS) {
      const text = safeText(value[key]);
      if (text && !inspection.texts.includes(text)) inspection.texts.push(text);
      if (!inspection.rawData) inspection.rawData = rawRevertData(value[key]);
    }
    if (!inspection.rawData && typeof value.data === 'string') inspection.rawData = rawRevertData(value.data);
    if (depth < MAX_DEPTH) {
      for (const key of NESTED_ERROR_KEYS) if (value[key] !== undefined) queue.push({ value: value[key], depth: depth + 1 });
    }
  }
  if (!inspection.decoded && inspection.rawData && inspection.rawData.length >= 10) {
    try { inspection.decoded = decodeErrorResult({ abi: PUBLICATION_ERROR_ABI, data: inspection.rawData }); }
    catch { /* Unknown or malformed official contract error. */ }
  }
  return inspection;
}

function transactionSuffix(nodes) {
  for (const node of nodes) {
    const hash = node?.transactionHash;
    if (typeof hash === 'string' && /^0x[0-9a-f]{6,66}$/iu.test(hash)) return ` (transaction ${hash})`;
  }
  return '';
}

function describeDecoded(decoded) {
  const args = decoded?.args || [];
  switch (decoded?.errorName) {
    case 'NoPermissionsSet': return `NoPermissionsSet: ${args[0] || 'the sender'} has no LSP6 permissions`;
    case 'NotAuthorised': return `NotAuthorised: ${args[0] || 'the sender'} lacks the ${safeText(args[1]) || 'required'} LSP6 permission`;
    case 'NoERC725YDataKeysAllowed': return `NoERC725YDataKeysAllowed: ${args[0] || 'the sender'} has no allowed ERC725Y data keys`;
    case 'NotAllowedERC725YDataKey': return `NotAllowedERC725YDataKey: ${args[0] || 'the sender'} cannot set ${args[1] || 'this ERC725Y key'}`;
    case 'InvalidEncodedAllowedERC725YDataKeys': return `InvalidEncodedAllowedERC725YDataKeys: the LSP6 allowed-data-key configuration is malformed${safeText(args[1]) ? ` (${safeText(args[1])})` : ''}`;
    case 'LSP20CallVerificationFailed': return `LSP20CallVerificationFailed: ${args[0] ? 'post-call' : 'pre-call'} verification returned ${args[1] || 'an invalid status'}`;
    case 'LSP20CallingVerifierFailed': return `LSP20CallingVerifierFailed: the ${args[0] ? 'post-call' : 'pre-call'} verifier call failed without a reason`;
    case 'LSP20EOACannotVerifyCall': return `LSP20EOACannotVerifyCall: ${args[0] || 'the configured verifier'} is not a contract verifier`;
    default: return null;
  }
}

export function describePublicationError(error) {
  const inspected = inspectErrorGraph(error);
  const suffix = transactionSuffix(inspected.nodes);
  if (inspected.rejected) return `Wallet request rejected by the user${suffix}`;
  const decoded = describeDecoded(inspected.decoded);
  if (decoded) return `${decoded}${suffix}`;

  for (const node of inspected.nodes) {
    const reason = node?.replacementReason || node?.reason;
    if (reason === 'cancelled') return `The submitted transaction was cancelled in the wallet${suffix}`;
    if (reason === 'replaced') return `The submitted transaction was replaced by a different transaction${suffix}`;
    if (reason === 'repriced') return `The submitted transaction was repriced${suffix}`;
  }
  if (inspected.nodes.some((node) => node?.name === 'WaitForTransactionReceiptTimeoutError'
    || node?.code === 'RECEIPT_TIMEOUT') || inspected.texts.some((text) => /receipt.*tim(?:e|ed)\s*out|timed out.*transaction/iu.test(text))) {
    return `Timed out waiting for the publication receipt; retry confirmation with the same hash${suffix}`;
  }
  if (inspected.nodes.some((node) => node?.name === 'TransactionReceiptRevertedError'
    || node?.code === 'RECEIPT_REVERTED' || node?.receipt?.status === 'reverted')
    || inspected.texts.some((text) => /transaction (?:was )?reverted|publication transaction reverted/iu.test(text))) {
    return `The publication transaction reverted${suffix}`;
  }
  if (inspected.rawData?.length >= 10) return `Contract call reverted with unknown selector ${inspected.rawData.slice(0, 10)}${suffix}`;
  if (inspected.rawData === '0x' || inspected.texts.some((text) => /execution reverted|contract.*revert/iu.test(text))) {
    return `Contract call reverted without decodable error data${suffix}`;
  }
  const transportNode = inspected.nodes.find((node) => Number(node?.code) <= -32000
    || /(?:Rpc|Provider|Transport|HttpRequest|Socket|Network)Error/u.test(String(node?.name || '')));
  const diagnostic = inspected.texts[0];
  if (transportNode) return `Provider/RPC transport failure${diagnostic ? `: ${diagnostic}` : ''}${suffix}`;
  if (diagnostic) return `${diagnostic}${suffix}`;
  return `Unknown provider failure${suffix}`;
}
