export const ACCENT_PRESETS = [
  { id: 'burgundy', name: 'Burgundy', note: '2026/27', hex: '#7A1F2B' },
  { id: 'teal', name: 'Ink teal', note: '2025/26', hex: '#0F6B6B' },
  { id: 'navy', name: 'Midnight navy', note: '2024/25', hex: '#1B365D' },
  { id: 'wine', name: 'Cape wine', note: 'Merch', hex: '#5C1634' },
  { id: 'forest', name: 'Highveld green', note: 'Nationals', hex: '#1F4D3A' },
  { id: 'copper', name: 'Copper dust', note: 'Rodeo night', hex: '#9A4A1E' },
]

export function defaultAccent() {
  return { ...ACCENT_PRESETS[0] }
}

export function inkOn(hex) {
  const n = hex.replace('#', '')
  const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n
  if (full.length !== 6) return '#ffffff'
  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luma > 0.55 ? '#0b0b0b' : '#ffffff'
}

export function applyAccent(accent) {
  const hex = accent?.hex || defaultAccent().hex
  const root = document.documentElement
  root.style.setProperty('--season', hex)
  root.style.setProperty('--season-ink', inkOn(hex))
}
