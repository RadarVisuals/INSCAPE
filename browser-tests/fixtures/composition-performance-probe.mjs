// Serialized by Playwright before application code runs. Instrument the host
// only: the supplied opaque SVG documents remain byte-for-byte untouched.
export function installCompositionPerformanceProbe() {
  if (window !== window.top) return;
  const urls = new Map();
  const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = (...args) => { const url = create(...args); urls.set(url, Number(args[0]?.size) || 0); return url; };
  URL.revokeObjectURL = url => { urls.delete(url); revoke(url); };
  let workersCreated = 0, terminated = 0;
  const OriginalWorker = Worker;
  window.Worker = class extends OriginalWorker {
    constructor(...args) { super(...args); workersCreated++; this.perfTerminated = false; }
    terminate() { if (!this.perfTerminated) { terminated++; this.perfTerminated = true; } return super.terminate(); }
  };
  const longTasks = [], events = [];
  const largestPaints = [];
  const supported = PerformanceObserver.supportedEntryTypes;
  if (supported.includes('largest-contentful-paint')) new PerformanceObserver(list => {
    largestPaints.push(...list.getEntries().map(entry => ({ time: entry.startTime, size: entry.size })));
  }).observe({ type: 'largest-contentful-paint', buffered: true });
  const tasks = supported.includes('longtask') ? new PerformanceObserver(list => {
    longTasks.push(...list.getEntries().map(entry => ({ start: entry.startTime, duration: entry.duration })));
  }) : null;
  tasks?.observe({ type: 'longtask', buffered: true });
  if (supported.includes('event')) new PerformanceObserver(list => {
    events.push(...list.getEntries().filter(entry => entry.interactionId).map(entry => ({
      start: entry.startTime, duration: entry.duration, name: entry.name, interactionId: entry.interactionId,
    })));
  }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
  let phase = null, frame = 0;
  const tick = stamp => {
    if (!phase) return;
    if (phase.last !== null && phase.intervals.length < 10000) phase.intervals.push(stamp - phase.last);
    phase.last = stamp; frame = requestAnimationFrame(tick);
  };
  const resources = () => ({
    objectUrls: urls.size, objectUrlBlobBytes: [...urls.values()].reduce((sum, bytes) => sum + bytes, 0),
    workersCreated, explicitWorkerTerminations: terminated,
    workersWithoutExplicitTermination: workersCreated - terminated,
    svgImages: document.querySelectorAll('svg > image').length,
    htmlImages: document.querySelectorAll('img').length,
    iframes: document.querySelectorAll('iframe').length,
    nodes: document.querySelectorAll('*').length,
  });
  window.compositionPerformanceProbe = {
    supported: { longtask: Boolean(tasks), eventTiming: supported.includes('event') },
    resources,
    loadStats: () => ({ readyMs: performance.now(), largestObservedPaint: largestPaints.at(-1) || null,
      paint: performance.getEntriesByType('paint').map(entry => ({ name: entry.name, time: entry.startTime })),
      longTaskMs: longTasks.map(entry => entry.duration) }),
    start() { if (phase) throw Error('Measurement already active'); phase = { start: performance.now(), last: null, intervals: [] }; frame = requestAnimationFrame(tick); },
    stop() {
      cancelAnimationFrame(frame);
      const value = phase; phase = null;
      if (!value) throw Error('No active measurement');
      const pending = tasks?.takeRecords() || [];
      longTasks.push(...pending.map(entry => ({ start: entry.startTime, duration: entry.duration })));
      return { start: value.start, end: performance.now(), intervals: value.intervals,
        longTasks: longTasks.filter(entry => entry.start >= value.start),
        events: events.filter(entry => entry.start >= value.start), resources: resources() };
    },
  };
}

export function distribution(values) {
  if (!values.length) return { n: 0, p50: null, p95: null, p99: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = p => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
  return { n: sorted.length, p50: percentile(.5), p95: percentile(.95), p99: percentile(.99), max: sorted.at(-1) };
}
