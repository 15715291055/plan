export async function extractMaterialText(file: File): Promise<string> {
  if (file.type.startsWith('text/')) return (await file.text()).slice(0, 120000)
  if (file.type === 'application/pdf') {
    try {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
      const pages: string[] = []
      for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 50); pageNumber += 1) {
        const page = await pdf.getPage(pageNumber)
        const content = await page.getTextContent()
        pages.push(content.items.map(item => 'str' in item ? item.str : '').join(' '))
      }
      return pages.join('\n').slice(0, 120000)
    } catch { return '' }
  }
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    try { const mammoth = await import('mammoth/mammoth.browser'); const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() }); return result.value.slice(0, 120000) } catch { return '' }
  }
  if (file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    try {
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(await file.arrayBuffer())
      const slideNames = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort()
      const texts: string[] = []
      for (const name of slideNames) { const xml = await zip.files[name].async('text'); texts.push(xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')) }
      return texts.join('\n').slice(0, 120000)
    } catch { return '' }
  }
  return ''
}
