export const OWNER_SHELL_SYSTEM_PRESENTATION_OPTIONS = Object.freeze(['NONE', 'DOSSIER', 'CAPTION']);

export const OWNER_SHELL_SYSTEM_TRANSPARENCY_OPTIONS = Object.freeze(['AUTO', 'PRESERVE_ALPHA', 'OPAQUE']);

export function createOwnerShellSystemPresentationSession(placement) {
  if (!placement?.id) return null;
  return {
    backing: false,
    backingColor: '#d8d4ca',
    frame: 'NONE',
    mat: 'NONE',
    matColor: '#d8d4ca',
    placementId: placement.id,
    transparency: 'AUTO',
  };
}

export function updateOwnerShellSystemPresentationSession(session, patch) {
  if (!session) return null;
  return { ...session, ...patch, placementId: session.placementId };
}
