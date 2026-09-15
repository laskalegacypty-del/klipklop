export function parseRuleBlocks(text) {
  const lines = String(text || '').split(/\r?\n/)
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^\s*\|/.test(line)) {
      const table = []
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        table.push(lines[i])
        i += 1
      }
      blocks.push({ type: 'table', rows: table })
      continue
    }
    if (line.trim() === '') {
      i += 1
      continue
    }
    const para = []
    while (i < lines.length && lines[i].trim() !== '' && !/^\s*\|/.test(lines[i])) {
      para.push(lines[i])
      i += 1
    }
    blocks.push({ type: 'p', text: para.join('\n') })
  }
  return blocks
}

function parseRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
}

function isSeparator(cells) {
  return cells.every((c) => /^[-:]+$/.test(c.replace(/\s/g, '')) || c === '')
}

export function RuleText({ text, className = '' }) {
  const blocks = parseRuleBlocks(text)
  return (
    <div className={`space-y-2 text-xs leading-relaxed text-stone-600 ${className}`}>
      {blocks.map((block, idx) => {
        if (block.type === 'table') {
          const rows = block.rows.map(parseRow).filter((r) => r.some(Boolean))
          if (!rows.length) return null
          const head = rows[0]
          const body = rows.slice(1).filter((r) => !isSeparator(r))
          return (
            <div key={idx} className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-[11px]">
                <thead>
                  <tr className="bg-dust-100">
                    {head.map((cell, i) => (
                      <th key={i} className="border border-dust-200 px-2 py-1 font-semibold text-charcoal">{cell}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.map((row, ri) => (
                    <tr key={ri} className={ri % 2 ? 'bg-dust-50' : 'bg-white'}>
                      {row.map((cell, i) => (
                        <td key={i} className="border border-dust-200 px-2 py-1">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
        return (
          <p key={idx} className="whitespace-pre-wrap">
            {block.text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={i}>{part.slice(2, -2)}</strong>
                : <span key={i}>{part}</span>,
            )}
          </p>
        )
      })}
    </div>
  )
}
