/**
 * Association apps inject their palette by setting --kk-* variables.
 * The admin template uses the package CSS defaults (KlipKlop shell) and does not theme-switch.
 *
 * applyTheme({ accent: '#166534', accentInk: '#ecfdf3' }, root)
 */

const KEY_MAP = {
  bg: '--kk-bg',
  surface: '--kk-surface',
  surfaceRaised: '--kk-surface-raised',
  surfaceMuted: '--kk-surface-muted',
  ink: '--kk-ink',
  inkMuted: '--kk-ink-muted',
  inkFaint: '--kk-ink-faint',
  inkInverse: '--kk-ink-inverse',
  border: '--kk-border',
  borderStrong: '--kk-border-strong',
  ring: '--kk-ring',
  accent: '--kk-accent',
  accentHover: '--kk-accent-hover',
  accentSoft: '--kk-accent-soft',
  accentInk: '--kk-accent-ink',
  danger: '--kk-danger',
  dangerHover: '--kk-danger-hover',
  dangerInk: '--kk-danger-ink',
  dangerSoft: '--kk-danger-soft',
  success: '--kk-success',
  successInk: '--kk-success-ink',
  warning: '--kk-warning',
  warningSoft: '--kk-warning-soft',
  warningInk: '--kk-warning-ink',
  font: '--kk-font',
  fontDisplay: '--kk-font-display',
  radius: '--kk-radius',
  radiusSm: '--kk-radius-sm',
  radiusLg: '--kk-radius-lg',
}

/** Optional named starting points for association apps (not used by the admin styleguide). */
export const THEME_PRESETS = {
  klipklop: {
    label: 'KlipKlop',
    vars: {},
  },
  sawmga: {
    label: 'SAWMGA',
    vars: {
      bg: '#f3f7f1',
      surface: '#ffffff',
      surfaceRaised: '#ffffff',
      surfaceMuted: '#e4eee3',
      ink: '#122016',
      inkMuted: '#4a6350',
      inkFaint: '#7a917f',
      inkInverse: '#f3faf4',
      border: '#c8d9c4',
      accent: '#166534',
      accentHover: '#14532d',
      accentSoft: '#dcfce7',
      accentInk: '#f0fdf4',
      ring: '#166534',
      success: '#14532d',
      successInk: '#dcfce7',
    },
  },
  brsa: {
    label: 'BRSA',
    vars: {
      bg: '#f6f1e8',
      surface: '#fffdf8',
      surfaceRaised: '#fffdf8',
      surfaceMuted: '#ebe2d2',
      ink: '#1c1710',
      inkMuted: '#6b5e4c',
      inkFaint: '#958674',
      inkInverse: '#1c1710',
      border: '#ddd0b8',
      accent: '#c4a35a',
      accentHover: '#b08d45',
      accentSoft: '#f3e8cb',
      accentInk: '#1c1710',
      ring: '#c4a35a',
      warning: '#9a6b16',
      warningSoft: '#f5e6c8',
      warningInk: '#2a1c08',
    },
  },
}

export function tokenToCssVar(key) {
  if (key.startsWith('--')) return key
  return KEY_MAP[key] || `--kk-${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`
}

export function applyTheme(vars = {}, root = typeof document !== 'undefined' ? document.documentElement : null) {
  if (!root) return
  root.classList.add('kk-theme')
  for (const [key, value] of Object.entries(vars)) {
    if (value == null || value === '') continue
    root.style.setProperty(tokenToCssVar(key), String(value))
  }
}

export function applyPreset(name, root = typeof document !== 'undefined' ? document.documentElement : null) {
  const preset = THEME_PRESETS[name]
  if (!preset) throw new Error(`Unknown theme preset: ${name}`)
  if (name === 'klipklop') {
    clearTheme(root)
  } else {
    applyTheme(preset.vars, root)
  }
  if (root) root.dataset.kkTheme = name
  return preset
}

export function clearTheme(root = typeof document !== 'undefined' ? document.documentElement : null) {
  if (!root) return
  for (const cssVar of Object.values(KEY_MAP)) {
    root.style.removeProperty(cssVar)
  }
  delete root.dataset.kkTheme
}
