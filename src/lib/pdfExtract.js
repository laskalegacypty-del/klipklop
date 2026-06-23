// Shared PDF extraction utilities used by QualifierTracker and EventDay.
// pdfExtract — returns plain string items per page (for scorecard parsing).
// pdfExtractWithCoords — returns items with x/y coordinates (for layout-aware parsing).

async function loadPdfLib() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.mjs',
    import.meta.url
  ).toString()
  return pdfjsLib
}

export function extractPagesFromPDF(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const pdfjsLib = await loadPdfLib()
        const pdf = await pdfjsLib.getDocument({ data: e.target.result }).promise
        const pages = []
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          const items = content.items.map(item => String(item.str || '')).filter(Boolean)
          pages.push({ pageText: items.join(' '), items })
        }
        resolve(pages)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// Returns pages as flat arrays of { str, x, y, width, height } objects.
export function extractPagesFromPDFWithCoords(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const pdfjsLib = await loadPdfLib()
        const pdf = await pdfjsLib.getDocument({ data: e.target.result }).promise
        const pages = []
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          const coordItems = content.items
            .filter(item => item.str && item.str.trim())
            .map(item => ({
              str: item.str,
              x: item.transform[4],
              y: item.transform[5],
              width: item.width,
              height: item.height,
            }))
          pages.push(coordItems)
        }
        resolve(pages)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}
