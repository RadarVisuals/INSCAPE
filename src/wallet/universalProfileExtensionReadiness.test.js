import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ensureUniversalProfileExtensionConnector,
  UNIVERSAL_PROFILE_EXTENSION_RDNS
} from './universalProfileExtensionReadiness.js';

const createWindowHarness = () => {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      const current = listeners.get(type) ?? [];
      listeners.set(type, [...current, listener]);
    },
    removeEventListener(type, listener) {
      listeners.set(type, (listeners.get(type) ?? []).filter((candidate) => candidate !== listener));
    },
    dispatchEvent(event) {
      for (const listener of listeners.get(event.type) ?? []) listener(event);
      return true;
    },
    listenerCount(type) {
      return (listeners.get(type) ?? []).length;
    }
  };
};

const announceProvider = (windowObject, provider = { request() {} }) => {
  const event = new Event('eip6963:announceProvider');
  Object.defineProperty(event, 'detail', {
    value: {
      info: {
        rdns: UNIVERSAL_PROFILE_EXTENSION_RDNS,
        name: 'Universal Profile',
        uuid: 'test-universal-profile-provider'
      },
      provider
    }
  });
  windowObject.dispatchEvent(event);
};

test('uses an already registered Universal Profile connector without provider discovery', async () => {
  const windowObject = createWindowHarness();
  const wagmiConfig = { connectors: [{ id: UNIVERSAL_PROFILE_EXTENSION_RDNS }] };

  assert.equal(await ensureUniversalProfileExtensionConnector({ wagmiConfig, windowObject }), true);
  assert.equal(windowObject.listenerCount('eip6963:announceProvider'), 0);
});

test('registers an announced Universal Profile provider through the Wagmi connector store', async () => {
  const windowObject = createWindowHarness();
  const wagmiConfig = { connectors: [] };
  const connectorStore = {
    providerDetailToConnector(detail) {
      return () => ({ id: detail.info.rdns, rdns: detail.info.rdns });
    },
    setup(connectorFactory) {
      return connectorFactory();
    },
    setState(update) {
      wagmiConfig.connectors = update(wagmiConfig.connectors);
    }
  };
  wagmiConfig._internal = { connectors: connectorStore };

  windowObject.addEventListener('eip6963:requestProvider', () => announceProvider(windowObject));

  assert.equal(await ensureUniversalProfileExtensionConnector({ wagmiConfig, windowObject }), true);
  assert.deepEqual(wagmiConfig.connectors.map(({ id }) => id), [UNIVERSAL_PROFILE_EXTENSION_RDNS]);
  assert.equal(windowObject.listenerCount('eip6963:announceProvider'), 0);
});

test('does not duplicate a connector that Wagmi registers from the same announcement', async () => {
  const windowObject = createWindowHarness();
  const wagmiConfig = { connectors: [] };
  let manualSetupCalls = 0;
  wagmiConfig._internal = {
    connectors: {
      providerDetailToConnector() {
        manualSetupCalls += 1;
      },
      setup() {},
      setState() {}
    }
  };

  windowObject.addEventListener('eip6963:requestProvider', () => {
    wagmiConfig.connectors = [{ id: UNIVERSAL_PROFILE_EXTENSION_RDNS }];
    announceProvider(windowObject);
  });

  assert.equal(await ensureUniversalProfileExtensionConnector({ wagmiConfig, windowObject }), true);
  assert.equal(manualSetupCalls, 0);
});

test('times out cleanly and leaves mobile sign-in available when no extension announces', async () => {
  const windowObject = createWindowHarness();
  const wagmiConfig = { connectors: [] };

  assert.equal(
    await ensureUniversalProfileExtensionConnector({ wagmiConfig, windowObject, timeoutMs: 5 }),
    false
  );
  assert.equal(windowObject.listenerCount('eip6963:announceProvider'), 0);
});
