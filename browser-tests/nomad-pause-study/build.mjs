import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFile, readFile } from 'node:fs/promises';
import { excludeUnsupportedWalletConnectorsPlugin } from '../../scripts/unsupportedWalletConnectors.js';
import { svgStudy } from '../fixtures/animation-study.mjs';
const output = '../../nomad-pause-investigation-2026-10-21';
await writeFile(output + '/study-media/keeper.svg', svgStudy(await readFile('browser-tests/fixtures/keeper-layered.svg','utf8'), {mode:'static'}));
// Test bundle only: resolve local media without network interception. Production
// URL validation and the production build configuration are untouched.
const localMedia = {name:'isolated-loopback-test-media',enforce:'pre',async load(id){
 if(id.endsWith('/src/miniApps/MiniAppsWorkbench.jsx'))return (await readFile(id,'utf8')).replaceAll('allowLocal: import.meta.env.DEV','allowLocal: true');
 if(!id.endsWith('/src/profileDocument/domain/publishedAssetUrl.js'))return;
 return (await readFile(id,'utf8')).replace("url.protocol !== 'https:'", "(url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port === '29959'))");
}};
await build({configFile:false,logLevel:'warn',publicDir:false,plugins:[localMedia,react(),excludeUnsupportedWalletConnectorsPlugin()],
 define:{__INSCAPE_RELEASE_COMMIT__:JSON.stringify('local-nomad-pause-investigation')},
 build:{outDir:output+'/workbench-dist',emptyOutDir:false,sourcemap:true,rollupOptions:{input:'browser-tests/nomad-pause-study/index.html'}}});
