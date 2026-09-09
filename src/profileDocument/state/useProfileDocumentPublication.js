import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PROFILE_DOCUMENT_PUBLICATION_STATUS } from '../domain/profileDocumentPublication.js';
import { createProfileDocumentPublisher, describePublicationError } from '../storage/profileDocumentPublisher.js';
import { ALPHA_SUPPORT_CODES, classifyPublicationSupportCode } from '../../support/alphaSupport.js';

export function createProfileDocumentPublicationState() {
  return { status: PROFILE_DOCUMENT_PUBLICATION_STATUS.READY, error: null,
    supportCode: null, verified: null, transactionHash: null, receiptConfirmed: false };
}

export function useProfileDocumentPublication(getContext, freshnessKey) {
  const [state, setState] = useState(createProfileDocumentPublicationState);
  const contextRef = useRef(getContext);
  contextRef.current = getContext;
  const publisher = useMemo(() => createProfileDocumentPublisher({ getContext: () => contextRef.current(),
    onStatus: (status, verified, transactionHash) => setState((current) => ({
      status, error: null, verified: verified || current.verified, transactionHash: transactionHash || current.transactionHash,
      receiptConfirmed: current.receiptConfirmed || status === PROFILE_DOCUMENT_PUBLICATION_STATUS.VERIFYING_PUBLICATION || status === PROFILE_DOCUMENT_PUBLICATION_STATUS.PUBLISHED
    }))
  }), []);

  const invalidate = useCallback((message = 'The snapshot, CID, or wallet context changed; re-verification is required') => {
    setState((current) => {
      if (!current.verified || current.transactionHash || [PROFILE_DOCUMENT_PUBLICATION_STATUS.AWAITING_WALLET,
        PROFILE_DOCUMENT_PUBLICATION_STATUS.CONFIRMING_TRANSACTION, PROFILE_DOCUMENT_PUBLICATION_STATUS.VERIFYING_PUBLICATION,
        PROFILE_DOCUMENT_PUBLICATION_STATUS.PUBLISHED].includes(current.status)) return current;
      return { ...current, status: PROFILE_DOCUMENT_PUBLICATION_STATUS.STALE, error: message, verified: null };
    });
  }, []);

  const fresh = !state.verified || state.transactionHash || publisher.isFresh(state.verified);
  useEffect(() => { if (!fresh) invalidate(); }, [fresh, freshnessKey, invalidate]);

  const verifyCid = useCallback(async (snapshot, cid, options) => {
    setState({ ...createProfileDocumentPublicationState(), status: PROFILE_DOCUMENT_PUBLICATION_STATUS.VERIFYING_CID });
    try { return await publisher.verifyCid(snapshot, cid, options); }
    catch (error) {
      setState({ ...createProfileDocumentPublicationState(), status: PROFILE_DOCUMENT_PUBLICATION_STATUS.ERROR,
        supportCode: ALPHA_SUPPORT_CODES.CID_VERIFICATION_FAILED, error: describePublicationError(error) });
      return null;
    }
  }, [publisher]);

  const publish = useCallback(() => {
    if (!state.verified) return Promise.resolve(null);
    return publisher.publish(state.verified).catch((error) => {
      const described = describePublicationError(error);
      setState((current) => ({ ...current, status: PROFILE_DOCUMENT_PUBLICATION_STATUS.ERROR,
        supportCode: classifyPublicationSupportCode(error, described), error: described,
        transactionHash: error?.transactionHash || current.transactionHash }));
      return null;
    });
  }, [publisher, state.verified]);

  return { ...state, verified: fresh ? state.verified : null, verifyCid, publish, invalidate, fresh };
}
