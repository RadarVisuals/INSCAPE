import React, { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { components } from './registry.js';
import inventory from './tokens.generated.json';
// Literal lazy imports let Vite resolve raw files before its development access check.
// Only registered paths below can be opened; no file content loads until requested.
const sourceLoaders = import.meta.glob(
  [
    '../src/**/*.jsx',
    '../src/**/*.css',
    '../src/**/*.test.js',
    '../browser-tests/*.browser.mjs',
    '../browser-tests/*.html',
    './*.css',
    './*.jsx',
  ],
  { query: '?raw&attempt=0', import: 'default' },
);
const sourcePaths = new Set([
  ...components.flatMap((item) => [item.source, item.evidence]),
  ...inventory.sources.map((item) => item.path),
  'design-system/reference.css',
  'design-system/reviewExamples.jsx',
]);
const sourceHref = (path) =>
  '/design-system.html?' +
  new URLSearchParams({ source: path, section: location.hash.slice(1) || 'overview' });

export function SourcePreview({ path, sections }) {
  const [result, setResult] = useState({ path, state: 'loading' }),
    [attempt, setAttempt] = useState(0);
  const section = new URLSearchParams(location.search).get('section');
  const back = sections.some(([id]) => id === section) ? section : 'coverage';
  useEffect(() => {
    let active = true;
    document.title = 'INSCAPE · Source reference';
    if (!sourcePaths.has(path)) {
      setResult({ path, state: 'unknown' });
      return;
    }
    setResult({ path, state: 'loading' });
    const key = path.startsWith('design-system/')
      ? './' + path.slice('design-system/'.length)
      : '../' + path;
    const load = sourceLoaders[key];
    if (!load) {
      setResult({ path, state: 'error' });
      return;
    }
    // Retry with a fresh URL because browsers remember rejected module imports.
    const request =
      attempt === 0
        ? load()
        : import(/* @vite-ignore */ '/' + path + '?raw&attempt=' + attempt).then(
            (module) => module.default,
          );
    request.then(
      (text) => {
        if (active) setResult({ path, state: 'ready', text });
      },
      () => {
        if (active) setResult({ path, state: 'error' });
      },
    );
    return () => {
      active = false;
    };
  }, [path, attempt]);
  return (
    <div className="ds-source-page system-workflow__token-scope">
      <main>
        <a className="ds-button" href={'/design-system.html#' + back}>
          Back to reference
        </a>
        <h1>Source reference</h1>
        <p className="ds-source-path">{path}</p>
        {result.state === 'ready' ? (
          <pre tabIndex="0" aria-label="Source code">
            <code>{result.text}</code>
          </pre>
        ) : (
          <p role="status">
            {result.state === 'unknown'
              ? 'This file is not in the reference.'
              : result.state === 'error'
                ? 'The source could not be loaded.'
                : 'Loading source…'}
          </p>
        )}
        {result.state === 'error' && (
          <button className="ds-button" onClick={() => setAttempt((value) => value + 1)}>
            Try again
          </button>
        )}
      </main>
    </div>
  );
}
export function Source({ path, children }) {
  return (
    <a className="ds-source" href={sourceHref(path)} target="_blank" rel="noreferrer">
      {children || path}
      {!children && <ArrowUpRight aria-hidden="true" size={13} />}
    </a>
  );
}

export function ReferenceDocuments() {
  return (
    <>
      <h2>Reference documents</h2>
      <div className="ds-links">
        {[
          ['System handbook', 'README.md'],
          ['Foundations', 'FOUNDATIONS.md'],
          ['Components & patterns', 'COMPONENTS.md'],
          ['Accessibility & content', 'ACCESSIBILITY.md'],
          ['Maintenance & adoption', 'GOVERNANCE.md'],
          ['Research and sources', 'RESEARCH.md'],
        ].map(([label, file]) => (
          <a key={file} href={`/docs/design-system/${file}`} target="_blank" rel="noreferrer">
            {label}
            <ArrowUpRight aria-hidden="true" size={14} />
          </a>
        ))}
      </div>
    </>
  );
}
export function ProductContract() {
  return (
    <a href="/docs/INSCAPE_ACTIVE_CONTRACT.md" target="_blank" rel="noreferrer">
      Active product contract <ArrowUpRight size={13} aria-hidden="true" />
    </a>
  );
}
