/** Splitting text into words, and finding each word's focus letter. */

/** Text -> the list of words the reader flips through. */
export function tokenize(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0)
}

/**
 * The Optimal Recognition Point: the letter your eye should land on.
 *
 * When you read normally your eye doesn't land on the *start* of a word,
 * it lands slightly left of centre — and from there it recognises the
 * whole word at once. If we flash words centred on their midpoint, your
 * eye has to hunt for that spot every single time, which is what makes
 * naive word-flashers exhausting.
 *
 * So instead we pick that letter per word and pin *it* to a fixed point
 * on screen. The word shifts around the letter; your eye never moves.
 * That is the single biggest reason this technique works at speed.
 *
 * The offsets below are the standard length-based approximation.
 */
export function orpIndex(word: string): number {
  const n = word.length
  if (n <= 1) return 0
  if (n <= 5) return 1
  if (n <= 9) return 2
  if (n <= 13) return 3
  return 4
}

/** Milliseconds each word should stay on screen at a given words-per-minute. */
export function msPerWord(wpm: number): number {
  return 60_000 / wpm
}
