import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ARTWORK_DOCUMENT_HTML, ARTWORK_DOCUMENT_HEADERS, ARTWORK_DOCUMENT_PATH } from '../scripts/artworkDocumentHost.js';
const root = path.resolve('output/nomad-retention');
const fixture = await readFile('browser-tests/svg-retention-fixture.jsx', 'utf8');
const probe = fixture.slice(fixture.indexOf('function probe()'), fixture.indexOf('const delay ='));
for (const name of ['compact', 'original']) {
  const svg = await readFile(path.join(root, name + '.svg'), 'utf8');
  await writeFile(path.join(root, name + '-probe.svg'), svg.replace(/<svg\b[^>]*>/,
    match => match + `<script><![CDATA[${probe};probe();]]></script>`));
}
await build({ configFile:false, publicDir:false, plugins:[react()], logLevel:'warn', build:{
  outDir:path.join(root,'site'), emptyOutDir:false, rollupOptions:{input:['browser-tests/svg-retention-fixture.html','browser-tests/svg-lifecycle-fixture.html']},
} });
await writeFile(path.join(root, 'site/direct.html'), await readFile('browser-tests/nomad-visibility-fixture.html'));
const diagnostics = `<script>for(const type of ['securitypolicyviolation','error'])addEventListener(type,e=>top.postMessage({type:'retention-diagnostic',event:type,message:e.message,directive:e.violatedDirective,blocked:e.blockedURI},'*'));</script>`;
createServer(async(req,res)=>{
  try {
    const pathname = new URL(req.url,'http://127.0.0.1').pathname;
    if(pathname===ARTWORK_DOCUMENT_PATH){ res.writeHead(200,ARTWORK_DOCUMENT_HEADERS).end(ARTWORK_DOCUMENT_HTML.replace('<script>',diagnostics+'<script>'));return; }
    if(pathname==='/results' && req.method==='POST'){
      let body=''; for await(const chunk of req){body+=chunk;if(body.length>100000)throw Error('Too large');}
      const data=JSON.parse(body); if(!['compact','original'].includes(data.asset)||!['retain','dispose'].includes(data.mode))throw Error('Invalid result');
      await writeFile(path.join(root,`${data.asset}-${data.mode}.json`),JSON.stringify(data,null,2));res.end('{}');return;
    }
    const name=pathname.startsWith('/output/nomad-retention/')?pathname.slice('/output/nomad-retention/'.length):'site'+pathname;
    const target=path.resolve(root,name);if(!target.startsWith(root+path.sep))throw Error('Invalid path');
    const data=await readFile(target);const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
    res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);
  }catch(error){res.writeHead(404).end(error.message);}
}).listen(0,'127.0.0.1',function(){console.log('RETENTION_TEST=http://127.0.0.1:'+this.address().port+'/browser-tests/svg-retention-fixture.html');});
