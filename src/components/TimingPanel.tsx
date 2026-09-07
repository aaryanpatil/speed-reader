import { TIMING_RANGE, type TimingOptions } from '../lib/words'

type Props = {
  timing: TimingOptions
  onChange: (timing: TimingOptions) => void
  /** Master switch. Off means an even metronome, knobs ignored. */
  rhythm: boolean
  onRhythmChange: (on: boolean) => void
  onReset: () => void
  /** Faded out while reading — never unmounted, so nothing shifts. */
  hidden: boolean
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
  disabled: boolean
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
 * The pauses are the two settings worth a control. Word length also
 * varies the timing — it's what keeps "a" and "the" from dwelling as long
 * as "circumstances" — but the effect is subtle enough that a slider for
 * it was clutter, so it stays at its default and out of the way.
 */
export function TimingPanel({
  timing,
  onChange,
  rhythm,
  onRhythmChange,
  onReset,
  hidden,
}: Props) {
  const set = (key: keyof TimingOptions) => (value: number) =>
    onChange({ ...timing, [key]: value })

  return (
    <div className={`tuning ${hidden ? 'tuning-hidden' : ''}`} aria-hidden={hidden}>
      <div className="tuning-head">
        <span className="tuning-title">Timings</span>
        <button
          className={`switch ${rhythm ? 'switch-on' : 'switch-off'}`}
          onClick={() => onRhythmChange(!rhythm)}
          aria-pressed={rhythm}
          tabIndex={hidden ? -1 : 0}
        >
          {rhythm ? 'on' : 'off'}
        </button>
        <button className="tuning-reset" onClick={onReset} tabIndex={hidden ? -1 : 0}>
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
  )
}
