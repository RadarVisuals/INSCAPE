// A curated implementation, not a general executable-template permission.
export const MOBILE_FOUNDER_PROFILE = '0x001048331cd14cef40dd5da644a738e7324fe691';
export function canUseMobileRenderer(mobile, profileAddress) {
  return mobile?.front?.renderer !== 'steyra' || String(profileAddress).toLowerCase() === MOBILE_FOUNDER_PROFILE;
}
