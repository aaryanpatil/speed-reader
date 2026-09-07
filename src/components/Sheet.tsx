import { useEffect, useRef, useState, type ReactNode } from 'react'

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
  const body = useRef<HTMLDivElement>(null)
  // Which edges have content beyond them, and so should fade away rather
  // than end in a hard cut.
  const [more, setMore] = useState({ above: false, below: false })

  // Escape is what people try first to dismiss something like this.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const el = body.current
    if (!el) return

    const update = () => {
      const scrollable = el.scrollHeight - el.clientHeight
      // A pixel of slack: browsers round fractional scroll positions, and
      // without it the bottom fade can linger when you're already there.
      setMore({
        above: el.scrollTop > 1,
        below: scrollable > 1 && el.scrollTop < scrollable - 1,
      })
    }

    update()
    el.addEventListener('scroll', update, { passive: true })
    // Catches the sheet changing height — rotating a phone, or the
    // on-screen keyboard opening — not just the scrolling itself.
    const observer = new ResizeObserver(update)
    observer.observe(el)

    return () => {
      el.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [])

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
        {/* Outside the scrolling area, so the title and the way out stay
            put however far down the content you are. */}
        <div className="sheet-head">
          <span className="sheet-title">{title}</span>
          <button className="sheet-close" onClick={onClose} aria-label={`Close ${title}`}>
            ×
          </button>
        </div>

        <div
          ref={body}
          className={`sheet-body ${more.above ? 'fade-above' : ''} ${
            more.below ? 'fade-below' : ''
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
