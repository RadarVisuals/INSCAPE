import { readFile, writeFile } from 'node:fs/promises';
const folder = process.argv[2] || '.browser-test-runtime/nomad-study/benchmark';
const raw = JSON.parse(await readFile(folder + '/results.json', 'utf8'));
const median = values => values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];
const range = values => [Math.min(...values), Math.max(...values)];
const summary = [];
for (const name of [...new Set(raw.results.map(r => r.case.name))]) {
  const results = raw.results.filter(r => r.case.name === name);
  const phases = phase => results.map(r => r.phases.find(p => p.name === phase));
  const cpu = (phase, type) => phases(phase).map(p => (p.processCpuMs[type] || 0) / p.durationMs * 100);
  const frames = phases('idle-30').flatMap(p => p.nomads.filter(n => n.running));
  summary.push({ name, runs: results.length,
    overviewRendererPercent: median(cpu('idle-30', 'renderer')), rendererRange: range(cpu('idle-30', 'renderer')),
    gpuProcessCpuPercent: median(cpu('idle-30', 'GPU')), gpuProcessCpuRange: range(cpu('idle-30', 'GPU')),
    overviewCombinedCpuPercent: median(phases('idle-30').map(p => ((p.processCpuMs.renderer || 0) + (p.processCpuMs.GPU || 0)) / p.durationMs * 100)),
    fullSizeRendererPercent: median(cpu('idle-100', 'renderer')), fullSizeGpuProcessCpuPercent: median(cpu('idle-100', 'GPU')),
    quietRendererPercent: median(cpu('quiet-idle', 'renderer')), quietGpuProcessCpuPercent: median(cpu('quiet-idle', 'GPU')),
    updateHz: frames.length ? median(frames.map(n => n.updatesPerSecond)) : 0,
    callbackHz: frames.length ? median(frames.map(n => n.callbacksPerSecond)) : 0,
    clockRatioRange: frames.length ? range(frames.map(n => n.clockRatio)) : null,
    paintP95Ms: frames.length ? median(frames.map(n => n.paintIntervals.p95)) : 0,
    mainRafP95Ms: median(phases('idle-30').map(p => p.frameMs.p95)),
    zoomRafP95Ms: median(phases('zoom-pan').map(p => p.frameMs.p95)),
    zoomMaxMs: Math.max(...phases('zoom-pan').map(p => p.frameMs.max)),
    zoomLongTasks: phases('zoom-pan').map(p => p.longTasks.length),
    rendererPrivateMiB: median(results.map(r => r.processMemory.filter(p => p.type === 'renderer').reduce((s, p) => s + p.PrivateMemorySize64, 0) / 1024 ** 2)),
    gpuProcessPrivateMiB: median(results.map(r => r.processMemory.filter(p => p.type === 'GPU').reduce((s, p) => s + p.PrivateMemorySize64, 0) / 1024 ** 2)),
    stoppedAfterSwitch: results.every(r => r.frameEvidence.quietFrames.length === 0),
    stationaryUploads: phases('idle-30').every(p => p.nomads.every(n => n.newUploads === 0)),
    stationaryAllocations: phases('idle-30').every(p => p.nomads.every(n => n.newAllocations === 0)),
    buffers: phases('idle-30')[0].nomads.map(n => n.buffer), errors: results.flatMap(r => r.errors),
  });
}
const first = raw.results[0].phases.find(p => p.name === 'idle-30').nomads[0];
const mipPixels = (w, h) => { let total = w * h; while (w > 1 || h > 1) { w = Math.max(1, Math.floor(w / 2)); h = Math.max(1, Math.floor(h / 2)); total += w * h; } return total; };
const texturePixels = first.textures.reduce((s, t) => s + t.width * t.height, 0);
const textureRGBAWithMipsMiB = first.textures.reduce((s, t) => s + mipPixels(t.width, t.height) * 4, 0) / 1024 ** 2;
const report = { machine: raw.machine, gpu: first.gpu, texturePixels, textureRGBAWithMipsMiB,
  triangles: first.textures.reduce((s, t) => s + t.triangles, 0), summary };
await writeFile(folder + '/nomad-summary.json', JSON.stringify(report, null, 2));
console.table(summary.map(s => ({ case: s.name, n: s.runs, renderer: s.overviewRendererPercent.toFixed(1),
  GPUprocessCPU: s.gpuProcessCpuPercent.toFixed(1), combined: s.overviewCombinedCpuPercent.toFixed(1),
  Hz: s.updateHz.toFixed(1), paintP95: s.paintP95Ms.toFixed(1), zoomP95: s.zoomRafP95Ms.toFixed(1) })));
