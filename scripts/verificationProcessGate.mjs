// Only the directly owned Node command participates. Inherited test-worker or
// nested-process preloads have another parent and must not wait on this IPC.
const nonce = process.env.INSCAPE_VERIFY_GATE_NONCE;
if (nonce && process.ppid === Number(process.env.INSCAPE_VERIFY_PARENT_PID) && typeof process.send === 'function') {
  let expectedDisconnect = false;
  process.on('disconnect', () => {
    if (!expectedDisconnect) { console.error('Verification parent disconnected before completion'); process.exit(1); }
  });
  const exchange = phase => new Promise((resolve, reject) => {
    const finish = error => {
      clearTimeout(timer); process.off('message', receive);
      if (error) reject(error); else resolve();
    };
    const receive = message => {
      if (message?.type === 'inscape-verification-ack' && message.nonce === nonce && message.phase === phase) finish();
    };
    const timer = setTimeout(() => finish(Error(`Verification ${phase} acknowledgement timed out`)), 30_000);
    process.on('message', receive);
    process.send({ type: 'inscape-verification-gate', nonce, phase }, error => { if (error) finish(error); });
  });
  await exchange('start');
  process.channel?.unref();
  process.once('beforeExit', () => {
    process.channel?.ref();
    exchange('complete').catch(error => { console.error(error.message); process.exitCode = 1; })
      .finally(() => { expectedDisconnect = true; if (process.connected) process.disconnect(); });
  });
}
