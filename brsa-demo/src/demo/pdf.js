import { jsPDF } from 'jspdf'

const MARGIN = 48
const PAGE_W = 595.28
const PAGE_H = 841.89
const CONTENT_W = PAGE_W - MARGIN * 2

function brandHeader(doc, { title, subtitle }) {
  doc.setFillColor(11, 11, 11)
  doc.rect(0, 0, PAGE_W, 56, 'F')
  doc.setFillColor(196, 160, 53)
  doc.rect(0, 56, PAGE_W, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('BRSA', MARGIN, 28)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(212, 178, 74)
  doc.text('BARREL RACING SOUTH AFRICA', MARGIN, 42)
  doc.setTextColor(11, 11, 11)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(title, MARGIN, 84)
  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(80, 80, 80)
    doc.text(subtitle, MARGIN, 100)
  }
  doc.setTextColor(11, 11, 11)
}

function footer(doc, page, total) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text('BRSA pitch demo · not the live federation export', MARGIN, PAGE_H - 24)
  doc.text(`Page ${page} of ${total}`, PAGE_W - MARGIN, PAGE_H - 24, { align: 'right' })
  doc.setTextColor(11, 11, 11)
}

function saveBlob(doc, filename) {
  doc.save(filename)
}

function ensureSpace(doc, y, need, onNewPage) {
  if (y + need <= PAGE_H - 40) return y
  doc.addPage()
  onNewPage?.()
  return 72
}

export function downloadMemberListPdf(riders = [], { season = '2026/27' } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const rows = [...riders].sort((a, b) => String(a.sa).localeCompare(String(b.sa)))
  const cols = [
    { key: 'sa', label: 'SA no.', w: 70 },
    { key: 'name', label: 'Name', w: 180 },
    { key: 'class', label: 'Class', w: 70 },
    { key: 'province', label: 'Province', w: 120 },
    { key: 'membershipNote', label: 'Status', w: 90 },
  ]
  const rowH = 22
  const headerH = 26

  brandHeader(doc, {
    title: 'Member list',
    subtitle: `${season} season · ${rows.length} riders · exported ${new Date().toLocaleDateString('en-ZA')}`,
  })

  let y = 120

  function drawTableHeader() {
    doc.setFillColor(243, 241, 234)
    doc.rect(MARGIN, y, CONTENT_W, headerH, 'F')
    doc.setDrawColor(221, 214, 196)
    doc.rect(MARGIN, y, CONTENT_W, headerH)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(60, 60, 60)
    let x = MARGIN + 8
    for (const col of cols) {
      doc.text(col.label, x, y + 17)
      x += col.w
    }
    y += headerH
    doc.setTextColor(11, 11, 11)
  }

  drawTableHeader()

  rows.forEach((rider, i) => {
    if (y + rowH > PAGE_H - 40) {
      doc.addPage()
      y = 56
      drawTableHeader()
    }
    if (i % 2 === 1) {
      doc.setFillColor(250, 250, 247)
      doc.rect(MARGIN, y, CONTENT_W, rowH, 'F')
    }
    doc.setDrawColor(232, 228, 218)
    doc.line(MARGIN, y + rowH, MARGIN + CONTENT_W, y + rowH)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    let x = MARGIN + 8
    for (const col of cols) {
      const value = String(rider[col.key] ?? '—')
      const clipped = doc.splitTextToSize(value, col.w - 10)[0]
      doc.text(clipped, x, y + 15)
      x += col.w
    }
    y += rowH
  })

  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p += 1) {
    doc.setPage(p)
    footer(doc, p, total)
  }
  saveBlob(doc, `BRSA-members-${String(season).replace('/', '-')}.pdf`)
}

export function downloadRulebookPdf(data) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const sections = data?.sections || []

  brandHeader(doc, {
    title: 'Official Rule Book',
    subtitle: data?.source || '2026 Revision',
  })

  let y = 124
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(80, 80, 80)
  doc.text('Same book Barry cites in the pitch demo. For federation use, replace with the signed office export.', MARGIN, y, {
    maxWidth: CONTENT_W,
  })
  y += 28
  doc.setTextColor(11, 11, 11)

  for (const section of sections) {
    y = ensureSpace(doc, y, 48, () => {
      y = 56
    })
    doc.setFillColor(122, 31, 43)
    doc.rect(MARGIN, y, 4, 18, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(section.heading || section.title || section.id, MARGIN + 12, y + 13)
    y += 28

    for (const entry of section.entries || []) {
      const label = entry.label || (entry.number ? `Rule ${entry.number}` : entry.id || 'Rule')
      const body = String(entry.text || '').trim()
      const note = entry.note ? `Note: ${entry.note}` : ''
      const bodyLines = doc.splitTextToSize(body, CONTENT_W - 16)
      const noteLines = note ? doc.splitTextToSize(note, CONTENT_W - 16) : []
      const blockH = 18 + bodyLines.length * 12 + (noteLines.length ? 8 + noteLines.length * 11 : 0) + 10

      y = ensureSpace(doc, y, Math.min(blockH, 120), () => {
        y = 56
      })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(122, 31, 43)
      doc.text(label, MARGIN, y)
      y += 14

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(30, 30, 30)
      for (const line of bodyLines) {
        y = ensureSpace(doc, y, 14, () => {
          y = 56
        })
        doc.text(line, MARGIN + 8, y)
        y += 12
      }

      if (noteLines.length) {
        y += 4
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8.5)
        doc.setTextColor(90, 90, 90)
        for (const line of noteLines) {
          y = ensureSpace(doc, y, 12, () => {
            y = 56
          })
          doc.text(line, MARGIN + 8, y)
          y += 11
        }
      }

      y += 10
      doc.setDrawColor(232, 228, 218)
      doc.line(MARGIN, y - 4, MARGIN + CONTENT_W, y - 4)
    }

    y += 8
  }

  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p += 1) {
    doc.setPage(p)
    footer(doc, p, total)
  }
  saveBlob(doc, 'BRSA-rulebook-2026.pdf')
}
