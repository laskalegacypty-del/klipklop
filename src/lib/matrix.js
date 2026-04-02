export const MATRIX = {
    'Barrel Race':    { 0: [28.971, Infinity], 1: [24.361, 28.970], 2: [22.213, 24.360], 3: [21.155, 22.212], 4: [0, 21.154] },
    'Birangle':       { 0: [20.642, Infinity], 1: [18.088, 20.641], 2: [16.756, 18.087], 3: [15.589, 16.755], 4: [0, 15.588] },
    'Big T':          { 0: [22.767, Infinity], 1: [19.893, 22.766], 2: [18.043, 19.892], 3: [16.794, 18.042], 4: [0, 16.793] },
    'Fig 8 Flags':    { 0: [27.610, Infinity], 1: [21.107, 27.609], 2: [17.498, 21.106], 3: [14.726, 17.497], 4: [0, 14.725] },
    'Fig 8 Stake':    { 0: [16.472, Infinity], 1: [14.198, 16.471], 2: [13.182, 14.197], 3: [12.395, 13.181], 4: [0, 12.394] },
    'Hurry Scurry':   { 0: [19.736, Infinity], 1: [14.814, 19.735], 2: [12.855, 14.813], 3: [11.474, 12.854], 4: [0, 11.473] },
    'Keyhole':        { 0: [13.183, Infinity], 1: [10.497, 13.182], 2: [9.251,  10.496], 3: [8.493,  9.250],  4: [0, 8.492]  },
    'Poles I':        { 0: [16.811, Infinity], 1: [14.814, 16.810], 2: [13.105, 14.813], 3: [12.057, 13.104], 4: [0, 12.056] },
    'Poles II':       { 0: [34.667, Infinity], 1: [29.954, 34.666], 2: [27.358, 29.953], 3: [25.386, 27.357], 4: [0, 25.385] },
    'Quadrangle':     { 0: [29.838, Infinity], 1: [26.006, 29.837], 2: [23.886, 26.005], 3: [22.344, 23.885], 4: [0, 22.343] },
    'Single Stake':   { 0: [14.677, Infinity], 1: [12.338, 14.676], 2: [11.414, 12.337], 3: [10.594, 11.413], 4: [0, 10.593] },
    'Speedball':      { 0: [13.906, Infinity], 1: [10.891, 13.905], 2: [9.439,  10.890], 3: [8.635,  9.438],  4: [0, 8.634]  },
    'Speed Barrels':  { 0: [15.557, Infinity], 1: [12.853, 15.556], 2: [11.910, 12.852], 3: [11.048, 11.909], 4: [0, 11.047] }
  }
  
  export function getLevel(game, time) {
    if (!time || time === 'NT') return null
    const thresholds = MATRIX[game]
    if (!thresholds) return null
    for (let level = 4; level >= 0; level--) {
      const [min, max] = thresholds[level]
      if (time >= min && time <= max) return level
    }
    return 0
  }
  
  /**
   * Returns how many seconds need to be cut from bestTime to reach the next level.
   * Returns null if already at level 4 (top level) or if no time/level available.
   */
  export function getTimeToNextLevel(game, bestTime) {
    if (!bestTime || bestTime === 'NT') return null
    const currentLevel = getLevel(game, bestTime)
    if (currentLevel === null || currentLevel >= 4) return null
    const nextLevel = currentLevel + 1
    const thresholds = MATRIX[game]
    if (!thresholds || !thresholds[nextLevel]) return null
    // Upper bound of next level is the max time allowed at that level
    const nextLevelMax = thresholds[nextLevel][1]
    return parseFloat((bestTime - nextLevelMax).toFixed(3))
  }

  export function getNationalsLevel(personalBests) {
    // Count how many games have a time recorded
    const gamesWithTimes = Object.entries(personalBests)
      .filter(([_, time]) => time && time !== 'NT')
  
    if (gamesWithTimes.length === 0) return null
  
    // Get level for each game
    const levels = gamesWithTimes.map(([game, time]) => getLevel(game, time))
  
    // Count games at each level
    const levelCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }
    levels.forEach(l => { if (l !== null) levelCounts[l]++ })
  
    // Apply 8 out of 13 rule — find highest level where 8+ games qualify
    for (let level = 4; level >= 0; level--) {
      const gamesAtOrAbove = levels.filter(l => l >= level).length
      if (gamesAtOrAbove >= 8) return level
    }
  
    return 0
  }