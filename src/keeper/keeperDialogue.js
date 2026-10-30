export const KEEPER_DIALOGUE_FORMAT = 'inscape.keeper-dialogue';
export const KEEPER_DIALOGUE_MAX_BYTES = 256 * 1024;
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const keys = (value, names) => record(value) && Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
const id = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/u.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);

// Attached text is declarative dialogue, never HTML, code, links or app commands.
export function parseKeeperDialogue(document) {
  const invalid = () => { throw new Error('The attached Keeper dialogue has an invalid format or broken reply.'); };
  if (!keys(document, ['format', 'version', 'language', 'start', 'nodes'])
    || document.format !== KEEPER_DIALOGUE_FORMAT || document.version !== 1
    || typeof document.language !== 'string' || !/^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/u.test(document.language)
    || !id(document.start) || !record(document.nodes)) invalid();
  const entries = Object.entries(document.nodes);
  if (!entries.length || entries.length > 512 || !Object.hasOwn(document.nodes, document.start)) invalid();
  for (const [name, node] of entries) {
    if (!id(name) || !keys(node, ['text', 'choices']) || !text(node.text, 2000)
      || !Array.isArray(node.choices) || node.choices.length > 6) invalid();
    for (const choice of node.choices) {
      if (!keys(choice, ['label', 'next']) || !text(choice.label, 120) || !id(choice.next)
        || !Object.hasOwn(document.nodes, choice.next)) invalid();
    }
  }
  return document;
}
