// src/services/LSP1EventService.js
import {
  createPublicClient,
  webSocket,
  isAddress,
  decodeEventLog,
  getAddress,
  decodeAbiParameters,
  parseAbiParameters,
} from "viem";
import { lukso } from "viem/chains";

const DEFAULT_LUKSO_WSS_RPC_URL = "wss://ws-rpc.mainnet.lukso.network";
const WSS_RPC_URL = import.meta.env.VITE_LUKSO_WSS_RPC_URL || DEFAULT_LUKSO_WSS_RPC_URL;
const MAX_RECENT_EVENTS = 10; 
const MAX_RECONNECT_ATTEMPTS = 5;

// Unified ABI Decoders sourced directly from LSP standards
const LSP1_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "from", type: "address" },
      { indexed: true, internalType: "uint256", name: "value", type: "uint256" },
      { indexed: true, internalType: "bytes32", name: "typeId", type: "bytes32" },
      { internalType: "bytes", name: "receivedData", type: "bytes" },
      { internalType: "bytes", name: "returnedValue", type: "bytes" },
    ],
    name: "UniversalReceiver",
    type: "event",
  },
];

const LSP7_RECEIVED_DATA_ABI = parseAbiParameters(
  "address caller, address from, address to, uint256 amount, bytes data"
);

const LSP8_RECEIVED_DATA_ABI = parseAbiParameters(
  "address caller, address from, address to, bytes32 tokenId, bytes data"
);

export const EVENT_TYPE_MAP = {
  // Map to the official standard keccak256("LSP0ValueReceived") identifier for UP value drops
  lyx_received: "0x9c4705229491d365fb5434052e12a386d6771d976bea61070a8c694e8affea3d", 
  follower_gained: "0x71e02f9f05bcd5816ec4f3134aa2e5a916669537ec6c77fe66ea595fabc2d51a", 
  follower_lost: "0x9d3c0b4012b69658977b099bdaa51eff0f0460f421fba96d15669506c00d1c4f",  
  lsp7_received: "0x20804611b3e2ea21c480dc465142210acf4a2485947541770ec1fb87dee4a55c", 
  lsp8_received: "0x0b084a55ebf70fd3c06fd755269dac2212c4d3f0f4d09079780bfa50c1b2984d", 
};

export const TYPE_ID_TO_EVENT_MAP = Object.fromEntries(
  Object.entries(EVENT_TYPE_MAP).map(([eventName, typeId]) => [
    typeId.toLowerCase(),
    eventName,
  ])
);

export default class LSP1EventService {
  constructor() {
    this.eventCallbacks = [];
    this.viemClient = null;
    this.unwatchEvent = null;
    this.listeningAddress = null;
    this.initialized = false;
    this.isSettingUp = false;
    this.shouldBeConnected = false;
    this.recentEvents = [];
    this.reconnectAttempts = 0;
    this.currentSetupId = 0;
    this.abortController = null;
  }

  async initialize() {
    if (this.initialized) return true;
    this.initialized = true;
    return true;
  }

  async setupEventListeners(address) {
    const logPrefix = `[LSP1 Setup Addr:${address?.slice(0, 6)}]`;
    
    if (!address || !isAddress(address)) {
      this.shouldBeConnected = false;
      return false;
    }

    if (this.listeningAddress?.toLowerCase() === address.toLowerCase() && this.unwatchEvent) {
      this.shouldBeConnected = true;
      return true;
    }

    // 1. Increment setup sequence ID to prevent race conditions during fast toggles
    const setupId = ++this.currentSetupId;

    // 2. Tear down the previous connection instance, abort pending requests, and close active sockets
    this.cleanupListeners(); 

    // 3. Initialize the new AbortController for the current setup attempt
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    this.isSettingUp = true;
    this.shouldBeConnected = true;
    this.listeningAddress = address;

    if (signal.aborted || setupId !== this.currentSetupId) {
      this.isSettingUp = false;
      return false;
    }

    try {
      console.log(`${logPrefix} Connecting WebSocket to watch updates on RPC: ${WSS_RPC_URL}`);
      this.viemClient = createPublicClient({
        chain: lukso,
        transport: webSocket(WSS_RPC_URL, {
          keepAlive: true,
          retryCount: 3,
          timeout: 40000, 
        }),
      });

      if (signal.aborted || setupId !== this.currentSetupId) {
        this.isSettingUp = false;
        return false;
      }

      // Verify that the address contains bytecode (valid contract check to avoid EOA listener crashes)
      const bytecode = await this.viemClient.getBytecode({ address });
      if (signal.aborted || setupId !== this.currentSetupId) {
        return false;
      }

      if (!bytecode || bytecode === "0x") {
        console.warn(`${logPrefix} Target profile address has no deployed bytecode. UniversalReceiver aborted (EOA or undeployed contract detected).`);
        this.isSettingUp = false;
        this.shouldBeConnected = false;
        return false;
      }

      this.unwatchEvent = this.viemClient.watchContractEvent({
        address: this.listeningAddress,
        abi: LSP1_ABI,
        eventName: "UniversalReceiver",
        onLogs: (logs) => {
          this.reconnectAttempts = 0; // Clear connection error counters
          if (import.meta.env.DEV) console.log(`${logPrefix} Received ${logs.length} contract events.`);
          
          logs.forEach((log) => {
            if (log.removed) return;
            if (signal.aborted || setupId !== this.currentSetupId) return;

            try {
              const decodedLog = decodeEventLog({
                abi: LSP1_ABI,
                data: log.data,
                topics: log.topics,
              });

              if (decodedLog.eventName === "UniversalReceiver" && decodedLog.args) {
                this.handleUniversalReceiver(decodedLog.args, log);
              }
            } catch (e) {
              if (import.meta.env.DEV) console.error(`Log decode error:`, e);
            }
          });
        },
        onError: (error) => {
          if (signal.aborted || setupId !== this.currentSetupId) return;

          console.error(`${logPrefix} WebSocket Stream dropped:`, error);
          if (this.unwatchEvent) {
            try {
              this.unwatchEvent();
            } catch (e) {}
            this.unwatchEvent = null; 
          }
          this.handleReconnect(address);
        },
      });

      if (import.meta.env.DEV) console.log(`${logPrefix} WebSocket event service active.`);
      if (setupId === this.currentSetupId) {
        this.isSettingUp = false;
      }
      return true;
    } catch (error) {
      if (signal.aborted || setupId !== this.currentSetupId) {
        return false;
      }
      console.error(`${logPrefix} WebSocket Stream initialization failed:`, error);
      this.handleReconnect(address);
      this.isSettingUp = false;
      this.shouldBeConnected = false;
      return false;
    }
  }

  handleReconnect(address) {
    if (!this.shouldBeConnected) return;

    if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      console.log(`[LSP1] Reconnecting stream (${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${delay}ms...`);

      setTimeout(() => {
        const activeAddress = this.listeningAddress;
        if (this.shouldBeConnected && activeAddress) {
          this.setupEventListeners(activeAddress);
        }
      }, delay);
    } else {
      console.error("[LSP1] Critical: Maximum reconnection attempts reached. Listener inactive.");
    }
  }

  cleanupListeners() {
    this.shouldBeConnected = false;
    this.isSettingUp = false;

    // Abort active setup processes
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    // Unsubscribe from events
    if (this.unwatchEvent) {
      try {
        this.unwatchEvent();
      } catch (e) {}
      this.unwatchEvent = null;
    }

    // Safely retrieve the underlying socket object and close the connection
    const clientToClose = this.viemClient;
    if (clientToClose && typeof clientToClose.transport?.getSocket === 'function') {
      clientToClose.transport.getSocket()
        .then((socket) => {
          if (socket && typeof socket.close === 'function') {
            if (import.meta.env.DEV) console.log("[LSP1] Disposing of underlying active WebSocket transport...");
            socket.close(); // Cleanly close the connection
          }
        })
        .catch((err) => {
          if (import.meta.env.DEV) {
            console.warn("[LSP1] Error cleaning up transport connection:", err);
          }
        });
    }

    this.viemClient = null;
    this.recentEvents = [];
  }

  handleUniversalReceiver(eventArgs, log = null) {
    if (!eventArgs || typeof eventArgs !== "object" || !eventArgs.typeId) return;

    const { from, value, typeId, receivedData } = eventArgs;
    const lowerCaseTypeId = typeId?.toLowerCase();

    if (!lowerCaseTypeId) return;

    const stringValue = value?.toString() ?? "0";
    const eventTypeName = TYPE_ID_TO_EVENT_MAP[lowerCaseTypeId] || "unknown_event";

    // Deduplication filter
    if (this.isDuplicateEvent(typeId, from, stringValue, receivedData, log)) {
      return;
    }

    let actualSender = from || "0xUNKNOWN";
    let decodedPayload = {};

    // Standard LSP7/LSP8 sender decoding
    if (
      (eventTypeName === "lsp7_received" || eventTypeName === "lsp8_received") &&
      typeof receivedData === "string" &&
      receivedData !== "0x"
    ) {
      const abiToUse = eventTypeName === "lsp7_received" ? LSP7_RECEIVED_DATA_ABI : LSP8_RECEIVED_DATA_ABI;
      try {
        const decodedDataArray = decodeAbiParameters(abiToUse, receivedData);
        if (decodedDataArray && decodedDataArray.length > 1 && isAddress(decodedDataArray[1])) {
          actualSender = getAddress(decodedDataArray[1]);
        }
      } catch (decodeError) {
        if (import.meta.env.DEV) console.error(`[LSP1] receivedData decode failed:`, decodeError);
      }
    }

    // Custom follower decoding
    if (eventTypeName === "follower_gained" || eventTypeName === "follower_lost") {
      if (typeof receivedData === "string" && isAddress(receivedData)) {
        decodedPayload.followerAddress = getAddress(receivedData);
      }
    }

    const eventObj = {
      id: `event_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      timestamp: Date.now(),
      type: eventTypeName,
      typeId: lowerCaseTypeId,
      data: receivedData || "0x",
      sender: actualSender,
      value: stringValue,
      read: false,
      decodedPayload: decodedPayload,
    };

    this.notifyEventListeners(eventObj);
  }

  isDuplicateEvent(typeId, from, value, data, log = null) {
    let eventIdentifier;
    if (log && log.transactionHash && log.logIndex !== undefined) {
      const logIdentifier = `${log.transactionHash}-${log.logIndex}`;
      eventIdentifier = logIdentifier;
    } else {
      eventIdentifier = `${typeId}-${from}-${value}-${data || "0x"}`;
    }

    if (this.recentEvents.includes(eventIdentifier)) {
      return true;
    }
    this.recentEvents.push(eventIdentifier);
    if (this.recentEvents.length > MAX_RECENT_EVENTS) {
      this.recentEvents.shift();
    }
    return false;
  }

  onEvent(callback) {
    if (typeof callback === "function") {
      if (!this.eventCallbacks.includes(callback)) {
        this.eventCallbacks.push(callback);
      }
    }
    return () => {
      this.eventCallbacks = this.eventCallbacks.filter((cb) => cb !== callback);
    };
  }

  notifyEventListeners(event) {
    if (!event || !event.type) return;
    this.eventCallbacks.slice().forEach((callback) => {
      try {
        callback(event);
      } catch (e) {
        console.error(`Error in event callback:`, e);
      }
    });
  }

  async simulateEvent(eventType) {
    if (!eventType || typeof eventType !== "string") return false;
    const normalizedEventType = eventType.toLowerCase().replace(/[-_\s]/g, "");

    let typeId;
    let readableName;

    const typeIdEntryByName = Object.entries(EVENT_TYPE_MAP).find(
      ([key]) => key.toLowerCase().replace(/[-_\s]/g, "") === normalizedEventType
    );

    if (typeIdEntryByName) {
      readableName = typeIdEntryByName[0];
      typeId = typeIdEntryByName[1];
    } else {
      const typeIdEntryById = Object.entries(TYPE_ID_TO_EVENT_MAP).find(
        ([id]) => id.toLowerCase() === normalizedEventType
      );
      if (typeIdEntryById) {
        typeId = typeIdEntryById[0];
        readableName = typeIdEntryById[1];
      } else {
        return false;
      }
    }

    const simulatedArgs = {
      from: "0xf01103E5a9909Fc0DBe8166dA7085e0285daDDcA",
      value: readableName.includes("lyx") ? 1000000000000000000n : 0n,
      typeId: typeId,
      receivedData: readableName.includes("follower") ? "0xd8dA6Bf26964AF9D7eed9e03e53415D37aA96045" : "0x",
      returnedValue: "0x",
    };

    try {
      this.handleUniversalReceiver(simulatedArgs);
      return true;
    } catch (error) {
      return false;
    }
  }
}