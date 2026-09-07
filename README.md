# Speed Reader

Upload a PDF, read it one word at a time (RSVP) at a speed you set.

Everything happens in your browser. The PDF is never uploaded anywhere,
and no server is involved.

## Run it

```bash
npm install
npm run dev
```

## How it works

**Parsing.** PDFs already carry a text layer, so `pdf.js` reads the words
straight out of the file locally — no AI, no API, no cost. Scanned PDFs
(images of pages) have no text layer; those are detected and rejected for
now, and are the one case where OCR would be needed later.

**Storage.** The extracted text goes into IndexedDB via `idb-keyval`. The
PDF itself is discarded after parsing. IndexedDB rather than
`localStorage` because a single novel is 0.5–1.5MB of text and
`localStorage` caps out around 5MB.

**The pivot letter.** Each word has one letter shown in red, pinned to a
fixed point on screen. When you read normally your eye lands slightly
left of a word's centre and recognises the whole word from there. By
holding that point still and sliding the word around it, your eye never
has to move — which is what makes reading at speed possible rather than
exhausting.

## Layout

```
src/
  main.tsx              mounts React into index.html
  App.tsx               two screens: Upload or Reader
  index.css             all styling, driven by a few CSS variables
  lib/
    pdf.ts              PDF -> plain text
    words.ts            text -> words, and the pivot-letter maths
    storage.ts          IndexedDB read/write
  components/
    Upload.tsx          drop zone and parsing progress
    Reader.tsx          the word timing loop and controls
    Word.tsx            one word, split around its pivot letter
```

## Not built yet

- OCR fallback for scanned PDFs
- Timing that varies by word length and punctuation
- A library view for more than one book, with saved positions
- Keyboard controls
