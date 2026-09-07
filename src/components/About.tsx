import { Sheet } from './Sheet'

/**
 * Why the reader works the way it does — and, more to the point, why it
 * deliberately keeps the one thing most readers of this kind remove.
 */
export function About({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Why one word at a time" onClose={onClose} wide>
      <div className="prose">
        <p>
          Reading normally, your eyes don't glide along a line. They jump, land,
          and jump again, and you are briefly blind during every jump. Showing
          one word at a time in a fixed place removes that movement entirely:
          there is nowhere for your eye to go, so none of the effort goes into
          aiming it.
        </p>
        <p>
          The technique has a name — <strong>rapid serial visual presentation</strong>,
          or RSVP. It comes out of reading research in the 1970s, where it was
          used to study attention precisely because it holds eye movement still.
        </p>

        <h3>Why you can still go back</h3>
        <p>
          Roughly one eye movement in seven is a <strong>regression</strong> — a
          jump backward to re-read something you have already passed. Most speed
          readers treat those as waste to be engineered away. They are not.
          Going back is partly how understanding repairs itself: when a sentence
          turns out to mean something other than you assumed, re-reading is how
          you catch it. Remove that and you move your eyes faster while
          understanding less, which is skimming rather than reading.
        </p>
        <p>So this reader hands it back on purpose:</p>
        <ul>
          <li>
            <strong>Drag to seek.</strong> Press and pull the text to walk back
            through what you just read, as far as you need.
          </li>
          <li>
            <strong>The line of context.</strong> Pause and the surrounding
            sentence appears, so you can see what you went through rather than
            reconstruct it.
          </li>
          <li>
            <strong>Pauses that follow the punctuation.</strong> A word closing a
            clause or a sentence holds longer, leaving a beat to finish the
            thought in.
          </li>
        </ul>
        <p>
          The aim is to get through a book faster and still reach the end having
          actually read it.
        </p>

        <h3>What it suits</h3>
        <p>
          Narrative prose takes to this well. Dense material — a legal clause, a
          proof, anything where one sentence has to be held exactly — is where
          you will want to go back most and where speed helps least. Slow down,
          or read it the ordinary way, when that is what the page asks for.
        </p>
      </div>
    </Sheet>
  )
}
