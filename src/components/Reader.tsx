import { useEffect, useMemo, useRef, useState } from 'react'
import { Word } from './Word'
import { ContextLine } from './ContextLine'
import {
  DEFAULT_TIMING,
  FLAT_TIMING,
  analyseWords,
  msPerWord,
  timingWeights,
  tokenize,
  type TimingOptions,
} from '../lib/words'
import { Settings } from './Settings'
import type { Book } from '../lib/storage'

/** How far you drag to move one word. Smaller = twitchier scrubbing. */
const PX_PER_WORD = 22

/** Movement under this is a click, not a drag. Absorbs hand tremor. */
const DRAG_SLOP = 4

/**
 * How far out from the centre the edge acceleration starts, as a fraction
 * of the distance from centre to edge. Everything inside this is a dead
 * zone where only your hand moves the text — otherwise the page would
 * creep whenever you tried to hold still.
 */
const EDGE_DEAD_ZONE = 0.25

/** Words per second at the very edge of the screen. */
const EDGE_MAX_WPS = 90

/**
 * How long you must hold before edge acceleration engages. Without this a
 * quick tap near the edge would fly off through the text instead of
 * pausing, since a tap is also a press that happens to be near an edge.
 */
const HOLD_DELAY_MS = 200

type Props = {
  book: Book
  onExit: () => void
}

type Drag = {
  startX: number
  startIndex: number
  pointerX: number
  /** Centre of the stage and half its width, for the edge ramp. */
  centre: number
  half: number
  /** Fractional words accumulated by edge acceleration. */
  offset: number
  moved: boolean
  startTime: number
  lastFrame: number
}

export function Reader({ book, onExit }: Props) {
  // Splitting the text is pure work that only depends on the book, so
  // `useMemo` keeps it from re-running on every render.
  const words = useMemo(() => tokenize(book.text), [book.text])

  // Opens past the front matter. Nothing is thrown away, though — seeking
  // back before this point still reaches the title and copyright pages,
  // which matters because the detection is a guess and can be wrong.
  const [index, setIndex] = useState(book.startWord)
  const [playing, setPlaying] = useState(false)
  const [wpm, setWpm] = useState(300)
  const [scrubbing, setScrubbing] = useState(false)
  const [timing, setTiming] = useState<TimingOptions>(DEFAULT_TIMING)
  const [rhythm, setRhythm] = useState(true)
  const [settings, setSettings] = useState(false)

  // Reading each word is the expensive half and depends only on the book.
  const shapes = useMemo(() => analyseWords(words), [words])

  // Turning those readings into weights is arithmetic, so it can rerun on
  // every frame of a slider drag without the settings feeling sticky.
  const weights = useMemo(
    () => timingWeights(shapes, rhythm ? timing : FLAT_TIMING),
    [shapes, rhythm, timing],
  )

  // The animation loop below is set up once and then runs for a while, so
  // it can't read `wpm` directly — it would capture whatever the value was
  // at setup time. A ref is a mutable box the loop can read the *current*
  // value out of on every frame, which is what lets the speed slider take
  // effect mid-sentence.
  const wpmRef = useRef(wpm)
  wpmRef.current = wpm

  // Lets the loop pick up wherever a seek left us when playback resumes.
  const indexRef = useRef(index)
  indexRef.current = index

  // Read through a ref for the same reason as the rate: adjusting timing
  // mid-sentence should take effect on the next word, not tear down and
  // restart the loop underneath you.
  const weightsRef = useRef(weights)
  weightsRef.current = weights

  useEffect(() => {
    if (!playing) return

    let frame = 0
    let lastFlip = performance.now()
    // Its own cursor, seeded from wherever we are now. The loop has to
    // know which word is showing in order to time *that* word, and a
    // state update won't have landed by the next frame.
    let at = indexRef.current

    const tick = (now: number) => {
      // A word of average weight gets exactly the chosen rate; the rest
      // borrow and lend around it.
      const dwell = msPerWord(wpmRef.current) * (weightsRef.current[at] ?? 1)

      if (now - lastFlip >= dwell) {
        lastFlip = now
        at += 1
        if (at >= words.length) {
          setPlaying(false)
          return
        }
        setIndex(at)
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
    // Tapping play at the very end starts over rather than doing nothing —
    // back to where the book began, not back into the copyright page.
    if (atEnd && !playing) setIndex(book.startWord)
    setPlaying((p) => !p)
  }

  /* --- Seeking -------------------------------------------------------
     Two things move the text at once:

       1. Your hand.  Drag distance maps straight to words, so near the
          centre you have exact, reversible control.
       2. The edges.  Past the dead zone, the text keeps moving on its own
          for as long as you hold there, faster the further out you go.
          This is what lets you cross a chapter without a dozen swipes.

     They simply add together, and because the ramp starts at zero the
     handover between them is seamless — there's no point where control
     jumps from one to the other.

     A press also still means play/pause. We can't know which it is at
     pointerdown, so nothing is decided there: we record the press and see
     whether it turns into movement. `drag` holds that pending state in a
     ref rather than state, since changing it mid-gesture shouldn't cause
     a re-render.
     ------------------------------------------------------------------- */
  const drag = useRef<Drag | null>(null)
  const seekFrame = useRef(0)

  /** Words per second contributed by holding near an edge. */
  function edgeVelocity(d: Drag): number {
    // -1 at the left edge, 0 at the centre, +1 at the right edge.
    const from = (d.pointerX - d.centre) / d.half
    const magnitude = Math.abs(from)
    if (magnitude < EDGE_DEAD_ZONE) return 0

    // Renormalise so the ramp starts at 0 right where the dead zone ends,
    // then square it: gentle as you cross the threshold, urgent at the
    // very edge. A linear ramp feels like it lurches on.
    const t = (magnitude - EDGE_DEAD_ZONE) / (1 - EDGE_DEAD_ZONE)
    const speed = EDGE_MAX_WPS * t * t

    // Negative on the right, matching the drag: pushing right walks you
    // back through the text.
    return from > 0 ? -speed : speed
  }

  /** One frame of seeking, while a pointer is held down. */
  function seekTick(now: number) {
    const d = drag.current
    if (!d) return

    const dt = (now - d.lastFrame) / 1000
    d.lastFrame = now

    // Has this press become a gesture yet?
    if (!d.moved && Math.abs(d.pointerX - d.startX) >= DRAG_SLOP) {
      d.moved = true
    }

    if (now - d.startTime >= HOLD_DELAY_MS) {
      const velocity = edgeVelocity(d)
      if (velocity !== 0) {
        d.offset += velocity * dt
        // Holding at an edge counts as a gesture too, so releasing there
        // doesn't also toggle playback.
        d.moved = true
      }
    }

    if (d.moved) {
      setScrubbing(true)
      setPlaying(false)

      let target = d.startIndex - (d.pointerX - d.startX) / PX_PER_WORD + d.offset

      // Hitting either end bleeds the accumulated offset back off, so the
      // text starts moving again the instant you reverse instead of first
      // having to unwind however long you sat against the boundary.
      const max = words.length - 1
      if (target < 0) {
        d.offset -= target
        target = 0
      } else if (target > max) {
        d.offset -= target - max
        target = max
      }

      setIndex(Math.round(target))
    }

    seekFrame.current = requestAnimationFrame(seekTick)
  }

  function onPointerDown(e: React.PointerEvent) {
    // Capture means we keep getting move events even if the pointer
    // leaves the element, so a fast drag doesn't just stop dead.
    e.currentTarget.setPointerCapture(e.pointerId)

    const rect = e.currentTarget.getBoundingClientRect()
    const now = performance.now()
    drag.current = {
      startX: e.clientX,
      startIndex: index,
      pointerX: e.clientX,
      centre: rect.left + rect.width / 2,
      half: rect.width / 2,
      offset: 0,
      moved: false,
      startTime: now,
      lastFrame: now,
    }

    // The loop has to run even while the pointer is still, because edge
    // acceleration is about *where* you're holding, not whether you move.
    seekFrame.current = requestAnimationFrame(seekTick)
  }

  function onPointerMove(e: React.PointerEvent) {
    // Only records position — seekTick does all the work, on its own clock.
    if (drag.current) drag.current.pointerX = e.clientX
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current
    drag.current = null
    cancelAnimationFrame(seekFrame.current)
    e.currentTarget.releasePointerCapture(e.pointerId)
    setScrubbing(false)

    // Never became a gesture, so it was a plain tap after all. A seek just
    // leaves you parked on the new word, paused and ready to resume there.
    if (d && !d.moved) toggle()
  }

  // Belt and braces: if this component goes away mid-gesture the loop
  // would otherwise keep running against a dead component.
  useEffect(() => () => cancelAnimationFrame(seekFrame.current), [])

  return (
    <div className="reader">
      <div className="progress" style={{ transform: `scaleX(${progress})` }} />

      <button className="exit" onClick={onExit} title="Load another book">
        ←
      </button>

      {/* The whole stage is the play/pause and seek target, so no control
          competes with the word for your attention while you're reading. */}
      <div
        className={`stage ${scrubbing ? 'stage-scrubbing' : ''} ${
          settings ? 'stage-behind' : ''
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Above the word, where there is nothing else to collide with.
            Its height is always reserved, so the word doesn't shift when
            the hint fades away. */}
        <div className={`hint ${playing ? 'hint-hidden' : ''}`}>
          {atEnd ? 'tap to read again' : 'tap to start · drag to seek'}
        </div>

        {/* The two rules are a landing strip for your eye: they mark the
            fixed point the pivot letter always appears between. */}
        <div className="guide guide-top" />
        <Word word={words[index] ?? ''} />
        <div className="guide guide-bottom" />
        {/* Only while stopped — surrounding text during playback would
            pull your eye off the pivot, which is the one thing to avoid. */}
        <ContextLine words={words} index={index} visible={!playing} />
      </div>

      {/* Only while stopped, like everything else that isn't the word.
          Opening it doesn't disturb playback: it is only reachable from a
          pause, and closing returns you to that same pause. */}
      <button
        className={`gear ${playing ? 'gear-hidden' : ''}`}
        onClick={() => setSettings(true)}
        aria-label="Settings"
        tabIndex={playing ? -1 : 0}
      >
        <svg viewBox="0 0 16 16" width="17" height="17" aria-hidden="true">
          <line x1="1.5" y1="5" x2="14.5" y2="5" />
          <line x1="1.5" y1="11" x2="14.5" y2="11" />
          <circle cx="5.5" cy="5" r="2.1" />
          <circle cx="10.5" cy="11" r="2.1" />
        </svg>
      </button>

      {settings && (
        <Settings
          wpm={wpm}
          onWpmChange={setWpm}
          timing={timing}
          onTimingChange={setTiming}
          rhythm={rhythm}
          onRhythmChange={setRhythm}
          onReset={() => {
            setTiming(DEFAULT_TIMING)
            setRhythm(true)
          }}
          onClose={() => setSettings(false)}
        />
      )}

    </div>
  )
}
