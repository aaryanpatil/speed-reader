import { useMemo, useRef, useState } from 'react'
import { parsePdf, NoTextLayerError } from '../lib/pdf'
import { cleanUp } from '../lib/cleanup'
import { tokenize } from '../lib/words'
import { saveBook, type Book } from '../lib/storage'
import { About } from './About'

/**
 * Characters accepted in one paste — roughly seventeen thousand words, or
 * an hour of reading. Long enough for any article or chapter, and short
 * enough that a textarea holding it still types smoothly. A whole book
 * belongs in the PDF path, where it never has to sit in a text field.
 */
const PASTE_LIMIT = 100_000

type Props = {
  onReady: (book: Book) => void
}

/** Pasted text has no filename, so name it after how it opens. */
function titleFrom(text: string): string {
  const words = tokenize(text)
  if (words.length === 0) return 'Pasted text'
  const opening = words.slice(0, 6).join(' ')
  // Compared by word count, not string length: collapsed whitespace makes
  // the joined opening shorter than its own source even when it is all
  // of it, which would put an ellipsis on a complete title.
  return words.length > 6 ? `${opening}…` : opening
}

export function Upload({ onReady }: Props) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [about, setAbout] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [pasted, setPasted] = useState('')
  const [trimmed, setTrimmed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const pastedWords = useMemo(() => tokenize(pasted).length, [pasted])

  async function open(book: Book) {
    await saveBook(book)
    onReady(book)
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('That needs to be a PDF.')
      return
    }

    setError(null)
    setBusy(true)
    setProgress(0)

    try {
      const { text, startWord } = await parsePdf(file, setProgress)
      // Only the extracted text is kept. The PDF goes out of scope here
      // and the browser reclaims it.
      await open({
        id: crypto.randomUUID(),
        title: file.name.replace(/\.pdf$/i, ''),
        text,
        wordCount: tokenize(text).length,
        addedAt: Date.now(),
        startWord,
      })
    } catch (err) {
      setError(
        err instanceof NoTextLayerError
          ? "This PDF is a scan — there's no text in it to read yet."
          : "Couldn't read that PDF.",
      )
      setBusy(false)
    }
  }

  async function handlePaste() {
    // The same tidying a PDF gets: text copied out of one carries the
    // same broken line wraps and split words.
    const text = cleanUp(pasted)
    if (tokenize(text).length === 0) {
      setError("There's nothing to read there.")
      return
    }

    setError(null)
    // Nothing to skip: pasted text has no title or copyright page.
    await open({
      id: crypto.randomUUID(),
      title: titleFrom(text),
      text,
      wordCount: tokenize(text).length,
      addedAt: Date.now(),
      startWord: 0,
    })
  }

  return (
    <>
      <button className="info" onClick={() => setAbout(true)} aria-label="How It Works">
        <svg viewBox="0 0 16 16" width="17" height="17" aria-hidden="true">
          <circle cx="8" cy="8" r="6.6" />
          <line x1="8" y1="7.2" x2="8" y2="11.4" />
          <circle cx="8" cy="4.8" r="0.55" className="info-dot" />
        </svg>
      </button>

      {/* A sibling of the page it blurs, not a descendant: `filter` would
          otherwise blur the sheet too and trap its fixed positioning. */}
      {about && <About onClose={() => setAbout(false)} />}

      <div className={`upload ${about ? 'upload-behind' : ''}`}>
        <header className="intro">
          {/* The one red letter is the same idea the reader runs on, shown
            rather than described. */}
          <h1 className="intro-title">
            Speed Re<span className="intro-pivot">a</span>der
          </h1>
          <p className="intro-lede">One word at a time, at a pace you set.</p>
          <p className="intro-body">
            Ordinary reading spends much of its effort just moving your eyes — hopping
            from word to word, slipping back over lines you have already read. Here the
            words come to you instead, each one placed so the letter your eye lands on
            sits in the same spot every time. With nothing to track, the effort goes
            into reading rather than looking.
          </p>
        </header>

        {/* One slot, two ways in. Swapping rather than stacking keeps the
            page the same height whichever you use. */}
        {busy ? (
          <div className="parsing">
            <div className="parsing-bar">
              <div style={{ transform: `scaleX(${progress})` }} />
            </div>
            <p className="muted">reading {Math.round(progress * 100)}%</p>
          </div>
        ) : pasting ? (
          <div className="paste">
            <textarea
              className="paste-box"
              value={pasted}
              autoFocus
              placeholder="Paste anything you want to read"
              aria-label="Text to read"
              onChange={(e) => {
                const value = e.target.value
                // Trimmed here rather than with maxLength, so that we know
                // it happened and can say so instead of quietly dropping
                // the end of what someone pasted.
                setTrimmed(value.length > PASTE_LIMIT)
                setPasted(value.slice(0, PASTE_LIMIT))
              }}
            />
            <div className="paste-foot">
              <span className="muted">
                {trimmed
                  ? `trimmed to ${PASTE_LIMIT.toLocaleString()} characters`
                  : pastedWords > 0
                    ? `${pastedWords.toLocaleString()} words`
                    : ''}
              </span>
              <button className="button" onClick={handlePaste} disabled={pastedWords === 0}>
                Read
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`drop ${dragging ? 'drop-active' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              handleFile(e.dataTransfer.files[0])
            }}
          >
            <p className="drop-title">Drop a PDF</p>
            <p className="muted">or click to choose one</p>
          </div>
        )}

        {!busy && (
          <button
            className="link"
            onClick={() => {
              setError(null)
              setPasting((p) => !p)
            }}
          >
            {pasting ? 'or open a PDF' : 'or paste text'}
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {error && <p className="error">{error}</p>}

        <p className="footnote">
          Everything is read here in the browser and never uploaded. What you open stays
          on this device, and PDFs start past the title and copyright pages.
        </p>
      </div>
    </>
  )
}
