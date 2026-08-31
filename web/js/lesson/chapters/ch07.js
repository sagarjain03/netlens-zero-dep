export default {
  id: 7,
  slug: 'THE_FULL_JOURNEY',
  title: 'The Full Journey',
  real: true,
  proto: 'all of it',

  question: {
    en: 'You know every piece now. What happens when they all fire at once?',
    hi: 'Ab har tukda pata hai. Jab sab ek saath chalte hain to hota kya hai?',
  },

  tier1: {
    beats: [
      {
        text: {
          en: 'You have learned four protocols separately.\nOpening one web page uses all four, in order, in under a second.',
          hi: 'Tumne chaar protocols alag-alag seekhe.\nEk web page kholne me chaaron chalte hain, kram se, ek second se kam me.',
        },
        art: [
          '  DNS  ->  route  ->  TCP  ->  TLS  ->  HTTP',
          '  ch 2      ch 3      ch 4     ch 5     ch 6',
        ].join('\n'),
      },
      {
        text: {
          en: 'Nothing new is built here. Every stage below is a chapter\nyou have already run yourself.',
          hi: 'Yahan naya kuch nahi banaya gaya. Neeche ka har stage ek chapter hai\njo tum khud pehle chala chuke ho.',
        },
      },
      {
        text: {
          en: 'Watch the clock on the left. The time each stage costs\nis the reason the modern web is built the way it is.',
          hi: 'Baayein taraf ki ghadi dekho. Har stage jitna time leta hai,\nwahi wajah hai ki aaj ka web aisa bana hua hai.',
        },
      },
    ],
    hook: {
      en: 'You did this ten thousand times today. Here is what actually happened, byte for byte, with zero libraries involved.',
      hi: 'Tumne aaj ye das hazaar baar kiya. Ye raha jo sach me hua, byte dar byte, bina ek bhi library ke.',
    },
  },

  tier2: {
    intro: {
      en: 'One command. Everything you have learned, in one continuous animation.',
      hi: 'Ek command. Jo kuch bhi seekha, sab ek lagataar animation me.',
    },
    steps: [
      {
        say: {
          en: 'Run the whole journey for a small, fast page.',
          hi: 'Ek chhote, tez page ke liye poori journey chalao.',
        },
        run: 'journey https://example.com',
        after: {
          en: 'Read the timeline top to bottom. Every line belongs to a chapter you have already done — click any of them to jump back.',
          hi: 'Timeline upar se neeche padho. Har line kisi na kisi chapter ki hai jo tum kar chuke ho — kisi pe bhi click karke wapas ja sakte ho.',
        },
      },
      {
        say: {
          en: 'Now run the exact same journey a second time.',
          hi: 'Ab bilkul wahi journey doosri baar chalao.',
        },
        run: 'journey https://example.com',
        after: {
          en: 'Faster. A whole stage barely appeared. Nothing was optimised — something was simply remembered. That is caching, learned by experience instead of definition.',
          hi: 'Tez. Ek poora stage lagbhag dikha hi nahi. Kuch optimise nahi hua — bas kuch yaad rakha gaya tha. Yahi caching hai, definition se nahi, anubhav se seekhi hui.',
        },
      },
      {
        say: {
          en: 'Play it back slowly enough to watch each packet leave.',
          hi: 'Itna dheere chalao ki har packet nikalte hue dikhe.',
        },
        run: 'replay 4',
        after: {
          en: 'Same captured data, four times slower. Watch how long the machine spends waiting compared with how long it spends talking.',
          hi: 'Wahi capture kiya data, chaar guna dheere. Dekho machine baat karne me kitna time deti hai aur intezaar me kitna.',
        },
      },
    ],
  },

  tier3: {
    intro: {
      en: 'Where the time actually went, and what the industry built to get it back.',
      hi: 'Time asal me gaya kahan, aur usko wapas paane ke liye industry ne kya banaya.',
    },
    steps: [
      {
        say: {
          en: 'Run the journey on a small page and read the percentages.',
          hi: 'Chhote page pe journey chalao aur percentages padho.',
        },
        run: 'journey https://example.com',
        after: {
          en: 'Setup is about three quarters of the total here. The page itself is almost an afterthought.',
          hi: 'Yahan lagbhag teen-chauthai time setup ka hai. Page khud lagbhag baad ki baat lagta hai.',
        },
      },
      {
        say: {
          en: 'Now run it on a heavy site and watch the picture invert.',
          hi: 'Ab kisi bhaari site pe chalao aur tasveer ulti hote dekho.',
        },
        run: 'journey https://github.com',
        after: {
          en: 'Transfer swamps everything. Which optimisation is worth doing depends entirely on which of these two pages you are actually shipping.',
          hi: 'Transfer sab kuch daba deta hai. Kaunsa optimisation karne laayak hai, ye poori tarah is baat pe hai ki tum in do me se kaunsa page bhej rahe ho.',
        },
      },
    ],

    points: [
      {
        en: 'On example.com the split is roughly DNS 13%, TCP 20%, TLS 37%, HTTP 34%. Setup is about three quarters of the total before a single byte of page arrives.',
        hi: 'example.com pe batwara lagbhag aisa hai: DNS 13%, TCP 20%, TLS 37%, HTTP 34%. Page ka ek byte aane se pehle hi lagbhag teen-chauthai time setup me chala jaata hai.',
      },
      {
        en: 'That TLS share is why keep-alive, HTTP/2, session resumption and 0-RTT all exist. They are not features — they are attempts to stop paying this bill twice.',
        hi: 'TLS ka yahi hissa keep-alive, HTTP/2, session resumption aur 0-RTT ke hone ki wajah hai. Ye features nahi hain — ye is bill ko do baar na bharne ki koshishein hain.',
      },
      {
        en: 'Six round trips before the page appears. On a 40 ms link that is 240 ms of pure distance, no matter how fast either computer is.',
        hi: 'Page dikhne se pehle chhe round trips. 40 ms wali link pe wo 240 ms sirf doori ka hai, chaahe dono computer kitne bhi tez ho.',
      },
      {
        en: 'Try journey on a heavy site instead and the picture inverts: transfer swamps setup. Which optimisation matters depends entirely on which page you are loading.',
        hi: 'Kisi bhaari site pe journey chalao to tasveer ulti ho jaati hai: transfer setup ko daba deta hai. Kaunsa optimisation zaroori hai, ye poori tarah page pe depend karta hai.',
      },
    ],
  },

  challenge: {
    run: 'journey https://example.com',
    ask: {
      en: 'Run journey twice on the same site. Which stage almost disappeared the second time, and why?',
      hi: 'Ek hi site pe journey do baar chalao. Doosri baar kaunsa stage lagbhag gayab ho gaya, aur kyun?',
    },
  },

  terms: ['round trip', 'caching', 'session resumption', 'keep-alive', 'HTTP/2', '0-RTT', 'latency budget'],
}
