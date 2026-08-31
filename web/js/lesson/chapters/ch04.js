export default {
  id: 4,
  slug: 'RELIABLE_OR_FAST',
  title: 'Reliable or Fast?',
  real: false,
  proto: 'TCP vs UDP',

  question: {
    en: 'Routers forward your packet. But what if one of them drops it?',
    hi: 'Router packet aage bhejte hain. Par agar koi ek use gira de to?',
  },

  tier1: {
    beats: [
      {
        text: {
          en: 'The internet loses packets. All the time. That is normal, not broken.\nSo every protocol has to decide what to do about it.',
          hi: 'Internet packets khota rehta hai. Hamesha. Ye normal hai, kharabi nahi.\nIsliye har protocol ko decide karna padta hai ki karna kya hai.',
        },
        art: [
          '  the same 30% loss applied to both',
          '',
          '  TCP  1  2  x3  ..3  4    file perfect, slower',
          '  UDP  1  2  x3   4   5    one glitch, no lag',
        ].join('\n'),
      },
      {
        text: {
          en: 'TCP notices the gap and re-sends. UDP does not care and moves on.\nNeither is better. It depends on what you are doing.',
          hi: 'TCP gap dekh leta hai aur dobara bhejta hai. UDP parwah nahi karta, aage badh jaata hai.\nKoi behtar nahi hai. Depend karta hai tum kar kya rahe ho.',
        },
      },
      {
        text: {
          en: 'Downloading a file with a hole in it is useless.\nA voice call that pauses to re-send a lost word is worse than a glitch.',
          hi: 'Aadha-adhoora file download bekaar hai.\nAur voice call jo khoya hua shabd dobara bhejne ke liye ruk jaaye, glitch se bhi bura hai.',
        },
      },
    ],
    hook: {
      en: 'Your DNS lookup in Chapter 2 used UDP. Your web page used TCP. Same network, opposite choices — and now you know why.',
      hi: 'Chapter 2 wale DNS lookup ne UDP use kiya. Web page ne TCP. Same network, ulta faisla — aur ab tumhe kaaran pata hai.',
    },
  },

  // The chapter's own claim — that the choice is a trade rather than a
  // ranking — is the one thing prose cannot settle. The lab runs all three
  // protocols over identical losses, so the comparison is a result.
  lab: 'arq',
  labSay: {
    en: 'Set a loss rate, then switch protocol. The losses stay identical, so the only thing that changed is the protocol.',
    hi: 'Loss rate set karo, phir protocol badlo. Losses bilkul wahi rehte hain, to badla sirf protocol hai.',
  },

  tier2: {
    intro: {
      en: 'The loss simulation is labelled SIM because we do not damage real traffic. Everything below it is real socket data.',
      hi: 'Loss wala simulation SIM likha hai kyunki hum asli traffic kharaab nahi karte. Uske neeche sab kuch asli socket data hai.',
    },
    steps: [
      {
        say: {
          en: 'Open a real TCP connection and watch what the socket reports.',
          hi: 'Ek asli TCP connection kholo aur dekho socket kya batata hai.',
        },
        run: 'curl https://example.com',
        after: {
          en: 'Note the connect time and the local port number. That port was picked by your OS a moment ago.',
          hi: 'Connect time aur local port number dekho. Wo port tumhare OS ne abhi thodi der pehle chuna tha.',
        },
      },
      {
        say: {
          en: 'Do it again and watch the port number change.',
          hi: 'Dobara karo aur port number badalte dekho.',
        },
        run: 'curl https://example.com',
        after: {
          en: 'Your OS hands out a fresh high port every time — 62028, then 62029, then 62030. Connections are counted, not reused.',
          hi: 'Tumhara OS har baar naya high port deta hai — 62028, phir 62029, phir 62030. Connections ginte hain, dobara use nahi hote.',
        },
      },
      {
        say: {
          en: 'List every connection your machine currently holds open.',
          hi: 'Wo saare connections dekho jo tumhari machine ne abhi khole hue hain.',
        },
        run: 'netstat',
        after: {
          en: 'Every browser tab, every background app. Each line is a live TCP conversation you did not know was happening.',
          hi: 'Har browser tab, har background app. Har line ek zinda TCP baatcheet hai jiska tumhe pata bhi nahi tha.',
        },
      },
    ],
  },

  tier3: {
    intro: {
      en: 'What we can honestly show you, and what your kernel keeps to itself.',
      hi: 'Hum imaandaari se kya dikha sakte hain, aur kya tumhara kernel apne paas rakhta hai.',
    },
    steps: [
      {
        say: {
          en: 'Open one connection and read the numbers your OS attached to it.',
          hi: 'Ek connection kholo aur wo numbers padho jo tumhare OS ne usse jode.',
        },
        run: 'curl https://example.com --head',
        after: {
          en: 'Local port, remote port, connect time. Your OS chose that local port a millisecond ago and will never reuse it for this conversation.',
          hi: 'Local port, remote port, connect time. Us local port ko tumhare OS ne ek millisecond pehle chuna aur is baatcheet ke liye dobara kabhi use nahi karega.',
        },
      },
      {
        say: {
          en: 'Now list every connection the whole machine is holding open.',
          hi: 'Ab poori machine ke saare khule connections ki list dekho.',
        },
        run: 'netstat',
        after: {
          en: 'Count them. Every one is a TCP state machine your kernel is tracking for some program, most of which you did not knowingly start.',
          hi: 'Gino. Har ek TCP state machine hai jise tumhara kernel kisi program ke liye track kar raha hai, aur unme se zyadatar tumne jaan boojh kar shuru bhi nahi kiye.',
        },
      },
    ],

    points: [
      {
        en: 'TCP numbers every byte. The receiver acknowledges what it got, so a missing number is detectable without anyone reporting an error.',
        hi: 'TCP har byte ko number deta hai. Receiver batata hai use kya mila, isliye ghayab number bina kisi error ke pakda jaata hai.',
      },
      {
        en: 'Head-of-line blocking: one lost packet stalls everything queued behind it, even packets that already arrived safely. This is why HTTP/2 over TCP still stutters.',
        hi: 'Head-of-line blocking: ek khoya packet apne peeche ki poori line rok deta hai, un packets ko bhi jo safely aa chuke the. Isliye HTTP/2 TCP pe bhi atakta hai.',
      },
      {
        en: 'UDP has no memory of what it sent. That is not laziness — it is what lets a video call skip a lost frame instead of freezing on it.',
        hi: 'UDP ko yaad hi nahi rehta usne kya bheja. Ye aalas nahi — isi wajah se video call khoye frame ko chhod ke aage badh jaati hai, atakti nahi.',
      },
      {
        en: 'Honest limit: raw SYN/ACK bytes are handled inside your OS kernel. Node stdlib gives us the socket, not the handshake bytes. We show what is genuinely observable and label the rest SIM.',
        hi: 'Imaandaar limit: raw SYN/ACK bytes tumhare OS kernel ke andar handle hote hain. Node stdlib humein socket deta hai, handshake bytes nahi. Jo sach me dikh sakta hai wahi dikhate hain, baaki pe SIM likha hai.',
      },
    ],
  },

  challenge: {
    run: 'netstat',
    ask: {
      en: 'At what loss percentage does TCP take more than twice as long as UDP? Explain in one line why.',
      hi: 'Kitne percent loss pe TCP, UDP se dugne se zyada time leta hai? Ek line me kaaran batao.',
    },
  },

  terms: ['TCP', 'UDP', 'packet loss', 'acknowledgement', 'sequence number', 'ephemeral port',
    'head-of-line blocking', 'socket', 'SIM'],
}
