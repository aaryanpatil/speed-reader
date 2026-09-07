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
import { cleanUp, stripRunningHeads, type Line, type Page } from './cleanup'

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

  const pages: Page[] = []
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    pages.push({
      lines: readLines(await page.getTextContent()),
      height: page.getViewport({ scale: 1 }).height,
    })
    page.cleanup()
    onProgress?.(pageNum / pdf.numPages)
  }

  const cleaned = cleanUp(joinPages(stripRunningHeads(pages)))

  // A handful of stray characters means the text layer was effectively
  // empty — i.e. a scan. Better to say so than to open an empty reader.
  if (cleaned.length < 100) throw new NoTextLayerError()

  return cleaned
}

/**
 * pdf.js hands back "items": short runs of text, each with a position.
 * `hasEOL` marks the run that ends a visual line, so we accumulate runs
 * until one of those and call that a line.
 *
 * We keep each line's vertical position because that's what later tells
 * a running head from a first paragraph — both sit at the top of a page,
 * and by then the geometry is the only thing left to tell them apart.
 */
function readLines(content: { items: unknown[] }): Line[] {
  const lines: Line[] = []
  let text = ''
  let y = 0

  for (const item of content.items) {
    if (!item || typeof item !== 'object' || !('str' in item)) continue
    const textItem = item as TextItem
    // The line's position is that of whatever started it.
    if (text === '') y = textItem.transform[5]
    text += textItem.str
    if (textItem.hasEOL) {
      lines.push({ text, y })
      text = ''
    }
  }

  // A final run that never got its end-of-line marker.
  if (text.trim()) lines.push({ text, y })

  return lines
}

function joinPages(pages: Page[]): string {
  return pages.map((page) => page.lines.map((line) => line.text).join('\n')).join('\n\n')
}
