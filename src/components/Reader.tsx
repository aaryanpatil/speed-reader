import { useEffect, useMemo, useRef, useState } from 'react'
import { Word } from './Word'
import { msPerWord, tokenize } from '../lib/words'
import type { Book } from '../lib/storage'

type Props = {
  book: Book
  onExit: () => void
}

export function Reader({ book, onExit }: Props) {
  // Splitting the text is pure work that only depends on the book, so
  // `useMemo` keeps it from re-running on every render.
  const words = useMemo(() => tokenize(book.text), [book.text])

  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [wpm, setWpm] = useState(300)

  // The animation loop below is set up once and then runs for a while, so
  // it can't read `wpm` directly — it would capture whatever the value was
  // at setup time. A ref is a mutable box the loop can read the *current*
  // value out of on every frame, which is what lets the speed slider take
  // effect mid-sentence.
  const wpmRef = useRef(wpm)
  wpmRef.current = wpm

  useEffect(() => {
    if (!playing) return

    let frame = 0
    let lastFlip = performance.now()

    const tick = (now: number) => {
      if (now - lastFlip >= msPerWord(wpmRef.current)) {
        lastFlip = now
        setIndex((i) => {
          if (i + 1 >= words.length) {
            setPlaying(false)
            return i
          }
          return i + 1
        })
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    // React runs this cleanup when we pause or leave, so the loop never
    // outlives the component.
    return () => cancelAnimationFrame(frame)
  }, [playing, words.length])

  const atEnd = index >= words.length - 1
  const progress = words.length > 1 ? index / (words.length - 1) : 0

  function toggle() {
    // Tapping play at the very end starts over rather than doing nothing.
    if (atEnd && !playing) setIndex(0)
    setPlaying((p) => !p)
  }

  return (
    <div className="reader">
      <div className="progress" style={{ transform: `scaleX(${progress})` }} />

      <button className="exit" onClick={onExit} title="Load another book">
        ←
      </button>

      {/* The whole stage is the play/pause target, so no button competes
          with the word for your attention while you're reading. */}
      <div className="stage" onClick={toggle}>
        {/* The two rules are a landing strip for your eye: they mark the
            fixed point the pivot letter always appears between. */}
        <div className="guide guide-top" />
        <Word word={words[index] ?? ''} />
        <div className="guide guide-bottom" />
      </div>

      <div className="controls" onClick={(e) => e.stopPropagation()}>
        <input
          type="range"
          min={100}
          max={1000}
          step={25}
          value={wpm}
          onChange={(e) => setWpm(Number(e.target.value))}
          aria-label="Words per minute"
        />
        <span className="wpm">{wpm} wpm</span>
      </div>

      <div className={`hint ${playing ? 'hint-hidden' : ''}`}>
        {atEnd ? 'tap to read again' : 'tap to ' + (playing ? 'pause' : 'start')}
      </div>
    </div>
  )
}
