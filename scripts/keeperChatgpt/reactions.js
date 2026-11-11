import { KEEPER_GESTURES, keeperReaction } from '../../src/keeper/keeperReactions.js';

export function keeperReplyTool(scene) {
  return { type: 'namespace', name: 'keeper', description: 'Speak and make a small gesture as the Inscape Keeper.', tools: [{
    type: 'function', name: 'respond', strict: true,
    description: 'Deliver your conversational reply with at most one brief character gesture. Use none for an ordinary reply. Only the character moves; no other objects can be changed.',
    parameters: { type: 'object', additionalProperties: false, properties: {
      reply: { type: 'string', description: 'Your concise spoken reply in plain text, with blank lines between short paragraphs. Usually 1–3 short sentences; expand when explicitly asked. Put this field first.' },
      gesture: { type: 'string', enum: scene.gestures && !scene.reducedMotion ? KEEPER_GESTURES : ['none'] },
      target: { type: 'string', enum: ['none', ...(scene.pointer ? ['pointer'] : []), ...scene.artworks.map(item => item.id)],
        description: 'approach/retreat needs a supplied artwork ID or pointer. Other gestures use none.' },
    }, required: ['reply', 'gesture', 'target'] },
  }] };
}

// Read only the first JSON string for provisional display while arguments stream.
// No gesture is exposed until complete JSON and response.completed both validate.
export function partialKeeperReply(argumentsText) {
  const start = /^\s*\{\s*"reply"\s*:\s*"/.exec(argumentsText);
  if (!start) return '';
  const from = start[0].length - 1;
  let end = from + 1;
  while (end < argumentsText.length) {
    if (argumentsText[end] === '"') { try { return JSON.parse(argumentsText.slice(from, end + 1)); } catch { return ''; } }
    if (argumentsText[end] === '\\') {
      const length = argumentsText[end + 1] === 'u' ? 6 : 2;
      if (end + length > argumentsText.length) break;
      end += length;
    } else end++;
  }
  try { return JSON.parse(`${argumentsText.slice(from, end)}"`); } catch { return ''; }
}

export function validateKeeperReply(item, scene) {
  if (!item || item.type !== 'function_call' || !(item.name === 'respond' && item.namespace === 'keeper' || item.name === 'keeper.respond' && !item.namespace))
    throw new Error('Keeper returned an unknown action. Please try again.');
  let value; try { value = JSON.parse(item.arguments); } catch { throw new Error('Keeper’s reply was incomplete. Please try again.'); }
  const action = keeperReaction(value, scene);
  if (typeof value.reply !== 'string' || !value.reply.trim() || value.reply.length > 8000 || !action
    || Object.keys(value).some(key => !['reply', 'gesture', 'target'].includes(key))) throw new Error('Keeper returned an invalid reply or gesture. Please try again.');
  return { text: value.reply, action };
}
