/**
 * tour.js — the guided tour a first-time visitor gets.
 *
 * This app has a lot of surface: two ways in, three depths, a terminal, a byte
 * editor, six labs and a glossary. Somebody arriving cold will find perhaps
 * two of those on their own. So the tour walks every one and says what it is
 * for — and then gets out of the way permanently.
 *
 * Three rules it follows:
 *
 *   · skippable from the first frame. The skip button is not hidden behind a
 *     "no thanks" in small grey text; it is the same size as Next.
 *   · it drives the app rather than describing it. A step that talks about
 *     the byte inspector switches to the depth where the inspector exists,
 *     so the thing being pointed at is genuinely on screen.
 *   · it never runs twice unasked. Once finished or skipped it is done, and
 *     comes back only from the ? button or the `tour` command.
 *
 * Steps are data. `route` is a state patch applied before the step is shown,
 * which is what lets a step reach a panel that is not currently rendered.
 */
import { el, $, render } from './dom.js'
import { get, set } from './state.js'

const SEEN_KEY = 'netlens.tour.done'

const T = (en, hi) => ({ en, hi })
const say = (t, lang) => (typeof t === 'string' ? t : t[lang] || t.en)

export const STEPS = [
  {
    id: 'welcome',
    target: null,
    route: { mode: 'journey', chapter: 2, tier: 1, lessonOpen: true, lab: null },
    title: T('This is netlens', 'Ye netlens hai'),
    text: T(
      'A place to learn computer networks by sending real packets and taking them apart. Nothing here is a recording. This tour takes about a minute, and you can leave it at any point.',
      'Computer networks seekhne ki jagah, jahan asli packets bhejte hain aur unhe khol ke dekhte hain. Yahan kuch recorded nahi hai. Ye tour ek minute ka hai, aur tum kabhi bhi chhod sakte ho.',
    ),
  },
  {
    id: 'rail',
    target: '#chapter-list',
    route: { mode: 'journey', navOpen: true },
    title: T('Eight chapters, in order', 'Aath chapters, kram se'),
    text: T(
      'The journey runs from "you have an address" to "it was layers all along". Each chapter answers the question the one before it left open. REAL means it runs on live traffic; SIM means it is a model, and the app always says which.',
      'Safar "tumhara ek address hai" se shuru hoke "ye sab layers thi" pe khatam hota hai. Har chapter pichhle ka chhoda hua sawaal uthata hai. REAL matlab live traffic pe chalta hai; SIM matlab model hai, aur app hamesha batata hai kaunsa.',
    ),
  },
  {
    id: 'tiers',
    target: '#tier-list',
    route: { mode: 'journey', tier: 1 },
    title: T('Three depths, one packet', 'Teen gehraiyan, ek packet'),
    text: T(
      'The same real exchange at three levels. STORY reads it, DO_IT runs it, REAL_BYTES opens it. Nothing is hidden at the shallow end and nothing is dumbed down — you choose how far down to go.',
      'Wahi asli exchange teen levels pe. STORY padhta hai, DO_IT chalata hai, REAL_BYTES kholta hai. Upar wale level pe kuch chhupaya nahi jaata aur kuch halka nahi kiya jaata — kitna neeche jaana hai tum chunte ho.',
    ),
  },
  {
    id: 'card',
    target: '#lesson',
    route: { mode: 'journey', tier: 1, lessonOpen: true },
    title: T('The lesson card', 'Lesson card'),
    text: T(
      'The lesson arrives a few lines at a time, never as a wall of text. Drag it by its title bar to anywhere on the window, and press L to hide it when you want the whole screen.',
      'Lesson thodi-thodi lines me aata hai, kabhi wall of text ki tarah nahi. Title bar se pakad ke kahin bhi le jao, aur poori screen chahiye to L dabao.',
    ),
  },
  {
    id: 'run',
    target: '#lesson',
    route: { mode: 'journey', tier: 2, lessonOpen: true },
    title: T('Every instruction carries its command', 'Har nirdesh apni command ke saath'),
    text: T(
      'You are never told to "try it yourself" and left to guess. Each step has the exact command on a button that runs it. A step only ticks green once a packet actually came back — a failed one says so.',
      'Tumse kabhi "khud try karo" keh ke chhoda nahi jaata. Har step pe theek wahi command ek button pe hai jo use chala deta hai. Step tabhi hara hota hai jab sach me packet wapas aaye — fail hone pe wo bhi batata hai.',
    ),
  },
  {
    id: 'terminal',
    target: '#term',
    route: { mode: 'journey', tier: 2 },
    title: T('Or type your own', 'Ya khud likho'),
    text: T(
      'Every command below sends a real packet from your machine. Type help for the list. dig, tracert, tls, curl and journey all work the way they do in a real shell, on purpose.',
      'Neeche ki har command tumhari machine se asli packet bhejti hai. List ke liye help likho. dig, tracert, tls, curl aur journey waise hi chalte hain jaise asli shell me — jaan boojh kar.',
    ),
  },
  {
    id: 'stage',
    target: '#viz',
    route: { mode: 'journey', tier: 2 },
    title: T('Watch it fly', 'Use jaate hue dekho'),
    text: T(
      'The canvas animates the exchange that just happened, and the timeline under it lists every packet with its size and timing. Click a row to select that packet.',
      'Canvas abhi hue exchange ko animate karta hai, aur neeche timeline har packet ko uske size aur timing ke saath dikhati hai. Kisi row pe click karke wo packet chuno.',
    ),
  },
  {
    id: 'inspector',
    target: '#inspector',
    route: { mode: 'journey', tier: 3 },
    title: T('Down to the bytes', 'Bytes tak'),
    text: T(
      'The field tree, the hex dump and the bit ruler all come from one parse, so clicking a field lights up its exact bytes. Then type over a byte and send it for real — the internet answers differently.',
      'Field tree, hex dump aur bit ruler sab ek hi parse se aate hain, isliye field pe click karo to uske exact bytes jal uthte hain. Phir kisi byte pe likho aur use asli me bhejo — internet ka jawaab badal jaata hai.',
    ),
  },
  {
    id: 'challenge',
    target: '#lesson',
    route: { mode: 'journey', tier: 2, lessonOpen: true },
    title: T('Challenges are earned', 'Challenge kamane padte hain'),
    text: T(
      'Four chapters end in something the network can settle, and those tick by themselves when you make it happen. The other four ask for an explanation and say "answer this yourself" — no tick for merely running a command.',
      'Chaar chapters aise sawaal pe khatam hote hain jo network khud tay kar deta hai, aur wo tab hi tick hote hain jab tum wo karke dikhao. Baaki chaar samjhane ko kehte hain aur "khud jawaab do" likhte hain — sirf command chalane pe tick nahi milta.',
    ),
  },
  {
    id: 'labs',
    target: '#lab',
    route: { mode: 'journey', chapter: 4, tier: 2, lab: { kind: 'arq' } },
    title: T('Labs, for what packets cannot show', 'Labs, un cheezon ke liye jo packet nahi dikha sakta'),
    text: T(
      'Checksums, framing and sliding windows happen inside the kernel where no program can watch. So they become labs you operate: break a bit on purpose and see what notices. Type lab to list them.',
      'Checksum, framing aur sliding window kernel ke andar hote hain jahan koi program nahi dekh sakta. To wo aise labs ban jaate hain jinhe tum chalate ho: jaan boojh kar ek bit todo aur dekho kaun pakadta hai. List ke liye lab likho.',
    ),
  },
  {
    id: 'topics',
    target: '#side-tabs',
    route: { mode: 'topics', topic: 'framing', navOpen: true, lab: null },
    title: T('The other way in', 'Andar aane ka doosra raasta'),
    text: T(
      'JOURNEY is a story you take once. TOPICS is the whole syllabus — 36 topics over seven modules — to come back to before an exam. Each one links to the chapter where you can see the thing on a live packet.',
      'JOURNEY ek kahani hai jo ek baar chalti hai. TOPICS poora syllabus hai — saat modules me 36 topics — exam se pehle wapas aane ke liye. Har ek us chapter se juda hai jahan wo cheez asli packet pe dikhti hai.',
    ),
  },
  {
    id: 'glossary',
    target: '#lesson',
    route: { mode: 'topics', topic: 'framing', lessonOpen: true },
    title: T('No word you cannot click', 'Koi shabd aisa nahi jo click na ho'),
    text: T(
      'Any term with a dotted underline opens a plain-language definition, and a button to the chapter where you can see it for real. Eighty-eight of them, and they work everywhere the app writes prose.',
      'Jis bhi shabd ke neeche dotted line hai wo saaf bhasha me matlab kholta hai, aur us chapter ka button bhi jahan wo asli me dikhta hai. Aise atthasi shabd hain, aur app jahan bhi likhta hai wahan sab kaam karte hain.',
    ),
  },
  {
    id: 'ask',
    target: '#ask',
    route: { mode: 'journey', chapter: 2, tier: 2 },
    title: T('Stuck on something', 'Kahin atak gaye'),
    text: T(
      'Ask about whatever is on screen. The built-in glossary answers first and instantly, without anything leaving your machine. Anything it cannot cover is labelled as coming from a model, so you know which is which.',
      'Screen pe jo bhi hai uske baare me poochho. Pehle glossary jawaab deta hai, turant, aur kuch bhi tumhari machine se bahar nahi jaata. Jo wo na cover kar paaye uspe likha hota hai ki model se aaya hai, taaki tumhe farak pata rahe.',
    ),
  },
  {
    id: 'lang',
    target: '#btn-lang',
    route: {},
    title: T('English or Hinglish', 'English ya Hinglish'),
    text: T(
      'Everything the app writes — lessons, topics, glossary, labs and the narration under each packet — is written in both. Switch whenever you like; nothing is lost.',
      'App jo bhi likhta hai — lessons, topics, glossary, labs aur har packet ke neeche ki narration — sab dono me likha hai. Jab chaaho badlo; kuch nahi khoyega.',
    ),
  },
  {
    id: 'done',
    target: '#btn-help',
    route: { mode: 'journey', chapter: 1, tier: 1, lessonOpen: true, lab: null },
    title: T('That is everything', 'Bas itna hi'),
    text: T(
      'You are on chapter one. Read it, press the button it gives you, and a real packet leaves your machine. If you want this tour again, it is behind the ? up here.',
      'Tum chapter one pe ho. Use padho, jo button mile use dabao, aur ek asli packet tumhari machine se nikal jaayega. Ye tour dobara chahiye to upar ? me hai.',
    ),
  },
]

export const hasSeenTour = () => {
  try { return localStorage.getItem(SEEN_KEY) === '1' } catch { return false }
}

const remember = () => {
  try { localStorage.setItem(SEEN_KEY, '1') } catch { /* private mode */ }
}

export function createTour({ node, langOf }) {
  let at = -1
  let running = false

  const start = (from = 0) => { running = true; go(from) }

  function finish() {
    running = false
    at = -1
    remember()
    render(node)
    node.hidden = true
  }

  function go(next) {
    if (next < 0 || next >= STEPS.length) return finish()
    at = next

    const step = STEPS[at]
    if (step.route && Object.keys(step.route).length) set(step.route)

    // The route may have just created the element this step points at, so
    // measure on the next frame rather than this one.
    requestAnimationFrame(() => requestAnimationFrame(draw))
  }

  function draw() {
    if (!running) return
    const step = STEPS[at]
    const lang = langOf()

    node.hidden = false

    const rect = targetRect(step.target)
    const caption = el('div.tour__box', { style: {} },
      el('div.tour__head',
        el('span.tour__count', `${at + 1} / ${STEPS.length}`),
        el('button.tour__skip', { onclick: finish },
          lang === 'hi' ? 'chhod do' : 'skip'),
      ),
      el('h3.tour__title', say(step.title, lang)),
      el('p.tour__text', say(step.text, lang)),
      el('div.tour__actions',
        at > 0
          ? el('button.tour__btn', { onclick: () => go(at - 1) }, lang === 'hi' ? '◀ peeche' : '◀ back')
          : el('span'),
        el('button.tour__btn tour__btn--next', { onclick: () => go(at + 1) },
          at === STEPS.length - 1
            ? (lang === 'hi' ? 'shuru karo' : 'start')
            : (lang === 'hi' ? 'aage ▶' : 'next ▶')),
      ),
    )

    render(node,
      rect
        ? el('div.tour__hole', {
          style: {
            left: `${rect.left - 4}px`,
            top: `${rect.top - 4}px`,
            width: `${rect.width + 8}px`,
            height: `${rect.height + 8}px`,
          },
        })
        : el('div.tour__dim'),
      caption,
    )

    place(node.querySelector('.tour__box'), rect)
  }

  /** null for a centred step, or the element's box if it is actually visible. */
  function targetRect(selector) {
    if (!selector) return null
    const target = $(selector)
    if (!target || target.hidden) return null
    const box = target.getBoundingClientRect()
    if (box.width < 4 || box.height < 4) return null
    return box
  }

  /** Beside the highlight when there is room, centred when there is not. */
  function place(box, rect) {
    if (!box) return
    const w = box.offsetWidth
    const h = box.offsetHeight
    const pad = 16

    if (!rect) {
      box.style.left = `${Math.round((innerWidth - w) / 2)}px`
      box.style.top = `${Math.round((innerHeight - h) / 2)}px`
      return
    }

    const below = rect.bottom + pad
    const above = rect.top - h - pad
    const top = below + h < innerHeight - 8 ? below : above > 8 ? above : (innerHeight - h) / 2

    let left = rect.left
    // Prefer beside a tall narrow target such as the rail or the inspector.
    if (rect.height > innerHeight * 0.6) {
      left = rect.right + pad + w < innerWidth ? rect.right + pad : rect.left - w - pad
    }

    box.style.left = `${Math.round(Math.max(8, Math.min(left, innerWidth - w - 8)))}px`
    box.style.top = `${Math.round(Math.max(8, top))}px`
  }

  addEventListener('keydown', (e) => {
    if (!running) return
    if (e.key === 'Escape') { e.preventDefault(); finish() }
    else if (e.key === 'ArrowRight') go(at + 1)
    else if (e.key === 'ArrowLeft') go(at - 1)
  })

  addEventListener('resize', () => { if (running) draw() })

  node.hidden = true
  return { start, finish, isRunning: () => running, step: () => at }
}
