/**
 * Turns a PDF file into plain text — entirely in the browser.
 *
 * No AI, no server, no upload. Almost every PDF already carries a text
 * layer (the actual characters, invisible behind the rendered page), and
 * pdf.js just reads it out. A 400-page book takes a couple of seconds.
 *
 * The exception is *scanned* PDFs — photographs of pages, with no text
 * layer at all. Those extract to nothing, and we detect that case below
 * so we can show a useful error instead of an empty reader.
 */
import * as pdfjsLib from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'

// pdf.js does its parsing in a Web Worker so the page never freezes.
// Vite's `?url` suffix means "give me the final URL of this file after
// bundling" — which is exactly what pdf.js wants here.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export class NoTextLayerError extends Error {
  constructor() {
    super('This PDF has no text layer — it looks like a scan.')
    this.name = 'NoTextLayerError'
  }
}

/**
 * @param file    the PDF the user picked
 * @param onProgress called with 0..1 so the UI can show a progress bar
 */
export async function extractText(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const bytes = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise

  const pages: string[] = []
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()

    // pdf.js hands back "items": short runs of text with position info.
    // `hasEOL` marks the run that ends a visual line on the page.
    let text = ''
    for (const item of content.items) {
      if (!('str' in item)) continue // skip non-text marked content
      const textItem = item as TextItem
      text += textItem.str
      if (textItem.hasEOL) text += '\n'
    }

    pages.push(text)
    page.cleanup()
    onProgress?.(pageNum / pdf.numPages)
  }

  const raw = pages.join('\n\n')
  const cleaned = cleanUp(raw)

  // A handful of stray characters means the text layer was effectively
  // empty — i.e. a scan. Better to say so than to open an empty reader.
  if (cleaned.length < 100) throw new NoTextLayerError()

  return cleaned
}

/**
 * PDFs break lines to fit the page, not to mark meaning. Left alone that
 * gives you words split across lines and paragraphs chopped into ribbons.
 * This puts the prose back together.
 */
function cleanUp(text: string): string {
  return (
    text
      // "informa-\ntion" was one word before the typesetter split it.
      .replace(/(\w)-\n(\w)/g, '$1$2')
      // A single newline is just the page's line wrap — it's still the
      // same sentence, so it becomes a space. Blank lines (two or more
      // newlines) are real paragraph breaks and survive.
      .replace(/([^\n])\n([^\n])/g, '$1 $2')
      // Collapse runs of whitespace left behind by the steps above.
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}
