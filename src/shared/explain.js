/**
 * explain.js — what each protocol field actually means, in one or two plain lines.
 *
 * This is the whole beginner story. A learner who never opens the hex view still
 * gets these on hover in the field tree; a learner in tier 3 gets them next to
 * the bytes. Keeping them out of the codecs means the parsers stay about bytes
 * and the teaching stays editable in one place.
 *
 * Keys are dotted field paths: "dns.Question.QTYPE".
 * `hi` is Hinglish, toggled in the UI. Missing `hi` falls back to `en`.
 */

const FIELDS = {
  // ── DNS header ────────────────────────────────────────────────────────────
  'dns.Header.ID': {
    en: 'A random number that ties this question to its answer. A reply carrying a different ID is thrown away — that is what stops anyone from forging a fake DNS answer.',
    hi: 'Ek random number jo sawaal aur jawaab ko jodta hai. Alag ID wala reply reject ho jaata hai — isi se koi fake DNS answer nahi bhej sakta.',
  },
  'dns.Header.QR': {
    en: '0 means this is a question, 1 means it is an answer. One bit tells you which direction the packet is going.',
    hi: '0 = sawaal, 1 = jawaab. Ek hi bit batata hai packet kis taraf ja raha hai.',
  },
  'dns.Header.Opcode': {
    en: 'What kind of DNS operation this is. Almost always 0 (a standard lookup).',
    hi: 'Kis tarah ka DNS operation hai. Lagbhag hamesha 0 (normal lookup).',
  },
  'dns.Header.AA': {
    en: 'Authoritative Answer: the server that replied actually owns this domain, rather than repeating something it cached.',
    hi: 'Authoritative Answer: jis server ne jawaab diya wo is domain ka asli maalik hai, cache se nahi bola.',
  },
  'dns.Header.TC': {
    en: 'Truncated: the answer was too big for one UDP packet. The client is expected to ask again over TCP.',
    hi: 'Truncated: jawaab ek UDP packet me nahi samaaya. Client ko dobara TCP pe poochna padega.',
  },
  'dns.Header.RD': {
    en: 'Recursion Desired: "you go find the answer for me". Turn it off and the server only tells you who to ask next.',
    hi: 'Recursion Desired: "tum poora dhoondh ke lao". Off kar do to server sirf batayega ki aage kisse poochna hai.',
  },
  'dns.Header.RA': {
    en: 'Recursion Available: the server is willing to do that work. Your home router often says no here.',
    hi: 'Recursion Available: server ye kaam karne ko taiyaar hai. Ghar ka router aksar mana kar deta hai.',
  },
  'dns.Header.Z': {
    en: 'Reserved bits. Must be zero. Set them and a strict server will reject the packet.',
    hi: 'Reserved bits. Zero hone chahiye. Set kar do to strict server packet reject kar dega.',
  },
  'dns.Header.RCODE': {
    en: 'The result. 0 = fine, 3 = this name does not exist, 2 = the server broke, 5 = the server refused.',
    hi: 'Result. 0 = theek, 3 = ye naam hai hi nahi, 2 = server fail, 5 = server ne mana kiya.',
  },
  'dns.Header.QDCOUNT': { en: 'How many questions are in this packet. In practice always 1.', hi: 'Kitne sawaal hain. Practice me hamesha 1.' },
  'dns.Header.ANCOUNT': { en: 'How many answers came back. Zero here with RCODE 0 means "the name exists, but not with this record type".', hi: 'Kitne answers aaye. RCODE 0 ke saath zero ka matlab: naam to hai, par is type ka record nahi.' },
  'dns.Header.NSCOUNT': { en: 'How many authority records — the servers that would know for sure.', hi: 'Kitne authority records — wo servers jinhe pakka pata hoga.' },
  'dns.Header.ARCOUNT': { en: 'Extra records the server threw in to save you a second lookup.', hi: 'Extra records jo server ne bonus me bheje, taaki dobara na poochna pade.' },

  // ── DNS question ──────────────────────────────────────────────────────────
  'dns.Question.QNAME': {
    en: 'The name you are asking about — but not as a dotted string. On the wire each label carries its own length byte, and a zero byte ends the name.',
    hi: 'Jo naam tum poochh rahe ho — par dotted string nahi. Wire pe har label ke aage uski length hoti hai, aur zero byte naam khatam karta hai.',
  },
  'dns.Question.QTYPE': {
    en: 'Which kind of record you want. 1 = A (IPv4), 28 = AAAA (IPv6), 5 = CNAME, 15 = MX (mail). Change this byte and the server answers a different question.',
    hi: 'Kis type ka record chahiye. 1 = A (IPv4), 28 = AAAA (IPv6), 5 = CNAME, 15 = MX. Ye byte badlo, server alag jawaab dega.',
  },
  'dns.Question.QCLASS': {
    en: 'Always 1 (IN, "Internet"). The other classes were for networks that no longer exist.',
    hi: 'Hamesha 1 (IN = Internet). Baaki classes purane networks ke liye thi jo ab hain hi nahi.',
  },

  // ── DNS records ───────────────────────────────────────────────────────────
  'dns.RR.NAME': {
    en: 'Which name this record is about. Usually two bytes: a pointer back to the name already written earlier in the packet, so it is not repeated.',
    hi: 'Ye record kis naam ka hai. Aksar sirf 2 byte: packet me pehle likhe naam ka pointer, taaki naam repeat na ho.',
  },
  'dns.RR.TYPE': { en: 'What this record holds — an address, another name, a mail server.', hi: 'Is record me kya hai — address, doosra naam, ya mail server.' },
  'dns.RR.CLASS': { en: 'Always 1 (IN).', hi: 'Hamesha 1 (IN).' },
  'dns.RR.TTL': {
    en: 'How many seconds this answer may be cached. This is why the second visit to a site skips the DNS lookup entirely.',
    hi: 'Kitne second tak ye jawaab cache kiya ja sakta hai. Isiliye doosri baar site kholne pe DNS lookup hoti hi nahi.',
  },
  'dns.RR.RDLENGTH': { en: 'How many bytes of record data follow. Four for an IPv4 address, sixteen for IPv6.', hi: 'Aage kitne byte ka data hai. IPv4 ke liye 4, IPv6 ke liye 16.' },
  'dns.RR.RDATA': { en: 'The answer itself.', hi: 'Asli jawaab.' },
}

/** Compression pointers get their own note — it is the single most surprising part of DNS. */
export const NOTES = {
  compression: {
    en: 'Those two bytes starting with 0xC0 are a pointer: "the name is written earlier, at this offset". DNS has had built-in compression since 1987.',
    hi: 'Wo do byte jo 0xC0 se shuru hote hain, ek pointer hain: "naam pehle likha hai, is offset pe". DNS me 1987 se compression built-in hai.',
  },
}

/**
 * @param {string} path  e.g. "dns.Question.QTYPE"
 * @param {'en'|'hi'} lang
 * @returns {string|undefined}
 */
export function explain(path, lang = 'en') {
  const entry = FIELDS[path]
  if (!entry) return undefined
  return entry[lang] ?? entry.en
}

export const explainKeys = () => Object.keys(FIELDS)
