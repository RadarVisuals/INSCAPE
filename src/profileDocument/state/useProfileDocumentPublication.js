import { useCallback, useMemo, useState } from 'react';
import { PROFILE_DOCUMENT_PUBLICATION_STATUS } from '../domain/profileDocumentPublication.js';
import { createProfileDocumentPublisher } from '../storage/profileDocumentPublisher.js';

export function useProfileDocumentPublication(getContext) {
  const [state, setState] = useState({ status: PROFILE_DOCUMENT_PUBLICATION_STATUS.READY, error: null, verified: null, transactionHash: null, receiptConfirmed: false });
  const publisher = useMemo(() => createProfileDocumentPublisher({ getContext,
    onStatus: (status, verified, transactionHash) => setState((current) => ({
      status, error: null, verified: verified || current.verified, transactionHash: transactionHash || current.transactionHash,
      receiptConfirmed: current.receiptConfirmed || status === PROFILE_DOCUMENT_PUBLICATION_STATUS.VERIFYING_PUBLICATION || status === PROFILE_DOCUMENT_PUBLICATION_STATUS.PUBLISHED
    }))
  }), [getContext]);

  const verifyCid = useCallback(async (snapshot, cid, options) => {
    setState({ status: PROFILE_DOCUMENT_PUBLICATION_STATUS.VERIFYING_CID, error: null, verified: null, transactionHash: null, receiptConfirmed: false });
    try { return await publisher.verifyCid(snapshot, cid, options); }
    catch (error) {
      setState({ status: PROFILE_DOCUMENT_PUBLICATION_STATUS.ERROR, error: error instanceof Error ? error.message : String(error), verified: null, transactionHash: null, receiptConfirmed: false });
      return null;
    }
  }, [publisher]);

  const publish = useCallback(async () => {
    if (!state.verified) return null;
    try {
      if (state.receiptConfirmed) return await publisher.verifyPublication(state.verified, state.transactionHash);
      return await publisher.publish(state.verified);
    }
    catch (error) {
      setState((current) => ({ ...current, status: PROFILE_DOCUMENT_PUBLICATION_STATUS.ERROR,
        error: error instanceof Error ? error.message : String(error) }));
      return null;
    }
  }, [publisher, state.receiptConfirmed, state.transactionHash, state.verified]);

  return { ...state, verifyCid, publish };
}
