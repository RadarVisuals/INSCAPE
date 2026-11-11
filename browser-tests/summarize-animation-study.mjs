import { readFile, writeFile } from 'node:fs/promises';
const folder = process.argv[2] || '.browser-test-runtime/svg-animation-study/benchmark';
const raw = JSON.parse(await readFile(folder + '/results.json', 'utf8'));
const median = values => values.toSorted((a, b) => a-b)[Math.floor(values.length/2)];
const summary = [];
for (const name of [...new Set(raw.results.map(r => r.case.name))]) {
  const results = raw.results.filter(r => r.case.name === name);
  const phases = phase => results.map(r => r.phases.find(p => p.name === phase));
  const cpu = (phase, type = 'renderer') => phases(phase).map(p => (p.processCpuMs[type] || 0) / p.durationMs * 100);
  const overview = cpu('idle-30');
  summary.push({ name, runs: results.length,
    overviewRendererPercent: median(overview), overviewRange: [Math.min(...overview), Math.max(...overview)],
    fullSizeRendererPercent: median(cpu('idle-100')), quietRendererPercent: median(cpu('quiet-idle')),
    gpuProcessPercent: median(cpu('idle-30', 'GPU')),
    overviewMainThreadPercent: median(phases('idle-30').map(p => p.mainThreadMs.TaskDuration / p.durationMs * 100)),
    overviewRafP95Ms: median(phases('idle-30').map(p => p.frameMs.p95)),
    zoomPanRafP95Ms: median(phases('zoom-pan').map(p => p.frameMs.p95)),
    zoomPanMaxMs: Math.max(...phases('zoom-pan').map(p => p.frameMs.max)),
    zoomPanLongTasks: phases('zoom-pan').map(p => p.longTasks.length),
    typingRafP95Ms: median(phases('typing-24-characters').map(p => p.inputToRafMs.p95)),
    commitMedianMs: median(results.flatMap(r => r.commitProbe.map(p => p.commitMs))),
    rendererPrivateCommitMiB: median(results.map(r => r.processMemory?.filter(p => p.type === 'renderer').reduce((sum, p) => sum+p.PrivateMemorySize64, 0) / 1024**2)),
    rendererWorkingSetMiB: median(results.map(r => r.processMemory?.filter(p => p.type === 'renderer').reduce((sum, p) => sum+p.WorkingSet64, 0) / 1024**2)),
    artworkUpdateHz: results.map(r => r.frameEvidence.updateRates.map(p => p.updatesPerSecond)),
    coldReadyMs: median(results.map(r => r.coldReadyMs)),
    allInactiveFramesRemoved: results.every(r => r.frameEvidence.quietFrames.length === 0),
    errors: results.flatMap(r => r.errors),
  });
}
await writeFile(folder + '/summary.json', JSON.stringify({ machine: raw.machine, summary }, null, 2));
console.table(summary.map(s => ({ case: s.name, n: s.runs, renderer: s.overviewRendererPercent.toFixed(1),
  quiet: s.quietRendererPercent.toFixed(1), zoomP95: s.zoomPanRafP95Ms.toFixed(1), rendererPrivateMiB: s.rendererPrivateCommitMiB.toFixed(0) })));
