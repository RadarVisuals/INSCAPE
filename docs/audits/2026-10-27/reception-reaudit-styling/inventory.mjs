import fs from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';
const root=process.cwd(),out=import.meta.dirname;
async function walk(dir){const r=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())r.push(...await walk(p));else if(/\.(jsx?|tsx?|css)$/.test(p))r.push(p);}return r;}
const files=await walk(path.join(root,'src')),sources=new Map(await Promise.all(files.map(async f=>[path.relative(root,f).replaceAll('\\','/'),await fs.readFile(f,'utf8')]))),imports=[];
for(const [file,code]of sources){for(const re of [/\b(?:import|export)\s+(?:[^;]*?\s+from\s*)?['"]([^'"]+)['"]/g,/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,/@import\s+['"]([^'"]+)['"]/g])for(const m of code.matchAll(re)){if(!m[1].startsWith('.'))continue;const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),m[1]));imports.push({from:file,to:target,kind:m[0].startsWith('import(')||/^import\s+\(/.test(m[0])?'lazy':'static',line:code.slice(0,m.index).split('\n').length});}}
const roots=['src/reception/ReceptionOverview.jsx','src/reception/OwnerReception.jsx','src/reception/ReceptionEditor.jsx','src/reception/ReceptionProfileEditor.jsx','src/text/SharedTextTools.jsx','src/colour/CommittedColourControls.jsx','src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx'];
function closure(entry,includeLazy=false){const visited=new Set();function visit(f){if(visited.has(f))return;visited.add(f);imports.filter(i=>i.from===f&&(includeLazy||i.kind==='static')).forEach(i=>visit(i.to));}visit(entry);return [...visited];}
const scopes=Object.fromEntries(roots.map(f=>[f,{staticCss:closure(f).filter(f=>f.endsWith('.css')),lazyCss:closure(f,true).filter(f=>f.endsWith('.css'))}]));
const used=new Set(Object.values(scopes).flatMap(v=>v.lazyCss)),css=[];
for(const file of used){const content=sources.get(file);if(content===undefined)continue;const ast=postcss.parse(content,{from:file}),rules=[],important=[],repeatedDeclarations=[];
ast.walkRules(r=>{let parents=[];for(let p=r.parent;p&&p.type!=='root';p=p.parent)if(p.type==='atrule')parents.unshift('@'+p.name+' '+p.params);rules.push({selector:r.selector,context:parents.join(' / '),line:r.source.start.line});const seen=new Set();for(const d of r.nodes.filter(n=>n.type==='decl')){if(d.important)important.push({selector:r.selector,property:d.prop,line:d.source.start.line});if(seen.has(d.prop))repeatedDeclarations.push({selector:r.selector,property:d.prop,line:d.source.start.line});seen.add(d.prop);}});
const groups=Object.groupBy(rules,r=>r.context+'::'+r.selector);
css.push({file,bytes:Buffer.byteLength(content),lines:content.split('\n').length,rules:rules.length,important,repeatedSelectors:Object.values(groups).filter(a=>a.length>1),repeatedDeclarations,importers:imports.filter(i=>i.to===file),selectors:rules});
}
const result={note:'Static source inventory; repeated selectors are candidates, not automatically dead/incorrect. Lazy transitive graph includes unrelated reachable runtime modules; use route-specific production graphs for budgets.',scopes,css,imports:imports.filter(i=>/reception|text|colour|identityModule|workflowTokens|workflowTactile|workflowFlat|workbenchToolChrome|workbenchToolPanel|workbenchSharedTools|libraryWorkspace/.test(i.from+' '+i.to))};
await fs.writeFile(path.join(out,'stylesheet-inventory.json'),JSON.stringify(result,null,2));
await fs.copyFile('dist/bundle-report.json',path.join(out,'bundle-report.json'));await fs.copyFile('dist/owner-runtime-graph.json',path.join(out,'owner-runtime-graph.json'));
console.log(JSON.stringify({scopes,focus:css.filter(c=>/reception.css|workflowTokens|workflowTactile|workflowFlat|workbenchToolChrome|workbenchToolPanel|workbenchSharedTools|identityModule.css|colourControls.css|textTools.css|profileOverview.css/.test(c.file)).map(({file,bytes,lines,rules,important,repeatedSelectors,repeatedDeclarations})=>({file,bytes,lines,rules,important:important.length,repeatedSelectors:repeatedSelectors.length,repeatedDeclarations:repeatedDeclarations.length}))},null,2));

