// Renders the first page of a PDF (as a data URL) to a small JPEG for list previews.
// pdf.js is loaded only when needed so it stays out of the main bundle.
export async function pdfThumbnail(dataUrl: string, width = 320): Promise<string | null> {
  try {
    const [pdfjs, worker] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ])
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    const bytes = Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(',') + 1)), c => c.charCodeAt(0))
    const task = pdfjs.getDocument({ data: bytes })
    const doc = await task.promise
    try {
      const page = await doc.getPage(1)
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: width / base.width })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      await page.render({ canvas, viewport, background: '#FFFFFF' }).promise
      return canvas.toDataURL('image/jpeg', 0.8)
    } finally {
      await task.destroy()
    }
  } catch {
    return null
  }
}
