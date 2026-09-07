/** Splitting text into words, finding each word's focus letter, and timing. */

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

/* --- Variable timing --------------------------------------------------

   A flat metronome is the single thing that makes RSVP harder to follow
   than it needs to be. "a" and "circumstances" are not the same amount
   of reading, and a full stop is a place your mind wants a beat to close
   the sentence off. Holding every word for exactly the same time spends
   too long on the short ones and rushes the rest.

   So each word gets a weight — a relative share of time — from its
   length and whatever punctuation it carries. The weights are relative
   on purpose: they are divided by their own average, so words borrow and
   lend time from each other while the *rate* stays whatever you set.
   Without that, every multiplier here would only ever add time and 300
   wpm would quietly become 230.

   The work is split in two because the settings are live. Reading each
   word — the regex part — happens once per book. Turning those readings
   into weights is arithmetic only, cheap enough to redo on every frame
   of a slider drag across ninety thousand words.
   --------------------------------------------------------------------- */

/** A word of this length reads at the base rate; longer costs more. */
const LENGTH_PIVOT = 5
const LENGTH_MIN = 0.75
const LENGTH_MAX = 1.9

export type TimingOptions = {
  /**
   * Added weight per character beyond the pivot length. 0 is off.
   * Not exposed as a control — the effect is real but too subtle to be
   * worth a slider, so it simply stays at its default.
   */
  lengthStep: number
  /** Multiplier for a word that ends a sentence. 1 is off. */
  sentencePause: number
  /** Multiplier for a word that ends a clause. 1 is off. */
  clausePause: number
}

export const DEFAULT_TIMING: TimingOptions = {
  lengthStep: 0.045,
  sentencePause: 2.0,
  clausePause: 1.45,
}

/** Every knob neutral: an even metronome, the same time for every word. */
export const FLAT_TIMING: TimingOptions = {
  lengthStep: 0,
  sentencePause: 1,
  clausePause: 1,
}

/** The bounds the interface offers. Beyond these it stops reading well. */
export const TIMING_RANGE = {
  clausePause: { min: 1, max: 2.5, step: 0.05 },
  sentencePause: { min: 1, max: 3, step: 0.05 },
} as const

/** What a word ends with, once. */
export const enum Mark {
  None = 0,
  Clause = 1,
  Sentence = 2,
}

/** Everything about a word that affects its timing, read once. */
export type WordShape = {
  length: number
  mark: Mark
}

// Closing quotes and brackets sit outside the mark, so allow for them.
// String.raw, because in a plain template literal the escape before the
// bracket is dropped and the character class closes early.
const TRAILING = String.raw`["'”’)\]]*$`
const SENTENCE_END = new RegExp(`[.!?…]${TRAILING}`)
const CLAUSE_END = new RegExp(`[,;:—–]${TRAILING}`)

/** Strip anything that isn't a letter or digit from both ends. */
function core(word: string): string {
  return word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
}

/** The regex pass. Done once per book, never on a settings change. */
export function analyseWords(words: string[]): WordShape[] {
  return words.map((word) => {
    const letters = core(word)
    const length = letters.length || word.length

    if (SENTENCE_END.test(word)) {
      // "Mr." and "e.g." end in a full stop without ending a sentence,
      // and nothing that short is one. Give them a clause beat instead.
      return { length, mark: letters.length <= 2 ? Mark.Clause : Mark.Sentence }
    }
    if (CLAUSE_END.test(word)) return { length, mark: Mark.Clause }
    return { length, mark: Mark.None }
  })
}

/**
 * Weights for a whole text, divided through by their own average.
 *
 * That division is what keeps the speed control honest: the numbers come
 * out centred on 1, so a word of average weight takes exactly the time
 * the chosen rate asks for, and the text as a whole still runs at it —
 * whatever the knobs below are set to.
 */
export function timingWeights(shapes: WordShape[], options: TimingOptions): number[] {
  if (shapes.length === 0) return []

  const raw = shapes.map((shape) => {
    const weight = Math.min(
      Math.max(1 + (shape.length - LENGTH_PIVOT) * options.lengthStep, LENGTH_MIN),
      LENGTH_MAX,
    )
    if (shape.mark === Mark.Sentence) return weight * options.sentencePause
    if (shape.mark === Mark.Clause) return weight * options.clausePause
    return weight
  })

  const mean = raw.reduce((sum, w) => sum + w, 0) / raw.length
  return raw.map((w) => w / mean)
}
