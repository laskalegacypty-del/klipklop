// Parses the running list PDF format used in KlipKlop qualifiers.
// Expects coordPages from extractPagesFromPDFWithCoords().
// Returns an array of: { runNumber, category, categoryName, level, riderName, horseName, club, group }

const CATEGORY_NAMES = { S: 'Senior', J: 'Junior', C: 'Children', V: 'Veteran' }

function groupItemsIntoRows(allItems) {
  // Sort top-to-bottom (y descending in PDF space), left-to-right
  const sorted = [...allItems].sort((a, b) => b.y - a.y || a.x - b.x)
  const rows = []
  let currentRow = []
  let currentY = null

  for (const item of sorted) {
    if (currentY === null || Math.abs(item.y - currentY) <= 4) {
      currentRow.push(item)
      if (currentY === null) currentY = item.y
    } else {
      if (currentRow.length) rows.push([...currentRow].sort((a, b) => a.x - b.x))
      currentRow = [item]
      currentY = item.y
    }
  }
  if (currentRow.length) rows.push([...currentRow].sort((a, b) => a.x - b.x))
  return rows
}

function detectColumnBoundaries(rows) {
  // Find the header row that contains "Name" and "Horse" to get column x positions
  for (const row of rows) {
    const texts = row.map(i => i.str.toLowerCase())
    const nameIdx = texts.findIndex(t => t.includes('name') && t.includes('surname'))
    const horseIdx = texts.findIndex(t => t.includes('horse'))
    const clubIdx = texts.findIndex(t => t.includes('province') || (t.includes('club') && !t.includes('equestrian')))

    if (nameIdx >= 0 && horseIdx >= 0) {
      return {
        nameColX: row[nameIdx].x,
        horseColX: row[horseIdx].x,
        clubColX: clubIdx >= 0 ? row[clubIdx].x : row[horseIdx].x + 150,
      }
    }
  }
  // Fallback: typical A4 running list column positions (in pts)
  return { nameColX: 115, horseColX: 305, clubColX: 455 }
}

export function parseRunningList(coordPages) {
  const allItems = coordPages.flat()
  if (!allItems.length) return []

  const rows = groupItemsIntoRows(allItems)
  const { nameColX, horseColX, clubColX } = detectColumnBoundaries(rows)

  const entries = []
  let currentGroup = 1

  for (const row of rows) {
    const rowText = row.map(i => i.str).join(' ').trim()

    // Group header (GROEP 1, GROEP 2, …)
    const groupMatch = rowText.match(/GROEP\s*(\d+)/i)
    if (groupMatch) {
      currentGroup = parseInt(groupMatch[1], 10)
      continue
    }

    if (row.length < 3) continue

    // First item must be the running number
    const firstStr = row[0].str.trim()
    if (!/^\d+$/.test(firstStr)) continue
    const runNumber = parseInt(firstStr, 10)

    // Find the category code (e.g. S0, J1, C2, V3, V4)
    let categoryItem = null
    for (let i = 1; i < Math.min(5, row.length); i++) {
      if (/^[SCJV]\d$/i.test(row[i].str.trim())) {
        categoryItem = row[i]
        break
      }
    }
    if (!categoryItem) continue

    const catMatch = categoryItem.str.trim().match(/^([SCJV])(\d)$/i)
    const categoryLetter = catMatch[1].toUpperCase()
    const level = parseInt(catMatch[2], 10)

    // Bucket remaining items into rider / horse / club columns by x position
    const riderItems = []
    const horseItems = []
    const clubItems = []

    for (const item of row) {
      const str = item.str.trim()
      if (!str) continue
      // Skip run number, category code, and the repeated level digit
      if (item === row[0]) continue
      if (item === categoryItem) continue
      if (/^\d$/.test(str) && item.x < nameColX) continue

      if (item.x < nameColX) continue
      if (item.x < horseColX) {
        riderItems.push(str)
      } else if (item.x < clubColX) {
        horseItems.push(str)
      } else {
        clubItems.push(str)
      }
    }

    const riderName = riderItems.join(' ').trim()
    const horseName = horseItems.join(' ').trim()
    const club = clubItems.join(' ').trim()

    if (!riderName || !horseName) continue

    entries.push({
      runNumber,
      category: categoryLetter,
      categoryName: CATEGORY_NAMES[categoryLetter] || categoryLetter,
      level,
      riderName,
      horseName,
      club,
      group: currentGroup,
    })
  }

  return entries.sort((a, b) => a.runNumber - b.runNumber)
}

// Strip day annotations like "(Saterdag)", "(Sondag)" for name matching
export function stripDayAnnotation(name) {
  return String(name || '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
}

export function normalizeForMatch(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Returns the combo from combos[] that best matches a running list entry, or null.
export function findMatchingCombo(entry, combos) {
  const entryHorse = normalizeForMatch(stripDayAnnotation(entry.horseName))

  // Exact normalized horse name match
  let match = combos.find(c => normalizeForMatch(c.horse_name) === entryHorse)
  if (match) return match

  // Partial match: one contains the other
  match = combos.find(c => {
    const comboHorse = normalizeForMatch(c.horse_name)
    return entryHorse.includes(comboHorse) || comboHorse.includes(entryHorse)
  })
  return match || null
}

export function entryKey(entry) {
  return `${entry.runNumber}-${entry.riderName}-${entry.horseName}`
}
