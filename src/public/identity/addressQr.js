import createQr from 'qrcode-generator';

// A fixed light scan surface keeps the code readable in every Workbench theme.
export function createAddressQrImage(address) {
  const qr = createQr(0, 'M');
  qr.addData(address);
  qr.make();
  const count = qr.getModuleCount();
  const margin = 4;
  const size = count + margin * 2;
  const finders = [[0, 0], [count - 7, 0], [0, count - 7]];
  const shapes = [];
  for (let y = 0; y < count; y++) for (let x = 0; x < count; x++) {
    if (!qr.isDark(y, x) || finders.some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7)) continue;
    shapes.push(`<rect x="${x + margin}" y="${y + margin}" width="1" height="1" rx=".16"/>`);
  }
  for (const [x, y] of finders) {
    shapes.push(`<rect x="${x + margin}" y="${y + margin}" width="7" height="7" rx=".8"/>`,
      `<rect x="${x + margin + 1}" y="${y + margin + 1}" width="5" height="5" rx=".4" fill="#eeece6"/>`,
      `<rect x="${x + margin + 2}" y="${y + margin + 2}" width="3" height="3" rx=".4"/>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size * 6}" height="${size * 6}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#eeece6"/><g fill="#202322">${shapes.join('')}</g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
