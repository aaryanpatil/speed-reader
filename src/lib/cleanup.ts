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
      // Some PDFs carry glyphs their font never mapped back to characters,
      // which arrive as runs of nulls. They are invisible on screen but
      // would be read out as words, so they go first.
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]+/g, '')
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
   usually a table of contents. None of it is worth reading one word at a
   time.

   Looking for the word "Chapter" doesn't find the start, because plenty
   of books don't use it — the one this was first tested against numbers
   its chapters with a bare "1" — and a table of contents is itself made
   of headings, so the first match is usually a contents entry anyway.

   What separates front matter from the book is shape rather than
   wording. Front matter is fragments: titles, names, a list of previous
   works, contents entries. Body text is sustained full-measure lines,
   paragraph after paragraph. So we find where that begins, then step
   back over the few short lines that introduce it.
   --------------------------------------------------------------------- */

/** Only look this far in; past it we would be cutting real content. */
const FRONT_MATTER_LIMIT = 0.3

/** A line long enough to be a full line of a paragraph rather than a fragment. */
const FULL_LINE = 55

/** How many consecutive lines to judge, and how many must be full. */
const PROSE_WINDOW = 12
const PROSE_SHARE = 0.75

/** How far back from the prose to look for the heading that introduces it. */
const HEADING_LOOKBACK = 6

/**
 * Lines that open a chapter. Only consulted just above where the prose
 * starts, so these can afford to be loose — a bare number is meaningless
 * on its own, but directly above a wall of prose it is a chapter number.
 */
const OPENINGS = [
  /^\d{1,3}[.:]?$/,
  /^(?:chapter|chap\.?|part|book)\s+\S+/i,
  /^(?:preface|prologue|introduction|foreword|epilogue)\b/i,
  /^(?:one|two|three|i{1,3})$/i,
]

/** The first line of sustained paragraph text. */
function findProseStart(lines: string[]): number {
  const limit = Math.floor(lines.length * FRONT_MATTER_LIMIT)
  const needed = Math.ceil(PROSE_WINDOW * PROSE_SHARE)

  for (let i = 0; i <= limit && i + PROSE_WINDOW <= lines.length; i++) {
    let full = 0
    for (let j = i; j < i + PROSE_WINDOW; j++) {
      if (lines[j].trim().length >= FULL_LINE) full++
    }
    if (full >= needed) {
      // The window allows a quarter of its lines to be short, so it can
      // open a few lines before the prose actually does. Step forward to
      // the first full line so the start is exact.
      let j = i
      while (j < lines.length && lines[j].trim().length < FULL_LINE) j++
      return j
    }
  }
  return 0
}

/** The index of the line the reader should open on, or 0 if unsure. */
export function findContentStart(lines: string[]): number {
  const prose = findProseStart(lines)
  if (prose === 0) return 0

  // Between the contents and the first paragraph sit a handful of short
  // lines — a chapter number, its title, sometimes a date and place. Walk
  // back over them looking for the one that opens the chapter, and take
  // the highest such line so the number is included along with the title.
  let start = prose
  for (let i = prose - 1; i >= 0 && prose - i <= HEADING_LOOKBACK; i--) {
    const line = lines[i].trim()
    // Another paragraph, so we were already inside the body text.
    if (line.length >= FULL_LINE) break
    // A contents entry cites the page it points at. Stop here, or a
    // contents laid out close to the first chapter would pull us back
    // into it — "Chapter Four ..... 78" reads as an opening otherwise.
    if (/\.{2,}\s*[\divxlcdm]+$/i.test(line)) break
    if (/\s{2,}[\divxlcdm]+$/i.test(line)) break
    if (OPENINGS.some((re) => re.test(line))) start = i
  }

  // Barely anything to skip means there was no front matter to speak of,
  // and we'd only be dropping the title off the front of a paper.
  return start < 3 ? 0 : start
}
