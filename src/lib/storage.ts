/**
 * Where books live: IndexedDB, in the user's own browser.
 *
 * Deliberately NOT localStorage — that caps out around 5MB, and a novel
 * is 0.5–1.5MB of plain text, so you'd hit the ceiling at two or three
 * books and writes would start throwing. IndexedDB gives us hundreds of
 * MB. `idb-keyval` is a tiny wrapper that makes it behave like a Map.
 *
 * The PDF itself is never stored. We extract the text once on upload and
 * throw the file away — the text is ~20x smaller and it's all we need.
 */
import { get, set, del, values } from 'idb-keyval'

export type Book = {
  id: string
  title: string
  text: string
  wordCount: number
  addedAt: number
}

export async function saveBook(book: Book): Promise<void> {
  await set(book.id, book)
}

export async function loadBook(id: string): Promise<Book | undefined> {
  return get<Book>(id)
}

export async function deleteBook(id: string): Promise<void> {
  await del(id)
}

/** Every saved book, newest first. */
export async function listBooks(): Promise<Book[]> {
  const all = await values<Book>()
  return all.sort((a, b) => b.addedAt - a.addedAt)
}
