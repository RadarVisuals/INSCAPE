import { PUBLICATION_UPLOAD_PATH } from '../domain/uploadAuthorization.js';
import { isLocalPublicationOrigin } from '../domain/publicationOrigin.js';

// The existing PR preview is the development upload service. Secrets and
// durable quotas stay there; no draft is copied to that origin's localStorage.
export const DEVELOPMENT_PUBLICATION_SERVICE = 'https://deploy-preview-5--enterinscape.netlify.app';

export function publicationUploadEndpoint(origin, {
  development = Boolean(import.meta.env?.DEV),
  serviceOrigin = import.meta.env?.VITE_PUBLICATION_SERVICE_ORIGIN || DEVELOPMENT_PUBLICATION_SERVICE,
} = {}) {
  if (!development || !isLocalPublicationOrigin(origin)) return PUBLICATION_UPLOAD_PATH;
  const service = new URL(serviceOrigin);
  if (service.protocol !== 'https:' || service.origin !== serviceOrigin) {
    throw new TypeError('The development publication service must be an HTTPS origin.');
  }
  return new URL(PUBLICATION_UPLOAD_PATH, service).href;
}
