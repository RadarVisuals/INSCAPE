export const relativeLuminance = channels => channels.reduce((sum, channel, index) => {
  const value = channel / 255;
  return sum + (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][index];
}, 0);
export const contrast = (first, second) => (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
