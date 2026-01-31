export function hexToHsl(hex: string) {
  const raw = hex.replace("#", "").trim();
  if (raw.length !== 6) return null;
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hslString(hex: string, fallback: string) {
  const hsl = hexToHsl(hex);
  if (!hsl) return fallback;
  return `${hsl.h} ${hsl.s}% ${hsl.l}%`;
}

export function pickForeground(hex: string) {
  const hsl = hexToHsl(hex);
  if (!hsl) return "0 0% 100%";
  return hsl.l > 55 ? "0 0% 10%" : "0 0% 98%";
}
