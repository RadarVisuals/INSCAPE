import { RENDER_CONFIG_VERSION } from './renderConfig.defaults.js';
import { normalizeRenderConfig } from './normalizeRenderConfig.js';
import { migrateRenderConfigDocument } from './renderConfig.migrations.js';

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

export class RenderConfigDocumentError extends Error {
  constructor(message, diagnostics = []) {
    super(message);
    this.name = 'RenderConfigDocumentError';
    this.diagnostics = diagnostics;
  }
}

function rejected(code, path, message, input) {
  return Object.freeze({ severity: 'error', action: 'rejected', code, path, message, input });
}

function corrected(code, path, message, input, output) {
  return Object.freeze({ severity: 'warning', action: 'corrected', code, path, message, input, output });
}

function pathLabel(path) {
  return path.length ? path.join('.') : '$';
}

function valuesEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => valuesEqual(value, right[index]));
  }
  if (isRecord(left) && isRecord(right)) {
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every((key) => hasOwn(right, key) && valuesEqual(left[key], right[key]));
  }
  return false;
}

function collectCorrections(input, output, path = [], diagnostics = [], seen = new WeakSet()) {
  if ((Array.isArray(input) || isRecord(input)) && seen.has(input)) {
    diagnostics.push(corrected('non_json_value', pathLabel(path), `Removed a circular value at ${pathLabel(path)}.`, '[Circular]', output));
    return diagnostics;
  }
  if (Array.isArray(input) || isRecord(input)) seen.add(input);

  if (Array.isArray(input)) {
    if (!Array.isArray(output)) {
      diagnostics.push(corrected('invalid_value', pathLabel(path), `Corrected invalid value at ${pathLabel(path)}.`, input, output));
      return diagnostics;
    }
    input.forEach((value, index) => {
      if (index >= output.length) {
        diagnostics.push(corrected('unknown_field', pathLabel([...path, index]), `Removed unknown field at ${pathLabel([...path, index])}.`, value, undefined));
      } else {
        collectCorrections(value, output[index], [...path, index], diagnostics, seen);
      }
    });
    return diagnostics;
  }

  if (isRecord(input)) {
    if (!isRecord(output)) {
      diagnostics.push(corrected('invalid_value', pathLabel(path), `Corrected invalid value at ${pathLabel(path)}.`, input, output));
      return diagnostics;
    }
    for (const [key, value] of Object.entries(input)) {
      const nextPath = [...path, key];
      if (!hasOwn(output, key)) {
        diagnostics.push(corrected('unknown_field', pathLabel(nextPath), `Removed unknown field at ${pathLabel(nextPath)}.`, value, undefined));
      } else {
        collectCorrections(value, output[key], nextPath, diagnostics, seen);
      }
    }
    return diagnostics;
  }

  if (!valuesEqual(input, output)) {
    diagnostics.push(corrected('invalid_value', pathLabel(path), `Corrected invalid value at ${pathLabel(path)}.`, input, output));
  }
  return diagnostics;
}

/**
 * Non-throwing public document boundary. This accepts only complete, versioned
 * external/persistent documents. Editor partial updates intentionally continue
 * to use normalizeRenderConfig inside the private store compatibility layer.
 */
export function decodeRenderConfigDocument(source) {
  const diagnostics = [];
  let candidate = source;

  if (typeof source === 'string') {
    try {
      candidate = JSON.parse(source);
    } catch (error) {
      const diagnostic = rejected('invalid_json', '$', `RenderConfig JSON could not be parsed: ${error.message}`, source);
      return { ok: false, error: diagnostic.message, diagnostics: [diagnostic] };
    }
  }

  if (!isRecord(candidate)) {
    const diagnostic = rejected('invalid_document', '$', 'RenderConfig must be a JSON object.', candidate);
    return { ok: false, error: diagnostic.message, diagnostics: [diagnostic] };
  }

  if (!hasOwn(candidate, 'schemaVersion')) {
    const diagnostic = rejected('missing_schema_version', 'schemaVersion', 'RenderConfig schemaVersion is required.', undefined);
    return { ok: false, error: diagnostic.message, diagnostics: [diagnostic] };
  }

  if (!Number.isInteger(candidate.schemaVersion) || candidate.schemaVersion < 1) {
    const diagnostic = rejected('invalid_schema_version', 'schemaVersion', 'RenderConfig schemaVersion must be a positive integer.', candidate.schemaVersion);
    return { ok: false, error: diagnostic.message, diagnostics: [diagnostic] };
  }

  if (candidate.schemaVersion > RENDER_CONFIG_VERSION) {
    const diagnostic = rejected(
      'unsupported_future_schema_version',
      'schemaVersion',
      `RenderConfig schema v${candidate.schemaVersion} is newer than supported v${RENDER_CONFIG_VERSION}.`,
      candidate.schemaVersion
    );
    return { ok: false, error: diagnostic.message, diagnostics: [diagnostic] };
  }

  let migrated;
  try {
    migrated = migrateRenderConfigDocument(candidate);
  } catch (error) {
    const diagnostic = rejected('unsupported_schema_version', 'schemaVersion', error.message, candidate.schemaVersion);
    return { ok: false, error: diagnostic.message, diagnostics: [diagnostic] };
  }

  const value = normalizeRenderConfig(migrated);
  collectCorrections(migrated, value, [], diagnostics);
  return { ok: true, value, diagnostics };
}

export function parseRenderConfigDocument(source) {
  const result = decodeRenderConfigDocument(source);
  if (!result.ok) throw new RenderConfigDocumentError(result.error, result.diagnostics);
  return result.value;
}

export function cloneRenderConfigDocument(source) {
  return parseRenderConfigDocument(source);
}

export function serializeRenderConfigDocument(source, space = 0) {
  const value = parseRenderConfigDocument(source);
  return JSON.stringify(value, null, space);
}
