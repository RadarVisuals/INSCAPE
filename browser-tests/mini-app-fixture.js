import { createClientUPProvider } from '@lukso/up-provider';
const provider = createClientUPProvider();
window.miniAppFixture = { provider };
document.body.innerHTML = '<main style="font:14px sans-serif;padding:20px;background:#171b1b;color:#eee;height:100vh;box-sizing:border-box"><h1>Mini app compatibility fixture</h1><p id="context"></p><p id="account"></p><button id="mic">Start microphone</button><p id="media"></p></main>';
const render = async () => {
  document.querySelector('#account').textContent = `Connected: ${(await provider.request({ method: 'eth_accounts' }))[0] || 'none'}`;
  document.querySelector('#context').textContent = `Desktop: ${provider.contextAccounts[0] || 'none'}`;
};
provider.on('accountsChanged', render); provider.on('contextAccountsChanged', render);
window.miniAppFixture.render = render;
render().catch(error => { document.querySelector('#account').textContent = error.message; });
document.querySelector('#mic').onclick = async () => {
  try {
    window.miniAppFixture.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    document.querySelector('#media').textContent = 'Microphone active';
  } catch { document.querySelector('#media').textContent = 'Microphone unavailable'; }
};
