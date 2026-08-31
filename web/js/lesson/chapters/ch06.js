export default {
  id: 6,
  slug: 'ASKING_FOR_A_PAGE',
  title: 'Asking for a Page',
  real: true,
  proto: 'HTTP/1.1',

  question: {
    en: 'The line is open and locked. So what do you actually SAY down it?',
    hi: 'Line khul gayi aur lock bhi ho gayi. Ab usme kehna kya hai?',
  },

  tier1: {
    beats: [
      {
        text: {
          en: 'After all that setup, the actual request is plain English text.\n"GET / HTTP/1.1" — that is the whole thing.',
          hi: 'Itni saari tayyari ke baad, asli request seedhi English text hai.\n"GET / HTTP/1.1" — bas itna hi.',
        },
        art: [
          '  GET / HTTP/1.1',
          '  Host: example.com',
          '  Connection: close',
          '  ⏎            ← the blank line means "I am done talking"',
        ].join('\n'),
      },
      {
        text: {
          en: 'You could type it by hand into a socket and it would work.\nSo let us type it by hand.',
          hi: 'Tum ise haath se socket me type kar do to bhi chal jaayega.\nTo chalo haath se hi type karte hain.',
        },
      },
      {
        text: {
          en: 'The reply is the same shape: a status line, some headers,\na blank line, then the page itself.',
          hi: 'Jawaab bhi wahi shakl rakhta hai: ek status line, kuch headers,\nek khaali line, phir page khud.',
        },
      },
    ],
    hook: {
      en: 'The most important character in HTTP is a blank line. Get it wrong and the server waits forever.',
      hi: 'HTTP ka sabse zaroori character ek khaali line hai. Galat ho jaaye to server hamesha intezaar karta rehta hai.',
    },
  },

  tier2: {
    intro: {
      en: 'Send a request you can read, and read the reply the same way.',
      hi: 'Aisi request bhejo jo padh sako, aur jawaab bhi usi tarah padho.',
    },
    steps: [
      {
        say: {
          en: 'Ask a server for its front page.',
          hi: 'Kisi server se uska pehla page maango.',
        },
        run: 'curl https://example.com',
        after: {
          en: 'Count the bytes we sent. That is literally those characters, nothing more — no library, no encoding, no magic.',
          hi: 'Humne jitne bytes bheje wo gino. Wo bilkul wahi characters hain, aur kuch nahi — na library, na encoding, na jaadu.',
        },
      },
      {
        say: {
          en: 'Ask for only the headers, not the page.',
          hi: 'Sirf headers maango, page nahi.',
        },
        run: 'curl https://example.com --head',
        after: {
          en: 'Same connection, same cost, one word different. The server tells you everything about the page without sending it.',
          hi: 'Wahi connection, wahi cost, sirf ek shabd alag. Server page bheje bina uske baare me sab kuch bata deta hai.',
        },
      },
      {
        say: {
          en: 'Now ask twice on one connection instead of opening a second.',
          hi: 'Ab doosra connection kholne ki jagah ek hi pe do baar poochho.',
        },
        run: 'curl https://example.com --keep-alive',
        after: {
          en: 'The second request skips DNS, TCP and the entire TLS handshake. That saved time is the whole reason keep-alive exists.',
          hi: 'Doosri request DNS, TCP aur poora TLS handshake skip kar deti hai. Yahi bacha hua time keep-alive ke hone ka poora kaaran hai.',
        },
      },
    ],
  },

  tier3: {
    intro: {
      en: 'Text with rules. The rules are strict in places nobody expects.',
      hi: 'Niyamon wali text. Aur niyam wahan sakht hain jahan kisi ko umeed nahi hoti.',
    },
    steps: [
      {
        say: {
          en: 'Fetch a page and look at how the body actually arrived.',
          hi: 'Ek page laao aur dekho body asal me aayi kaise.',
        },
        run: 'curl https://example.com',
        after: {
          en: 'If you see Transfer-Encoding: chunked, read the raw bytes - a hex length, then that many bytes, repeating, until a zero-length chunk ends it.',
          hi: 'Agar Transfer-Encoding: chunked dikhe to raw bytes padho - ek hex length, phir utne bytes, dohraate hue, jab tak zero-length chunk khatam na kar de.',
        },
      },
      {
        say: {
          en: 'Ask for the headers only and compare the two byte counts.',
          hi: 'Sirf headers maango aur dono byte counts compare karo.',
        },
        run: 'curl https://example.com --head',
        after: {
          en: 'The request is nearly the same size; the reply is a fraction. All that setup cost was paid either way - which is exactly the argument for keep-alive.',
          hi: 'Request lagbhag utni hi badi hai; jawaab uska chhota sa hissa. Setup ki poori keemat dono baar chukani padi - yahi keep-alive ka poora tark hai.',
        },
      },
    ],

    points: [
      {
        en: 'Lines end with CR LF, not LF. Change one and some servers stop understanding you entirely — the same bug bit this project own test fixtures.',
        hi: 'Lines CR LF pe khatam hoti hain, sirf LF pe nahi. Ek badlo to kuch servers samajhna hi band kar dete hain — yahi bug is project ki apni test fixtures me aaya tha.',
      },
      {
        en: 'Transfer-Encoding: chunked means the server did not know the total size. It sends a hex length, then that many bytes, and a zero-length chunk to say it is finished.',
        hi: 'Transfer-Encoding: chunked ka matlab server ko total size pata hi nahi tha. Wo hex me length bhejta hai, phir utne bytes, aur zero-length chunk se kehta hai ki khatam.',
      },
      {
        en: 'Status codes are a conversation, not just errors. 301 means the page moved, 304 means "you already have it", 404 means the server is fine and the page is not.',
        hi: 'Status codes baatcheet hain, sirf errors nahi. 301 matlab page shift ho gaya, 304 matlab "tumhare paas already hai", 404 matlab server theek hai, page nahi.',
      },
      {
        en: 'The Host header is why one server can hold thousands of sites over plain HTTP — the same job SNI does one layer down in TLS.',
        hi: 'Host header ki wajah se ek server plain HTTP pe hazaaron sites rakh sakta hai — wahi kaam jo ek layer neeche TLS me SNI karta hai.',
      },
    ],
  },

  challenge: {
    run: 'curl https://example.com --head',
    verify: { kind: 'httpStatus', code: 304 },
    ask: {
      en: 'Make a server reply 304 Not Modified by sending the right conditional header.',
      hi: 'Sahi conditional header bhej kar kisi server se 304 Not Modified kehlwao.',
    },
  },

  terms: ['HTTP', 'request line', 'header', 'status code', 'Host header', 'User-Agent',
    'chunked encoding', 'CRLF', 'keep-alive', '304 Not Modified'],
}
