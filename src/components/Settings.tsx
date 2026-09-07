import { useEffect } from 'react'
import { TIMING_RANGE, type TimingOptions } from '../lib/words'

type Props = {
  wpm: number
  onWpmChange: (wpm: number) => void
  timing: TimingOptions
  onTimingChange: (timing: TimingOptions) => void
  /** Master switch. Off means an even metronome, knobs ignored. */
  rhythm: boolean
  onRhythmChange: (on: boolean) => void
  onReset: () => void
  onClose: () => void
}

/** One labelled slider. */
function Knob({
  label,
  value,
  range,
  format,
  disabled,
  onChange,
}: {
  label: string
  value: number
  range: { min: number; max: number; step: number }
  format: (v: number) => string
  disabled?: boolean
  onChange: (v: number) => void
}) {
  return (
    <label className="knob">
      <span className="knob-label">{label}</span>
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="knob-value">{format(value)}</span>
    </label>
  )
}

/**
 * Everything adjustable, in one sheet over a blurred reader.
 *
 * It lives here rather than along the bottom of the screen because a
 * phone held sideways has almost no vertical room: a permanent strip of
 * controls and a centred word cannot both fit. Out of the flow entirely,
 * the word keeps the middle of the screen at every size.
 *
 * Word length also varies the timing — it's what keeps "a" from dwelling
 * as long as "circumstances" — but the effect is too subtle to be worth
 * a control, so it stays at its default and out of the way.
 */
export function Settings({
  wpm,
  onWpmChange,
  timing,
  onTimingChange,
  rhythm,
  onRhythmChange,
  onReset,
  onClose,
}: Props) {
  const set = (key: keyof TimingOptions) => (value: number) =>
    onTimingChange({ ...timing, [key]: value })

  // Escape is what people try first to dismiss something like this.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    // Closing on pointerdown rather than click, so that releasing a slider
    // drag outside the sheet doesn't count as a press on the backdrop.
    <div className="scrim" onPointerDown={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <span className="sheet-title">Settings</span>
          <button className="sheet-close" onClick={onClose} aria-label="Close settings">
            ×
          </button>
        </div>

        <Knob
          label="Speed"
          value={wpm}
          range={{ min: 100, max: 1000, step: 25 }}
          format={(v) => `${v} wpm`}
          onChange={onWpmChange}
        />

        <div className="sheet-rule" />

        <div className="tuning-head">
          <span className="tuning-title">Timings</span>
          <button
            className={`switch ${rhythm ? 'switch-on' : 'switch-off'}`}
            onClick={() => onRhythmChange(!rhythm)}
            aria-pressed={rhythm}
          >
            {rhythm ? 'on' : 'off'}
          </button>
          <button className="tuning-reset" onClick={onReset}>
            Reset
          </button>
        </div>

        <Knob
          label="Clause Pause"
          value={timing.clausePause}
          range={TIMING_RANGE.clausePause}
          format={(v) => (v === 1 ? 'none' : `${v.toFixed(2)}×`)}
          disabled={!rhythm}
          onChange={set('clausePause')}
        />
        <Knob
          label="Sentence Pause"
          value={timing.sentencePause}
          range={TIMING_RANGE.sentencePause}
          format={(v) => (v === 1 ? 'none' : `${v.toFixed(2)}×`)}
          disabled={!rhythm}
          onChange={set('sentencePause')}
        />
      </div>
    </div>
  )
}
