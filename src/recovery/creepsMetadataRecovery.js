export const CREEPS_COLLECTION_ADDRESS = '0x8993b6dbfd57ed5d3b999a8bf430e7b89056a00b';
export const CREEPS_OWNER_PROFILE = '0x84841412e9F66e360c6Da5f9DbA11b8e88D87Ea8';
export const CREEPS_MEDIA_CID = 'bafybeih6feccail34eyaqq6lpa45h66iquxcrrdxp7sxpnu3prrc2xfo4a';
export const CREEPS_METADATA_CID = 'bafkreibyet77b573e7it7eedp5zyxkziwwvwr23obr5mc626r3mwq3cpga';

export const CREEPS_METADATA_KEYS = Object.freeze([
  '0x9afb95cacc9f95858ec44aa8c3b685511002e30ae54415823f406128b85b238e',
]);

export const CREEPS_METADATA_VALUES = Object.freeze([
  '0x00006f357c6a00204ee9c6e084366d78baeb7e786f6cf2c03fc8bf89b2c86dfa0316062c376fbc82697066733a2f2f6261666b72656962796574373762353733653769743765656470357a79786b7a69777776777232336f6272356d6336323672336d77713363706761',
]);

export const CREEPS_SET_DATA_BATCH_ABI = Object.freeze([{
  type: 'function',
  name: 'setDataBatch',
  stateMutability: 'payable',
  inputs: [
    { name: 'dataKeys', type: 'bytes32[]' },
    { name: 'dataValues', type: 'bytes[]' },
  ],
  outputs: [],
}]);

export const CREEPS_READ_ABI = Object.freeze([
  {
    type: 'function', name: 'owner', stateMutability: 'view', inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function', name: 'getData', stateMutability: 'view',
    inputs: [{ name: 'dataKey', type: 'bytes32' }], outputs: [{ name: 'dataValue', type: 'bytes' }],
  },
]);

export function sameCreepsMetadataValues(values) {
  return Array.isArray(values) && values.length === CREEPS_METADATA_VALUES.length
    && values.every((value, index) => value?.toLowerCase() === CREEPS_METADATA_VALUES[index].toLowerCase());
}
