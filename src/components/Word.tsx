import { orpIndex } from '../lib/words'

/**
 * One word, split into three pieces so the focus letter can be pinned.
 *
 * The CSS grid behind this is `1fr auto 1fr`: the middle cell holds the
 * pivot letter and lands dead centre, while the two `1fr` cells absorb
 * whatever is left over on each side. The result is that the pivot never
 * moves between words no matter how long they are — the rest of the word
 * slides around it. That fixed point is what your eye locks onto.
 */
export function Word({ word }: { word: string }) {
  const pivot = orpIndex(word)

  return (
    <div className="word">
      <span className="word-before">{word.slice(0, pivot)}</span>
      <span className="word-pivot">{word[pivot]}</span>
      <span className="word-after">{word.slice(pivot + 1)}</span>
    </div>
  )
}
