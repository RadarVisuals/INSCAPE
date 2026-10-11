import { useState } from 'react';
import { ARTICLE_STYLE_ROLES, ARTICLE_FONTS, ARTICLE_FONT_SIZE, ARTICLE_LINE_HEIGHT, ARTICLE_TRACKING } from './domain/article.js';
import TextTypographyInput from './TextTypographyInput.jsx';
import { X } from '../public/InscapeIcons.jsx';

export default function TextStyleControls({ appearance, onChange, disabled }) {
  const [role, setRole] = useState('h1');
  const style = appearance.textStyles?.[role] || {};
  const update = (name, value) => {
    const next = { ...style }, styles = { ...appearance.textStyles };
    if (value === null) delete next[name]; else next[name] = value;
    if (Object.keys(next).length) styles[role] = next; else delete styles[role];
    const result = { ...appearance };
    if (Object.keys(styles).length) result.textStyles = styles; else delete result.textStyles;
    onChange(result);
  };
  return <details className="text-style-controls text-settings-wide">
    <summary>Heading &amp; caption styles</summary>
    <p>Applies to every matching heading or artwork caption. Selected text overrides remain in place. Body text uses the document settings above.</p>
    <label>Style<select aria-label="Article style" value={role} onChange={event => setRole(event.target.value)}>
      {ARTICLE_STYLE_ROLES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
    </select></label>
    <label>Font<select aria-label="Style font" disabled={disabled} value={style.fontFamily || ''} onChange={event => update('fontFamily', event.target.value || null)}>
      <option value="">Document font</option>{ARTICLE_FONTS.map(font => <option key={font.id} value={font.family}>{font.label}</option>)}
    </select></label>
    <TextTypographyInput key={`${role}:size`} label="Size (px)" accessibleLabel="Style text size" value={style.fontSize} limits={ARTICLE_FONT_SIZE} disabled={disabled}
      placeholder={String(Math.round(appearance.fontSize * ARTICLE_STYLE_ROLES.find(item => item.id === role).size * 100) / 100)}
      onChange={value => update('fontSize', value)} resetLabel="Use automatic style size" />
    <TextTypographyInput key={`${role}:line`} label="Line spacing (×)" accessibleLabel="Style line spacing" value={style.lineHeight} limits={ARTICLE_LINE_HEIGHT} disabled={disabled}
      placeholder={role === 'caption' ? String(appearance.lineHeight ?? (appearance.compact ? 1.2 : 1.65)) : '1.3'}
      onChange={value => update('lineHeight', value)} resetLabel="Use automatic style line spacing" />
    <TextTypographyInput key={`${role}:tracking`} label="Letter spacing (em)" accessibleLabel="Style tracking" value={style.letterSpacing} limits={ARTICLE_TRACKING} disabled={disabled}
      onChange={value => update('letterSpacing', value)} resetLabel="Use automatic style tracking" />
    <div className="text-selection-colour"><label>Colour<input aria-label="Style colour" type="color" disabled={disabled} value={style.color || appearance.color}
      onChange={event => update('color', event.target.value)} /></label>
      <button type="button" aria-label="Use document style colour" title="Use document colour" disabled={disabled || !style.color} onClick={() => update('color', null)}><X /></button>
    </div>
  </details>;
}
