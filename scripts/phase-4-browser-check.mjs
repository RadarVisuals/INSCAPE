import WebSocket from 'ws';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const tabs = await fetch('http://127.0.0.1:9222/json').then((response) => response.json());
const tab = tabs.find((entry) => entry.type === 'page' && (entry.url.startsWith('http://127.0.0.1:5173') || entry.url.startsWith('http://127.0.0.1:5174') || entry.title === '127.0.0.1'));
if (!tab) throw new Error('OS_UNDERNEATH tab not found');
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
let id = 0; const pending = new Map();
socket.on('message', (raw) => { const message = JSON.parse(raw); const waiter = pending.get(message.id); if (!waiter) return; pending.delete(message.id); message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result); });
const send = (method, params = {}) => new Promise((resolve, reject) => { const requestId = ++id; pending.set(requestId, { resolve, reject }); socket.send(JSON.stringify({ id: requestId, method, params })); });
const evaluate = async (expression) => { const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (response.exceptionDetails) throw new Error(`${response.exceptionDetails.exception?.description || response.exceptionDetails.text}\n${expression.slice(0, 160)}`); return response.result.value; };
const waitFor = async (expression, label, timeout = 20_000) => { const start = Date.now(); while (Date.now() - start < timeout) { if (await evaluate(expression)) return; await delay(150); } throw new Error(`Timed out: ${label}`); };
const clickText = (text) => evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}))?.click()`);
const enter = async () => { await waitFor(`[...document.querySelectorAll('button')].some(b=>/enter/i.test(b.textContent))`, 'Enter control'); await clickText('enter'); await waitFor(`document.querySelector('.application-interface')?.dataset.visible==='true'`, 'revealed public interface', 30_000); await waitFor(`[...document.querySelectorAll('button')].some(b=>/share/i.test(b.textContent))`, 'public HUD'); };

await send('Runtime.enable');
await send('Page.navigate', { url: 'http://127.0.0.1:5174/' }); await delay(1200);
const pageState = await evaluate(`({href:location.href,origin:location.origin,title:document.title,body:document.body?.innerText?.slice(0,200)})`);
if (pageState.origin !== 'http://127.0.0.1:5174') throw new Error(`Unexpected page context: ${JSON.stringify(pageState)}`);
const profile = '0xf3c189819fd5b042f692983bFbFD57ab607ee709'.toLowerCase();
const assetA = '42:0x1111111111111111111111111111111111111111:0x01';
const assetB = '42:0x2222222222222222222222222222222222222222:0x02';
const workspace = { version: 3, profileAddress: profile, favorites: ['private-favorite'], folders: [
  { id: 'journey-one', name: 'Journey One', assetIds: [assetA, assetB], createdAt: 1, updatedAt: 2 },
  { id: 'journey-two', name: 'Journey Two', assetIds: [assetA], createdAt: 3, updatedAt: 4 },
  { id: 'private-journal', name: 'Private Journal', assetIds: ['private-reference'], createdAt: 5, updatedAt: 6 }
], canvas: { launchers: [
  { id: 'library:folder:journey-one', viewType: 'folder', folderId: 'journey-one', visitorVisible: true, position: { column: 1, row: 4 }, windowPosition: { column: 1, row: 2 } },
  { id: 'library:folder:journey-two', viewType: 'folder', folderId: 'journey-two', visitorVisible: true, position: { column: 3, row: 5 }, windowPosition: { column: 2, row: 3 } }
] } };
const signalDocument = { version: 1, profileAddress: profile, initialized: true, knownSignalIds: ['private-known'], history: [{ id: 'private-history', type: 'UNKNOWN_ACTIVITY', timestamp: 1, profileAddress: profile }], settings: { notifications: true, speech: true, visualEffects: true, audio: false } };
await evaluate(`localStorage.clear(); localStorage.setItem('os-underneath.library-workspace.v3:${profile}',${JSON.stringify(JSON.stringify(workspace))}); localStorage.setItem('os-underneath.keeper-signals.v1:${profile}',${JSON.stringify(JSON.stringify(signalDocument))}); location.reload()`);
await enter();

await clickText('share'); await waitFor(`!!document.querySelector('.profile-document-panel')`, 'Share panel');
await clickText('build snapshot'); await waitFor(`document.querySelector('.profile-document-panel')?.textContent.includes('DOCUMENT VALID')`, 'valid snapshot');
const summary = await evaluate(`({text:document.querySelector('.profile-document-panel').textContent, snapshot:localStorage.getItem('os-underneath.profile-snapshot.v1:${profile}')})`);
if (!summary.text.includes('Journey') && !summary.text.includes('Spaces2')) throw new Error(`Snapshot summary missing: ${summary.text}`);
const exported = JSON.parse(summary.snapshot); if (exported.spaces.length !== 2 || exported.spaces.some((space) => space.label === 'Private Journal')) throw new Error('Private/unpinned space leaked');
if (summary.snapshot.includes('private-known') || summary.snapshot.includes('private-history') || summary.snapshot.includes('private-favorite')) throw new Error('Private state leaked into snapshot');

await clickText('preview profile'); await waitFor(`!!document.querySelector('[data-preview-mode="visitor"]')`, 'snapshot visitor preview');
const preview = await evaluate(`({spaces:document.querySelectorAll('.profile-document-preview__spaces button').length,privateControls:[...document.querySelectorAll('button')].some(b=>/edit|import|restore|fixture/i.test(b.textContent)),identity:document.querySelector('.profile-document-preview__identity')?.textContent})`);
if (preview.spaces !== 2 || preview.privateControls || !preview.identity) throw new Error(JSON.stringify(preview));
await evaluate(`document.querySelector('.profile-document-preview__spaces button').click()`); await waitFor(`!!document.querySelector('.profile-document-space-window')`, 'document-backed space');
await clickText('exit preview'); await waitFor(`![...document.querySelectorAll('[data-preview-mode="visitor"]')].length`, 'exit snapshot preview');
const afterPreview = JSON.parse(await evaluate(`localStorage.getItem('os-underneath.library-workspace.v3:${profile}')`));
if (afterPreview.folders.find((folder) => folder.id === 'private-journal')?.assetIds[0] !== 'private-reference') throw new Error('Preview mutated draft');

await clickText('share'); await waitFor(`!!document.querySelector('.profile-document-panel')`, 'Share panel reopened');
await clickText('export profile');
await evaluate(`(()=>{const input=document.querySelector('.profile-document-panel input[type=file]');const file=new File([${JSON.stringify(summary.snapshot)}],'roundtrip.json',{type:'application/json'});const transfer=new DataTransfer();transfer.items.add(file);Object.defineProperty(input,'files',{configurable:true,value:transfer.files});input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
await waitFor(`document.querySelector('.profile-document-panel')?.textContent.includes('IMPORTED DOCUMENT')`, 'valid import');
await clickText('preview import'); await waitFor(`!!document.querySelector('[data-preview-mode="visitor"]')`, 'import visitor preview'); await clickText('exit preview');
await waitFor(`![...document.querySelectorAll('[data-preview-mode="visitor"]')].length`, 'exit import preview');
await clickText('share'); await waitFor(`!!document.querySelector('.profile-document-panel')`, 'Share before restore');
await evaluate(`window.confirm=()=>true`); await clickText('restore presentation'); await delay(500);
const afterRestore = await evaluate(`({workspace:JSON.parse(localStorage.getItem('os-underneath.library-workspace.v3:${profile}')),signals:JSON.parse(localStorage.getItem('os-underneath.keeper-signals.v1:${profile}')),presentation:JSON.parse(localStorage.getItem('os-underneath.restored-presentation.v1:${profile}'))})`);
if (!afterRestore.workspace.folders.some((folder) => folder.id === 'private-journal') || !afterRestore.workspace.favorites.includes('private-favorite') || !afterRestore.signals.knownSignalIds.includes('private-known') || !afterRestore.presentation.keeperId) throw new Error('Restore erased private state or did not persist');

await evaluate(`location.reload()`); await enter();
const persisted = await evaluate(`({launchers:JSON.parse(localStorage.getItem('os-underneath.library-workspace.v3:${profile}')).canvas.launchers.length,presentation:!!localStorage.getItem('os-underneath.restored-presentation.v1:${profile}')})`);
if (persisted.launchers !== 2 || !persisted.presentation) throw new Error('Restored presentation did not survive refresh');
await clickText('share'); await waitFor(`!!document.querySelector('.profile-document-panel')`, 'Share after refresh');
const beforeMalformed = await evaluate(`localStorage.getItem('os-underneath.library-workspace.v3:${profile}')`);
await evaluate(`(()=>{const input=document.querySelector('.profile-document-panel input[type=file]');const file=new File(['{bad'],'bad.json',{type:'application/json'});const transfer=new DataTransfer();transfer.items.add(file);Object.defineProperty(input,'files',{configurable:true,value:transfer.files});input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
await waitFor(`document.querySelector('.profile-document-panel__message')?.textContent.includes('Malformed JSON')`, 'malformed import error');
const malformedSafe = beforeMalformed === await evaluate(`localStorage.getItem('os-underneath.library-workspace.v3:${profile}')`); if (!malformedSafe) throw new Error('Malformed import changed workspace');
await evaluate(`document.querySelector('.profile-document-panel button[aria-label="Close Share"]')?.click()`);
await waitFor(`document.querySelector('button[aria-label="Open Collection module"]')&&!document.querySelector('button[aria-label="Open Collection module"]').disabled`, 'Collection launcher ready');
await evaluate(`document.querySelector('button[aria-label="Open Collection module"]')?.click()`); await waitFor(`!!document.querySelector('.collection-window')`, 'Collection regression');
await waitFor(`document.querySelector('button[aria-label="Open Signals module"]')&&!document.querySelector('button[aria-label="Open Signals module"]').disabled`, 'Signals launcher ready');
await evaluate(`document.querySelector('button[aria-label="Open Signals module"]')?.click()`); await waitFor(`!!document.querySelector('.signals-window')`, 'Signals regression');
await evaluate(`document.querySelector('.application-world canvas')?.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:300,clientY:300}))`);
const regressions = await evaluate(`({collection:!!document.querySelector('.collection-window'),signals:!!document.querySelector('.signals-window'),engineReady:!!window.__UNDERNEATH_ENGINE__})`);
if (!regressions.collection || !regressions.signals || !regressions.engineReady) throw new Error(JSON.stringify(regressions));
console.log(JSON.stringify({ summary: { spaces: exported.spaces.length, references: exported.spaces.reduce((sum, space) => sum + space.assets.length, 0) }, preview, persisted, malformedSafe, regressions }, null, 2));
socket.close();
