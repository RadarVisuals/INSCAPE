// src/hooks/useLsp1Events.js
import { useEffect, useRef } from "react";
import LSP1EventService from "../services/LSP1EventService";
import { useWalletStore } from "../store/useWalletStore";

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

    // Instantiate fresh, decoupled event service
    const service = new LSP1EventService();
    serviceRef.current = service;

    const startListener = async () => {
      await service.initialize();
      
      // Setup WebSockets stream
      const success = await service.setupEventListeners(hostProfileAddress);
      
      // Bind event callback to the stream emitter
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
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (serviceRef.current) {
        serviceRef.current.cleanupListeners();
      }
    };
  }, [hostProfileAddress]);
}