import { ARTWORK_DOCUMENT_HEADERS, ARTWORK_DOCUMENT_HTML } from '../../scripts/artworkDocumentHost.js';

// Static host only: no proxy target, server-side asset fetch, secrets or wallet.
export const handler = async () => ({ statusCode: 200, headers: ARTWORK_DOCUMENT_HEADERS, body: ARTWORK_DOCUMENT_HTML });
