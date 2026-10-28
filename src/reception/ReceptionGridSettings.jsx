import { ReceptionButton, ReceptionRange } from './ReceptionControls.jsx';

export default function ReceptionGridSettings({ value, generation, onSave, onPreview, onColour }) {
  const range = (label, key, max) => <ReceptionRange label={label} value={value[key]} max={max} version={generation}
    onCommit={next => onSave({ ...value, [key]: next }, 'Edit grid settings')}
    onPreview={next => onPreview(next === null ? null : { ...value, [key]: next })} />;
  return <>
    {range('Corners', 'radius', 160)}
    {range('Gaps', 'gutter', 64)}
    <ReceptionButton onClick={onColour}>Grid color</ReceptionButton>
  </>;
}
