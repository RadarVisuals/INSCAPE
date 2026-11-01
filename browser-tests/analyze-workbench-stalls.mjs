// Read a local Chrome trace; this is diagnostic evidence, not a timed workload.
import { readFile, writeFile } from 'node:fs/promises';
const filename = process.argv[2];
const { traceEvents: events } = JSON.parse(await readFile(filename, 'utf8'));
const names = new Map(events.filter(e => e.name === 'thread_name').map(e => [`${e.pid}:${e.tid}`, e.args.name]));
const duration = events.filter(e => e.ph === 'X' && e.dur);
const totals = new Map();
for (const e of duration) {
  const key = `${names.get(`${e.pid}:${e.tid}`)}:${e.name}`;
  const item = totals.get(key) || { name: key, count: 0, ms: 0, maxMs: 0 };
  item.count++; item.ms += e.dur / 1000; item.maxMs = Math.max(item.maxMs, e.dur / 1000); totals.set(key, item);
}
const tasks = duration.filter(e => /RunTask/.test(e.name) && names.get(`${e.pid}:${e.tid}`) === 'CrRendererMain');
const marks = events.filter(e => e.name.startsWith('workbench-')).map(e => ({ name: e.name, at: e.ts / 1000, pid: e.pid }));
const pagePid = marks[0]?.pid;
const detail = e => {
  const data = e.args?.data || e.args?.beginData || {};
  return { name: e.name, ms: e.dur / 1000, at: e.ts / 1000,
    ...(typeof e.tdur === 'number' ? { threadCpuMs: e.tdur / 1000 } : {}),
    ...(data.url ? { url: data.url, function: data.functionName, line: data.lineNumber, column: data.columnNumber } : {}),
    ...(data.nodeName ? { node: data.nodeName } : {}) };
};
const largest = selected => selected.sort((a, b) => b.dur - a.dur).slice(0, 8).map(task => ({
  ...detail(task), pid: task.pid, tid: task.tid,
  work: duration.filter(e => e !== task && e.pid === task.pid && e.tid === task.tid && e.ts >= task.ts && e.ts < task.ts + task.dur)
    .sort((a, b) => b.dur - a.dur).slice(0, 10).map(detail),
}));
const report = {
  note: 'Inclusive event durations overlap; do not add these totals as CPU self time. Profiling affects timing.',
  totals: [...totals.values()].sort((a, b) => b.ms - a.ms).slice(0, 45),
  marks, pagePid,
  pageTasks: largest(tasks.filter(e => e.pid === pagePid)),
  otherRendererTasks: largest(tasks.filter(e => e.pid !== pagePid)),
};
await writeFile(filename.replace('.json', '.summary.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
