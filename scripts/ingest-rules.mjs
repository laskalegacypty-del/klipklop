// Builds public/data/wmg-rules.json from SAWMGA-knowledge-base.md.
// Heading-aware chunking: each "###" subsection becomes a searchable entry,
// grouped under its parent "##" section. Section intros (text directly under a
// "##" before any "###") become their own entry titled by the section.
//
// Usage: node scripts/ingest-rules.mjs [inputFile] [outputFile]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const inputFile = process.argv[2] || resolve(root, 'SAWMGA-knowledge-base.md')
const outputFile = process.argv[3] || resolve(root, 'public/data/wmg-rules.json')

const SOURCE = 'SAWMGA Knowledge Base'
const SOURCE_URL = 'https://www.sawmga.co.za'
const VERSION = '2026'

function cleanHeading(line) {
  return line
    .replace(/^#{2,3}\s+/, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .trim()
}

function flush(entries, current) {
  if (!current) return
  const text = current.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!text) return
  entries.push({ title: current.title, section: current.section, text })
}

function ingest() {
  const raw = readFileSync(inputFile, 'utf8')
  const lines = raw.split(/\r?\n/)

  const entries = []
  let section = null
  let current = null
  let started = false

  for (const line of lines) {
    if (/^##\s+/.test(line) && !/^###\s+/.test(line)) {
      // New top-level section
      flush(entries, current)
      section = cleanHeading(line)
      current = { title: section, section, lines: [] }
      started = true
      continue
    }
    if (/^###\s+/.test(line)) {
      // New subsection entry
      flush(entries, current)
      const title = cleanHeading(line)
      current = { title, section: section || title, lines: [] }
      started = true
      continue
    }
    if (!started) continue // skip preamble before the first "##"
    if (/^---+\s*$/.test(line)) continue // skip horizontal rules
    if (/^>\s?/.test(line)) continue // skip blockquote notes
    if (current) current.lines.push(line)
  }
  flush(entries, current)

  const dataset = {
    source: SOURCE,
    sourceUrl: SOURCE_URL,
    version: VERSION,
    generatedAt: new Date().toISOString(),
    entryCount: entries.length,
    entries,
  }

  mkdirSync(dirname(outputFile), { recursive: true })
  writeFileSync(outputFile, JSON.stringify(dataset, null, 2), 'utf8')
  console.log(`Wrote ${entries.length} entries to ${outputFile}`)
}

ingest()
