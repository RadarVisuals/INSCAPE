export default function CompositionStartLayout({ value, onChange }) {
  return <label>Starting layout<select value={value} onChange={event => onChange(event.target.value)}>
    <option value="canvas">Canvas</option>
    <option value="bento">Bento</option>
  </select></label>;
}
