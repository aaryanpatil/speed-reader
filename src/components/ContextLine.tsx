/**
 * The line of surrounding text shown while you're paused.
 *
 * Same `1fr auto 1fr` grid as the big word, so the current word sits in
 * the centre column directly beneath it. The two side columns take
 * whatever space is left and clip anything that doesn't fit, which is
 * what makes this "however many words fit on one line" rather than a
 * fixed count — a wide window shows more, a phone shows less.
 */

/** Enough words to overflow any sensible screen; CSS decides what shows. */
const SPAN = 12

type Props = {
  words: string[]
  index: number
  visible: boolean
}

export function ContextLine({ words, index, visible }: Props) {
  const before = words.slice(Math.max(0, index - SPAN), index).join(' ')
  const after = words.slice(index + 1, index + 1 + SPAN).join(' ')

  return (
    <div className={`context ${visible ? '' : 'context-hidden'}`}>
      {/* The inner spans are what actually overflow; the outer ones clip
          them, each from its own outer edge. */}
      <span className="context-side context-before">
        <span>{before}</span>
      </span>
      <span className="context-current">{words[index] ?? ''}</span>
      <span className="context-side context-after">
        <span>{after}</span>
      </span>
    </div>
  )
}
