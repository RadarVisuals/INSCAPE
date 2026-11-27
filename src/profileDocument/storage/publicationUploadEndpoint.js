import { PUBLICATION_UPLOAD_PATH } from '../domain/uploadAuthorization.js';
import { isLocalPublicationOrigin, localPublicationServiceOrigin } from '../domain/publicationOrigin.js';

export function publicationUploadEndpoint(origin, {
  serviceOrigin = import.meta.env?.VITE_PUBLICATION_SERVICE_ORIGIN || undefined,
} = {}) {
  if (!isLocalPublicationOrigin(origin)) return PUBLICATION_UPLOAD_PATH;
  return new URL(PUBLICATION_UPLOAD_PATH, localPublicationServiceOrigin(serviceOrigin)).href;
}
