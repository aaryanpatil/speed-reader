import { useEffect, type ReactNode } from 'react'

type Props = {
  title: string
  onClose: () => void
  children: ReactNode
  /** A little more measure, for a sheet that is mostly prose. */
  wide?: boolean
}

/**
 * A panel over a blurred page: the shell both the settings and the
 * explanation share.
 *
 * Whatever sits behind it must be a *sibling* of this, never a parent.
 * `filter: blur()` applies to every descendant and also makes the blurred
 * element a containing block for fixed positioning, so a sheet nested
 * inside the thing it blurs would end up blurred and trapped within it.
 */
export function Sheet({ title, onClose, children, wide }: Props) {
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
        className={`sheet ${wide ? 'sheet-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <span className="sheet-title">{title}</span>
          <button className="sheet-close" onClick={onClose} aria-label={`Close ${title}`}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
