import { useEffect, useState } from 'react'
import { Upload } from './components/Upload'
import { Reader } from './components/Reader'
import { listBooks, type Book } from './lib/storage'

/**
 * The whole app is two screens. `book` decides which one you see:
 * nothing loaded yet -> Upload, a book loaded -> Reader.
 */
export default function App() {
  const [book, setBook] = useState<Book | null>(null)
  const [checked, setChecked] = useState(false)

  // On first load, pick up the most recent book from IndexedDB so a
  // refresh drops you straight back into what you were reading.
  useEffect(() => {
    listBooks().then((books) => {
      if (books[0]) setBook(books[0])
      setChecked(true)
    })
  }, [])

  // Blank for the split second the database takes to answer — otherwise
  // the upload screen flashes up and is immediately replaced.
  if (!checked) return null

  return (
    <main className="app">
      {book ? (
        <Reader book={book} onExit={() => setBook(null)} />
      ) : (
        <Upload onReady={setBook} />
      )}
    </main>
  )
}
