/**
 * Turning the raw contents of a page into prose worth reading.
 *
 * Two different jobs live here. Removing the furniture a typesetter adds
 * — running heads, page numbers — and repairing the line breaks the page
 * geometry forced on the text.
 */

/** One line as it appeared on the page. */
export type Line = {
  text: string
  /** PDF y-coordinate. The origin is the page's *bottom*, so bigger is higher up. */
  y: number
}

export type Page = {
  lines: Line[]
  height: number
}

/* --- Running heads and feet ------------------------------------------

   The giveaway isn't position alone — plenty of real text starts at the
   top of a page — it's that this text *repeats*. A running head says the
   same thing on page after page, and a page number says almost the same
   thing, differing only in its digits.

   So we look only at lines near the top and bottom edge, normalise away
   the digits, and strip whatever turns out to be near-identical across a
   good fraction of the book. Body text never survives that test, because
   body text never repeats.
   --------------------------------------------------------------------- */

/** How much of the page counts as the top and bottom margin. */
const EDGE_BAND = 0.12

/** Below this, there aren't enough pages for "repeats" to mean anything. */
const MIN_PAGES = 4

/**
 * Share of pages a line must appear on before it counts as furniture.
 *
 * Set deliberately high. Chapter headings are the trap here: "CHAPTER 1"
 * and "CHAPTER 2" normalise to the same string as each other, sit near
 * the top of the page, and so look exactly like a running head to every
 * test above — the only thing separating them is how often they recur.
 * A running head is on nearly every page; even alternating verso/recto
 * heads manage half. Chapter headings reach maybe one page in ten. This
 * threshold sits in the gap between those two.
 */
const REPEAT_SHARE = 0.35

/** Digits differ from page to page, so ignore them when comparing. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
}

/** A bare page number, arabic or roman. Strip these however rare they are. */
function isPageNumber(text: string): boolean {
  const t = text.trim()
  return /^\d{1,4}$/.test(t) || /^[ivxlcdm]{1,7}$/i.test(t) || /^page\s*\d{1,4}$/i.test(t)
}

function inEdgeBand(line: Line, height: number): boolean {
  if (!height) return false
  const fromBottom = line.y / height
  return fromBottom >= 1 - EDGE_BAND || fromBottom <= EDGE_BAND
}

export function stripRunningHeads(pages: Page[]): Page[] {
  if (pages.length < MIN_PAGES) return pages

  // Count the pages each candidate shows up on. A Set per page so a line
  // repeated twice on one page still only counts once.
  const pagesContaining = new Map<string, number>()
  for (const page of pages) {
    const here = new Set<string>()
    for (const line of page.lines) {
      if (!inEdgeBand(line, page.height)) continue
      const key = normalise(line.text)
      if (key) here.add(key)
    }
    for (const key of here) {
      pagesContaining.set(key, (pagesContaining.get(key) ?? 0) + 1)
    }
  }

  const threshold = Math.max(3, Math.floor(pages.length * REPEAT_SHARE))

  return pages.map((page) => ({
    ...page,
    lines: page.lines.filter((line) => {
      // Anything away from the margins is body text; leave it alone.
      if (!inEdgeBand(line, page.height)) return true
      if (isPageNumber(line.text)) return false
      return (pagesContaining.get(normalise(line.text)) ?? 0) < threshold
    }),
  }))
}

/* --- Line repair ----------------------------------------------------- */

/**
 * PDFs break lines to fit the page, not to mark meaning. Left alone that
 * gives you words split across lines and paragraphs chopped into ribbons.
 * This puts the prose back together.
 */
export function cleanUp(text: string): string {
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

/* --- Where the book actually begins -----------------------------------

   A PDF opens with a title page, a copyright notice, a dedication and
   usually a table of contents. None of that is worth reading one word at
   a time, so we look for the first real heading and treat that as the
   start.

   The hard part is that a table of contents is *made of* headings. The
   first "Chapter One" in a book is nearly always the contents entry, not
   the chapter, so simply taking the first match lands you in the wrong
   place almost every time. Three tests below separate a contents entry
   from the real thing.
   --------------------------------------------------------------------- */

const HEADINGS = [
  /^(?:chapter|chap\.?)\s+(?:1|one|i)\b/i,
  /^part\s+(?:1|one|i)\b/i,
  /^(?:preface|prologue|introduction|foreword)\b/i,
]

/** Only look this far in; past it we'd be cutting real content. */
const FRONT_MATTER_LIMIT = 0.3

function isHeading(text: string): boolean {
  const t = text.trim()
  if (!t || t.length > 60) return false
  // A heading is a line of its own, at most a title and a subtitle. The
  // word cap is what keeps a sentence that merely opens with one of these
  // words — "Introduction to the theory of..." — from counting as one.
  if (t.split(/\s+/).length > 8) return false
  return HEADINGS.some((re) => re.test(t))
}

/** The index of the line the reader should open on, or 0 if unsure. */
export function findContentStart(lines: string[]): number {
  const limit = Math.floor(lines.length * FRONT_MATTER_LIMIT)
  const marks: number[] = []
  for (let i = 0; i < lines.length && i <= limit; i++) {
    if (isHeading(lines[i])) marks.push(i)
  }

  for (const i of marks) {
    const line = lines[i].trim()

    // 1. Contents entries carry the page they point at, usually behind a
    //    row of dot leaders or a wide gap. Real headings cite no page.
    //    Front matter is numbered in roman, so "Preface ..... ix" has to
    //    be caught as readily as "Chapter One ..... 1".
    if (/\.{2,}\s*[\divxlcdm]+$/i.test(line)) continue
    if (/\s{2,}[\divxlcdm]+$/i.test(line)) continue
    if (/\s\d{1,4}$/.test(line)) continue

    // 2. Contents entries come in a crowd. A real chapter opening has
    //    prose after it, not four more headings.
    if (marks.filter((j) => j > i && j <= i + 30).length >= 3) continue

    // 3. Whatever follows should actually read like a chapter.
    const following = lines
      .slice(i + 1, i + 40)
      .join(' ')
      .split(/\s+/)
      .filter(Boolean).length
    if (following < 120) continue

    return i
  }

  return 0
}
