export const PROVINCES = [
    'Eastern Cape',
    'Free State',
    'Gauteng',
    'KwaZulu-Natal',
    'Limpopo',
    'Mpumalanga',
    'Northern Cape',
    'North West',
    'Western Cape'
  ]
  
  export const AGE_CATEGORIES = [
    'Child (3-13)',
    'Junior (14-17)',
    'Senior (18-44)',
    'Veteran (45+)'
  ]
  
  export const GAMES = [
    'Barrel Race',
    'Birangle',
    'Big T',
    'Fig 8 Flags',
    'Fig 8 Stake',
    'Hurry Scurry',
    'Keyhole',
    'Poles I',
    'Poles II',
    'Quadrangle',
    'Single Stake',
    'Speedball',
    'Speed Barrels'
  ]
  
  export const QUALIFIER_GAMES = {
    1: ['Fig 8 Flags', 'Hurry Scurry', 'Birangle', 'Quadrangle', 'Single Stake'],
    2: ['Barrel Race', 'Poles I', 'Fig 8 Stake', 'Keyhole', 'Speedball'],
    3: ['Fig 8 Flags', 'Poles II', 'Speedball', 'Speed Barrels', 'Big T'],
    4: ['Birangle', 'Hurry Scurry', 'Keyhole', 'Quadrangle', 'Single Stake'],
    5: ['Barrel Race', 'Speedball', 'Keyhole', 'Poles I', 'Fig 8 Stake'],
    6: ['Speed Barrels', 'Hurry Scurry', 'Poles II', 'Fig 8 Flags', 'Big T'],
    7: ['Fig 8 Flags', 'Hurry Scurry', 'Birangle', 'Quadrangle', 'Single Stake'],
    8: ['Barrel Race', 'Poles I', 'Fig 8 Stake', 'Keyhole', 'Speedball'],
    9: ['Fig 8 Flags', 'Poles II', 'Speedball', 'Speed Barrels', 'Big T'],
    10: ['Birangle', 'Hurry Scurry', 'Keyhole', 'Quadrangle', 'Single Stake'],
    11: ['Barrel Race', 'Speedball', 'Keyhole', 'Poles I', 'Fig 8 Stake'],
    12: ['Speed Barrels', 'Hurry Scurry', 'Poles II', 'Fig 8 Flags', 'Big T']
  }

const GAME_ALIASES = {
  'speed ball': 'Speedball',
  'bi rangle': 'Birangle',
}

export function canonicalizeGameLabel(game) {
  return String(game || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeGameName(game) {
  const trimmed = String(game || '').trim()
  if (!trimmed) return ''
  const alias = GAME_ALIASES[canonicalizeGameLabel(trimmed)]
  return alias || trimmed
}