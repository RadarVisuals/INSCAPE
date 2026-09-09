export const INSCAPE_PROFILE_DOCUMENT_KEY_NAME = 'INSCAPEProfileDocument';
export const INSCAPE_PROFILE_DOCUMENT_KEY =
  '0x804dd24d51189d1d9e972f155541cead2653af105983d5acac1ec2b3478d9362';

export const INSCAPE_PROFILE_DOCUMENT_KEY_SCHEMA = Object.freeze({
  name: INSCAPE_PROFILE_DOCUMENT_KEY_NAME,
  key: INSCAPE_PROFILE_DOCUMENT_KEY,
  keyType: 'Singleton',
  valueType: 'bytes',
  valueContent: 'VerifiableURI',
});
