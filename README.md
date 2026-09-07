# Speed Reader

Upload a PDF or paste any text, then read it one word at a time (RSVP) at
a speed you set.

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

**Pasted text.** Anything pasted goes through the same tidying a PDF
gets, since text copied out of one carries the same broken line wraps and
split words. One paste is capped at 100,000 characters — about 20,000
words, or an hour of reading — which covers any article or chapter while
keeping the text box responsive. A whole book belongs in the PDF path,
where it never has to sit in a text field.

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

**Timing.** Words don't all get the same time. Longer words hold longer,
and a word ending a clause or a sentence gets a beat after it. The
weights are relative and divided by their own average, so the words are
redistributed against each other while the rate stays whatever you set —
300 wpm really is 300 wpm. The two pauses are adjustable while paused,
and the whole thing switches off to an even metronome.

**Seeking.** Tap the stage to start or stop. Pausing reveals a line of
surrounding text so you can see where you are. Press and drag to seek —
you're dragging the text itself, so pulling right walks you backward.
Hold near either edge and it keeps going on its own, accelerating the
further out you hold.

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
    ContextLine.tsx     the surrounding text, shown while paused
    TimingPanel.tsx     the pause controls
```

## Not built yet

- OCR fallback for scanned PDFs
- A library view for more than one book, with saved positions
- Settings that survive a refresh
- Keyboard controls
