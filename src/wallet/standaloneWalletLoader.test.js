import test from 'node:test';
import assert from 'node:assert/strict';
import { createStandaloneWalletLoader, hasPersistedStandaloneConnection } from './standaloneWalletLoader.js';

test('only absent or explicitly disconnected Wagmi records skip automatic loading', () => {
  const check = raw => hasPersistedStandaloneConnection(() => ({ getItem(key) { assert.equal(key, 'inscape-up.store'); return raw; } }));
  assert.equal(check(null), false);
  assert.equal(check(JSON.stringify({ state: { current:null, connections:{__type:'Map',value:[]} } })), false);
  assert.equal(check(JSON.stringify({ state: { current:'connector', connections:{__type:'Map',value:[['connector',{}]]} } })), true);
  assert.equal(check('{broken'), true);
  assert.equal(check('{}'), true);
  assert.equal(hasPersistedStandaloneConnection(() => { throw Error('storage denied'); }), true);
});

test('loading is deferred, concurrent Connect requests share one session, release is idempotent', async () => {
  let loads=0, acquisitions=0, releases=0;
  const options={}, session={};
  const loader=createStandaloneWalletLoader(options,{ load:async()=>{
    loads++;
    return { acquireStandaloneWalletSession(received) { acquisitions++; assert.equal(received,options); return { session:Promise.resolve(session), release(){releases++;} }; } };
  } });
  assert.equal(loads,0);
  const first=loader.getSession(), second=loader.getSession();
  assert.equal(first,second);
  assert.equal(await first,session);
  assert.equal(loads,1); assert.equal(acquisitions,1);
  loader.release(); loader.release();
  assert.equal(releases,1);
  assert.equal(await loader.getSession(),null);
});

test('unmount during import never acquires a wallet; unmount during setup releases its acquisition', async () => {
  let complete, acquired=0;
  const loader=createStandaloneWalletLoader({}, { load:()=>new Promise(resolve=>{complete=resolve;}) });
  const pending=loader.getSession(); loader.release();
  complete({ acquireStandaloneWalletSession(){acquired++;} });
  assert.equal(await pending,null); assert.equal(acquired,0);
  let ready, released=0;
  const initializing=createStandaloneWalletLoader({}, { load:async()=>({ acquireStandaloneWalletSession:()=>({
    session:new Promise(resolve=>{ready=resolve;}), release(){released++;}
  }) }) });
  const setup=initializing.getSession(); await Promise.resolve();
  initializing.release(); ready({});
  assert.equal(await setup,null); assert.equal(released,1);
});

test('import and session failures allow a later Connect retry', async () => {
  for (const stage of ['import','session']) {
    let calls=0, releases=0;
    const session={};
    const loader=createStandaloneWalletLoader({}, { load:async()=>{
      calls++;
      if (calls===1 && stage==='import') throw Error('download failed');
      return { acquireStandaloneWalletSession:()=>({
        session:calls===1 ? Promise.reject(Error('setup failed')) : Promise.resolve(session),
        release(){releases++;}
      }) };
    } });
    await assert.rejects(loader.getSession());
    assert.equal(await loader.getSession(),session);
    assert.equal(calls,2);
    loader.release(); assert.equal(releases,stage==='import'?1:2);
  }
});
