import { interfacePalettes, interfaceTheme, useInterfaceTheme } from './interfaceTheme.js';

export default function InterfacePaletteSelect() {
  const { palette } = useInterfaceTheme();
  return <label className="interface-palette">
    <span>Color palette</span>
    <select aria-label="Color palette" value={palette} onChange={event => interfaceTheme.setPalette(event.target.value)}>
      {Object.entries(interfacePalettes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
  </label>;
}
