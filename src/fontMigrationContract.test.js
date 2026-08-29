import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = new URL('.', import.meta.url);
const sourceDirectory = root.pathname.startsWith('/') && /^[A-Za-z]:/u.test(root.pathname.slice(1))
  ? decodeURIComponent(root.pathname.slice(1)) : decodeURIComponent(root.pathname);
const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]);
const cssFiles = walk(sourceDirectory).filter((file) => extname(file) === '.css');
const css = cssFiles.map((file) => `/* ${relative(sourceDirectory, file)} */\n${readFileSync(file, 'utf8')}`).join('\n');
const tokens = readFileSync(new URL('./inscapeTokens.css', import.meta.url), 'utf8');
const statusStyles = readFileSync(new URL('./profileDocument/components/publishedProfileStatus.css', import.meta.url), 'utf8');
const supportStyles = readFileSync(new URL('./support/alphaSupport.css', import.meta.url), 'utf8');
const projectInstructions = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8');
const activeContract = readFileSync(new URL('../docs/INSCAPE_ACTIVE_CONTRACT.md', import.meta.url), 'utf8');

test('all production CSS excludes every retired interface font', () => {
  assert.doesNotMatch(css, /(?:PP Monument|Geist(?: Sans| Mono)?|IBM Plex Mono|Space Mono|Bahnschrift|system-ui|\bmonospace\b)/iu);
});

test('the two approved font faces and tokens remain centralized', () => {
  assert.equal((tokens.match(/@font-face/gu) || []).length, 2);
  assert.match(tokens, /font-family:\s*"Inscape Sora";[\s\S]*Sora-VariableFont_wght\.ttf/);
  assert.match(tokens, /font-family:\s*"Inscape IBM Plex Sans Condensed";[\s\S]*IBMPlexSansCondensed-Regular\.ttf/);
  assert.match(tokens, /--font-interface:\s*"Inscape Sora", sans-serif/);
  assert.match(tokens, /--font-body:\s*"Inscape Sora", sans-serif/);
  assert.match(tokens, /--font-technical:\s*"Inscape IBM Plex Sans Condensed", sans-serif/);
});

test('production wordmarks remain the existing SVG mask instead of a brand font', () => {
  const wordmarkMasks = css.match(/(?:-webkit-)?mask:\s*url\('\/assets\/brand\/inscape-wordmark\.svg'\)/gu) || [];
  assert.ok(wordmarkMasks.length >= 4);
  assert.doesNotMatch(css, /font-family:[^;}]*wordmark/iu);
});

test('narrow public states keep state and compact support copy on the technical face', () => {
  assert.match(statusStyles, /\.published-profile-status__card h1 \{[^}]*font-family: "Inscape IBM Plex Sans Condensed"/s);
  assert.match(statusStyles, /\.published-profile-status__body > p \{[^}]*font-family: "Inscape IBM Plex Sans Condensed"/s);
  assert.match(supportStyles, /\.alpha-support p,[\s\S]*\.alpha-support small \{[^}]*font-family: "Inscape IBM Plex Sans Condensed"/s);
});

test('active typography authorities approve only Sora and IBM Plex Sans Condensed', () => {
  const typography = activeContract.match(/### Typography([\s\S]*?)### Geometry and surfaces/u)?.[1] || '';
  assert.match(typography, /Inscape Sora/);
  assert.match(typography, /Inscape IBM Plex Sans Condensed/);
  assert.doesNotMatch(typography, /Geist|IBM Plex Mono|Space Mono|PP Monument|monospace/iu);
  assert.match(projectInstructions, /Use Inscape Sora for human interface copy and Inscape\s+IBM Plex Sans Condensed for technical and dense secondary copy/u);
});
