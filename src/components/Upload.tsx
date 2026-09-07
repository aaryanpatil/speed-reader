import { useRef, useState } from 'react'
import { parsePdf, NoTextLayerError } from '../lib/pdf'
import { tokenize } from '../lib/words'
import { saveBook, type Book } from '../lib/storage'
import { About } from './About'

type Props = {
  onReady: (book: Book) => void
}

export function Upload({ onReady }: Props) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [about, setAbout] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
      const book: Book = {
        id: crypto.randomUUID(),
        title: file.name.replace(/\.pdf$/i, ''),
        text,
        wordCount: tokenize(text).length,
        addedAt: Date.now(),
        startWord,
      }
      // Only the extracted text is kept. The PDF goes out of scope here
      // and the browser reclaims it.
      await saveBook(book)
      onReady(book)
    } catch (err) {
      setError(
        err instanceof NoTextLayerError
          ? "This PDF is a scan — there's no text in it to read yet."
          : "Couldn't read that PDF.",
      )
      setBusy(false)
    }
  }

  return (
    <>
      <button
        className="info"
        onClick={() => setAbout(true)}
        aria-label="Why one word at a time"
      >
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

        {busy ? (
          <div className="parsing">
            <div className="parsing-bar">
              <div style={{ transform: `scaleX(${progress})` }} />
            </div>
            <p className="muted">reading {Math.round(progress * 100)}%</p>
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

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {error && <p className="error">{error}</p>}

        <p className="footnote">
          Your PDF is read here in the browser and never uploaded. Books stay on this
          device, and the reader opens past the title and copyright pages.
        </p>
      </div>
    </>
  )
}
