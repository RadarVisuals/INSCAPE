import { readFile, writeFile, stat } from 'node:fs/promises';
const folder = '.browser-test-runtime/nomad-export-study/benchmark';
const raw = JSON.parse(await readFile(folder + '/results.json', 'utf8'));
const median = a => a.toSorted((a, b) => a - b)[Math.floor(a.length / 2)];
const range = a => [Math.min(...a), Math.max(...a)];
const mips = (w, h) => { let n = w * h; while (w > 1 || h > 1) { w = Math.max(1, Math.floor(w / 2)); h = Math.max(1, Math.floor(h / 2)); n += w * h; } return n; };
const summary = [];
for (const name of [...new Set(raw.results.map(r => r.case.name))]) {
  const rows = raw.results.filter(r => r.case.name === name), first = rows[0];
  const phase = name => rows.map(r => r.phases.find(p => p.name === name));
  const cpu = name => phase(name).map(p => ((p.processCpuMs.renderer || 0) + (p.processCpuMs.GPU || 0)) / p.durationMs * 100);
  const active = phase('idle-30').flatMap(p => p.nomads.filter(n => n.running));
  const textures = phase('idle-30')[0].nomads[0].textures;
  summary.push({ name, variant: first.case.nomadVariant, active: first.case.nomadActive, runs: rows.length,
    bytes: (await stat(`output/nomad-export-study-2026-10-21/NOMAD-${first.case.nomadVariant}.svg`)).size,
    texturePixels: textures.reduce((n, t) => n + t.width * t.height, 0),
    textureRGBAWithMipsMiB: textures.reduce((n, t) => n + mips(t.width, t.height) * 4, 0) / 1024 ** 2,
    overviewCPU: median(cpu('idle-30')), overviewRange: range(cpu('idle-30')),
    fullViewCPU: median(cpu('idle-100')), quietCPU: median(cpu('quiet-idle')),
    rendererCPU: median(phase('idle-30').map(p => p.processCpuMs.renderer / p.durationMs * 100)),
    gpuProcessCPU: median(phase('idle-30').map(p => p.processCpuMs.GPU / p.durationMs * 100)),
    updatesHz: median(active.map(n => n.updatesPerSecond)), paintP95: median(active.map(n => n.paintIntervals.p95)),
    clockRatio: range(active.map(n => n.clockRatio)), mainRafP95: median(phase('idle-30').map(p => p.frameMs.p95)),
    zoomRafP95: median(phase('zoom-pan').map(p => p.frameMs.p95)), zoomMax: Math.max(...phase('zoom-pan').map(p => p.frameMs.max)),
    zoomLongTasks: phase('zoom-pan').map(p => p.longTasks.length),
    coldUIReadyMs: median(rows.map(r => r.coldReadyMs)),
    rendererPrivateMiB: median(rows.map(r => r.processMemory.filter(p => p.type === 'renderer').reduce((n, p) => n + p.PrivateMemorySize64, 0) / 1024 ** 2)),
    gpuProcessPrivateMiB: median(rows.map(r => r.processMemory.filter(p => p.type === 'GPU').reduce((n, p) => n + p.PrivateMemorySize64, 0) / 1024 ** 2)),
    idleLongTasks: phase('idle-30').reduce((n, p) => n + p.longTasks.length, 0),
    quietUnmounted: rows.every(r => r.frameEvidence.quietFrames.length === 0),
    stationaryUploads: phase('idle-30').every(p => p.nomads.every(n => n.newUploads === 0)),
    errors: rows.flatMap(r => r.errors), buffers: phase('idle-30')[0].nomads.map(n => n.buffer),
  });
}
const data = { machine: raw.machine, gpu: raw.results[0].phases[0].nomads[0].gpu, summary };
await writeFile(folder + '/summary.json', JSON.stringify(data, null, 2));
console.table(summary.map(s => ({ variant: s.variant, active: s.active, runs: s.runs, CPU: s.overviewCPU.toFixed(1),
  range: s.overviewRange.map(n => n.toFixed(1)).join('–'), textureMiB: s.textureRGBAWithMipsMiB.toFixed(1),
  Hz: s.updatesHz.toFixed(1), zoomP95: s.zoomRafP95.toFixed(1), rendererMiB: s.rendererPrivateMiB.toFixed(0) })));
