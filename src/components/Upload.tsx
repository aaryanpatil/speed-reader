import { useRef, useState } from 'react'
import { extractText, NoTextLayerError } from '../lib/pdf'
import { tokenize } from '../lib/words'
import { saveBook, type Book } from '../lib/storage'

type Props = {
  onReady: (book: Book) => void
}

export function Upload({ onReady }: Props) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
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
      const text = await extractText(file, setProgress)
      const book: Book = {
        id: crypto.randomUUID(),
        title: file.name.replace(/\.pdf$/i, ''),
        text,
        wordCount: tokenize(text).length,
        addedAt: Date.now(),
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

  if (busy) {
    return (
      <div className="upload">
        <div className="parsing">
          <div className="parsing-bar">
            <div style={{ transform: `scaleX(${progress})` }} />
          </div>
          <p className="muted">reading {Math.round(progress * 100)}%</p>
        </div>
      </div>
    )
  }

  return (
    <div className="upload">
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

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {error && <p className="error">{error}</p>}

      <p className="footnote">
        Parsed in your browser. Nothing is uploaded anywhere.
      </p>
    </div>
  )
}
