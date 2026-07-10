// src/hooks/useLsp1Events.js
import { useEffect, useRef } from 'react';
import { useWalletStore } from '../store/useWalletStore';
import LSP1EventService from '../services/LSP1EventService';

export function useLsp1Events(onEventReceived) {
  const hostProfileAddress = useWalletStore((s) => s.hostProfileAddress);
  const serviceRef = useRef(null);
  const unsubscribeRef = useRef(null);
  const onEventReceivedRef = useRef(onEventReceived);

  // Keep callback reference synchronized to avoid stale react closure captures
  useEffect(() => {
    onEventReceivedRef.current = onEventReceived;
  }, [onEventReceived]);

  useEffect(() => {
    if (!hostProfileAddress) return;

    let isCurrent = true;
    const service = new LSP1EventService();
    serviceRef.current = service;

    const startListener = async () => {
      await service.initialize();
      if (!isCurrent) return;
      
      const success = await service.setupEventListeners(hostProfileAddress);
      if (!isCurrent) {
        // If the context changed while setup was in progress, dismantle the connection immediately
        service.cleanupListeners();
        return;
      }
      
      if (success) {
        unsubscribeRef.current = service.onEvent((event) => {
          if (onEventReceivedRef.current) {
            onEventReceivedRef.current(event);
          }
        });
      }
    };

    startListener();

    // Clean teardown during profile swaps or component unmounts
    return () => {
      isCurrent = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      if (serviceRef.current) {
        serviceRef.current.cleanupListeners();
        serviceRef.current = null;
      }
    };
  }, [hostProfileAddress]);
}