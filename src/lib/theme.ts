/**
 * STICKY PLAN — custom theme engine.
 *
 * Generates CSS-variable overrides for the existing pastel design tokens
 * (--mint/--sky/--lavender + semantic primary/secondary/accent + charts + sidebar)
 * and injects them as a <style> tag. Only hue-carrying tokens are overridden;
 * neutrals, spacing, radii and component styles stay exactly as designed.
 *
 * Light-mode pastels are clamped to a mid-lightness band so white text on
 * solid chips/buttons remains readable (accessibility guard).
 */

export type ThemeConfig = {
  preset: string;
  primary: string; // hex — main pastel (buttons, links, brand)
  secondary: string; // hex — second pastel (gradients, charts)
  accent: string; // hex — third pastel (accents, chips)
  backgroundLight: string; // key into BACKGROUND_LIGHT
  backgroundDark: string; // key into BACKGROUND_DARK
};

export const DEFAULT_THEME: ThemeConfig = {
  preset: "mint",
  primary: "#2fa692",
  secondary: "#4f8fd8",
  accent: "#8a63d2",
  backgroundLight: "warm",
  backgroundDark: "deep",
};

export const PRESETS: {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  backgroundLight: string;
}[] = [
  { id: "mint", name: "Mint Green", primary: "#2fa692", secondary: "#4f8fd8", accent: "#8a63d2", backgroundLight: "warm" },
  { id: "lavender", name: "Lavender", primary: "#8a63d2", secondary: "#4f8fd8", accent: "#2fa692", backgroundLight: "mist" },
  { id: "pink", name: "Soft Pink", primary: "#d9718f", secondary: "#8a63d2", accent: "#4f8fd8", backgroundLight: "blush" },
  { id: "sky", name: "Sky Blue", primary: "#4f8fd8", secondary: "#2fa692", accent: "#d98a71", backgroundLight: "mist" },
  { id: "peach", name: "Peach", primary: "#dd8557", secondary: "#d9718f", accent: "#4f8fd8", backgroundLight: "cream" },
  { id: "sage", name: "Sage Green", primary: "#7ca584", secondary: "#5e93a6", accent: "#c2907b", backgroundLight: "warm" },
  { id: "beige", name: "Beige & Cream", primary: "#a98a5f", secondary: "#8c9e7e", accent: "#c2907b", backgroundLight: "cream" },
  { id: "ocean", name: "Ocean Blue", primary: "#3e7cc0", secondary: "#2e9ba6", accent: "#7a5fd0", backgroundLight: "mist" },
];

export const BACKGROUND_LIGHT: Record<string, { name: string; hex: string }> = {
  warm: { name: "Warm ivory (default)", hex: "#fcfaf3" },
  white: { name: "Pure white", hex: "#ffffff" },
  cream: { name: "Cream", hex: "#faf4e8" },
  mist: { name: "Cool mist", hex: "#f3f7fa" },
  blush: { name: "Blush", hex: "#fbf4f5" },
};

export const BACKGROUND_DARK: Record<string, { name: string; hex: string }> = {
  deep: { name: "Deep teal (default)", hex: "#182020" },
  charcoal: { name: "Charcoal", hex: "#17181a" },
  midnight: { name: "Midnight", hex: "#141828" },
  aubergine: { name: "Aubergine", hex: "#1e1624" },
};

// ── colour math (hex only, no deps) ─────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h || "000000", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Mix colour a into b — t=0 → all b, t=1 → all a. */
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 * t + r2 * (1 - t), g1 * t + g2 * (1 - t), b1 * t + b2 * (1 - t));
}

function lighten(hex: string, t: number): string {
  return mix("#ffffff", hex, t); // t = how much white to blend in
}
function darken(hex: string, t: number): string {
  return mix("#000000", hex, t); // t = how much black to blend in
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function readableOn(hex: string): string {
  return luminance(hex) > 0.45 ? "#1c2422" : "#ffffff";
}

/** Clamp a pastel into a mid-lightness band so white text stays readable. */
function clampPastel(hex: string, minL = 0.3, maxL = 0.64): string {
  let cur = hex;
  let guard = 0;
  while (luminance(cur) < minL && guard++ < 20) cur = lighten(cur, 0.08);
  guard = 0;
  while (luminance(cur) > maxL && guard++ < 20) cur = darken(cur, 0.08);
  return cur;
}

export function normalizeHex(hex: string): string {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec((hex ?? "").trim());
  return m ? `#${m[1]}` : "";
}

// ── token generation ────────────────────────────────────────────────

const DARK_SOFT_BASE = "#10151a";

export function resolveTheme(config: ThemeConfig): { light: Record<string, string>; dark: Record<string, string> } {
  const p = normalizeHex(config.primary) || DEFAULT_THEME.primary;
  const s = normalizeHex(config.secondary) || DEFAULT_THEME.secondary;
  const a = normalizeHex(config.accent) || DEFAULT_THEME.accent;
  const bgL = BACKGROUND_LIGHT[config.backgroundLight]?.hex ?? BACKGROUND_LIGHT.warm.hex;
  const bgD = BACKGROUND_DARK[config.backgroundDark]?.hex ?? BACKGROUND_DARK.deep.hex;

  const pL = clampPastel(p);
  const sL = clampPastel(s);
  const aL = clampPastel(a);
  const primary = darken(pL, 0.07);
  const primaryFg = readableOn(primary);

  const pD = lighten(p, 0.26);
  const sD = lighten(s, 0.26);
  const aD = lighten(a, 0.26);
  const primaryD = lighten(p, 0.2);
  const primaryDkFg = readableOn(primaryD);

  const light: Record<string, string> = {
    "--mint": pL,
    "--mint-soft": mix(pL, "#ffffff", 0.12),
    "--sky": sL,
    "--sky-soft": mix(sL, "#ffffff", 0.1),
    "--lavender": aL,
    "--lavender-soft": mix(aL, "#ffffff", 0.1),
    "--primary": primary,
    "--primary-foreground": primaryFg,
    "--secondary": mix(pL, "#ffffff", 0.14),
    "--secondary-foreground": darken(pL, 0.38),
    "--accent": mix(aL, "#ffffff", 0.12),
    "--accent-foreground": darken(aL, 0.32),
    "--ring": primary,
    "--background": bgL,
    "--chart-1": pL,
    "--chart-2": aL,
    "--chart-4": sL,
    "--sidebar": mix(pL, "#ffffff", 0.055),
    "--sidebar-primary": primary,
    "--sidebar-primary-foreground": primaryFg,
    "--sidebar-accent": mix(pL, "#ffffff", 0.12),
    "--sidebar-accent-foreground": darken(pL, 0.36),
    "--sidebar-ring": primary,
  };

  const dark: Record<string, string> = {
    "--mint": pD,
    "--mint-soft": mix(p, DARK_SOFT_BASE, 0.16),
    "--sky": sD,
    "--sky-soft": mix(s, DARK_SOFT_BASE, 0.16),
    "--lavender": aD,
    "--lavender-soft": mix(a, DARK_SOFT_BASE, 0.16),
    "--primary": primaryD,
    "--primary-foreground": primaryDkFg,
    "--secondary": mix(p, DARK_SOFT_BASE, 0.2),
    "--secondary-foreground": lighten(p, 0.55),
    "--accent": mix(a, DARK_SOFT_BASE, 0.22),
    "--accent-foreground": lighten(a, 0.6),
    "--ring": primaryD,
    "--background": bgD,
    "--card": lighten(bgD, 0.045),
    "--popover": lighten(bgD, 0.045),
    "--sidebar": lighten(bgD, 0.03),
    "--chart-1": pD,
    "--chart-2": aD,
    "--chart-4": sD,
    "--sidebar-primary": primaryD,
    "--sidebar-primary-foreground": primaryDkFg,
    "--sidebar-accent": mix(p, DARK_SOFT_BASE, 0.24),
    "--sidebar-accent-foreground": lighten(p, 0.6),
    "--sidebar-ring": primaryD,
  };

  return { light, dark };
}

function cssBlock(vars: Record<string, string>): string {
  return Object.entries(vars).map(([k, v]) => `${k}:${v};`).join("");
}

export function themeCss(config: ThemeConfig): string {
  const { light, dark } = resolveTheme(config);
  return `:root{${cssBlock(light)}}.dark{${cssBlock(dark)}}`;
}

const STYLE_ID = "sp-custom-theme";

export function applyThemeCss(css: string) {
  if (typeof document === "undefined") return;
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

export function applyTheme(config: ThemeConfig) {
  applyThemeCss(themeCss(config));
}

/** Revert to the built-in pastel palette. */
export function clearAppliedTheme() {
  if (typeof document === "undefined") return;
  document.getElementById(STYLE_ID)?.remove();
}

export function isDefaultTheme(config: ThemeConfig): boolean {
  return (
    config.preset === DEFAULT_THEME.preset &&
    normalizeHex(config.primary) === DEFAULT_THEME.primary &&
    normalizeHex(config.secondary) === DEFAULT_THEME.secondary &&
    normalizeHex(config.accent) === DEFAULT_THEME.accent &&
    config.backgroundLight === DEFAULT_THEME.backgroundLight &&
    config.backgroundDark === DEFAULT_THEME.backgroundDark
  );
}

export function parseThemePrefs(raw: string | null | undefined): ThemeConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ThemeConfig>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      preset: typeof parsed.preset === "string" ? parsed.preset : DEFAULT_THEME.preset,
      primary: normalizeHex(parsed.primary ?? "") || DEFAULT_THEME.primary,
      secondary: normalizeHex(parsed.secondary ?? "") || DEFAULT_THEME.secondary,
      accent: normalizeHex(parsed.accent ?? "") || DEFAULT_THEME.accent,
      backgroundLight: parsed.backgroundLight && BACKGROUND_LIGHT[parsed.backgroundLight] ? parsed.backgroundLight : DEFAULT_THEME.backgroundLight,
      backgroundDark: parsed.backgroundDark && BACKGROUND_DARK[parsed.backgroundDark] ? parsed.backgroundDark : DEFAULT_THEME.backgroundDark,
    };
  } catch {
    return null;
  }
}

const LS_KEY = "sp-theme-config";

export function loadLocalTheme(): ThemeConfig | null {
  if (typeof window === "undefined") return null;
  try {
    return parseThemePrefs(window.localStorage.getItem(LS_KEY));
  } catch {
    return null;
  }
}

export function saveLocalTheme(config: ThemeConfig | null) {
  if (typeof window === "undefined") return;
  try {
    if (config) window.localStorage.setItem(LS_KEY, JSON.stringify(config));
    else window.localStorage.removeItem(LS_KEY);
  } catch {
    /* storage unavailable — theme still works for this session */
  }
}
