export default {
  id: 3,
  slug: 'FINDING_THE_PATH',
  title: 'Finding the Path',
  real: true,
  proto: 'Routing / ICMP',

  question: {
    en: 'You have the address. But how does your packet actually REACH it?',
    hi: 'Address to mil gaya. Par tumhara packet wahan tak pahunchta kaise hai?',
  },

  tier1: {
    beats: [
      {
        text: {
          en: 'Your packet does not know the way. Nobody knows the whole way.\nEach router only knows the NEXT step.',
          hi: 'Tumhare packet ko raasta nahi pata. Poora raasta kisi ko nahi pata.\nHar router ko sirf AGLA step pata hota hai.',
        },
        art: [
          '  you ─▶ router ─▶ ISP ─▶ core ─▶ Mumbai IX ─▶ ... ─▶ 🎯',
          '   2ms     12ms     18ms      24ms                    68ms',
        ].join('\n'),
      },
      {
        text: {
          en: 'It is like asking for directions at every corner instead of\ncarrying a map. Slower to describe, impossible to break.',
          hi: 'Ye map lekar chalne ki jagah har mod pe raasta poochne jaisa hai.\nBatane me slow, par todna namumkin.',
        },
      },
      {
        text: {
          en: 'Your machine keeps its own small map: the routing table.\nOne line in it says "anything else, send to my router".',
          hi: 'Tumhari machine apna chhota map rakhti hai: routing table.\nUsme ek line kehti hai "baaki sab kuch mere router ko bhej do".',
        },
      },
    ],
    hook: {
      en: 'You are about to see every machine between you and a server on the other side of the world. Their real addresses.',
      hi: 'Tum abhi wo har machine dekhoge jo tumhare aur duniya ke doosre kone ke server ke beech hai. Unke asli address.',
    },
  },

  tier2: {
    intro: {
      en: 'First read your own map. Then walk the path one hop at a time.',
      hi: 'Pehle apna map padho. Phir raaste pe ek-ek hop chalo.',
    },
    steps: [
      {
        say: {
          en: 'Look at the map your computer already has.',
          hi: 'Wo map dekho jo tumhare computer ke paas already hai.',
        },
        run: 'route',
        after: {
          en: 'The line 0.0.0.0/0 is the default route — it literally means "I have no idea, ask my parent". Almost all your traffic uses it.',
          hi: '0.0.0.0/0 wali line default route hai — iska matlab hai "mujhe nahi pata, mere parent se poochho". Tumhara lagbhag saara traffic isi se jaata hai.',
        },
      },
      {
        say: {
          en: 'Now discover every router between you and a server, live.',
          hi: 'Ab tumhare aur ek server ke beech ka har router live dhoondho.',
        },
        run: 'tracert github.com',
        after: {
          en: 'Hops stream in one by one as they answer. Watch the latency: a small jump is a nearby city, a big jump is usually an undersea cable.',
          hi: 'Hops ek-ek karke aate hain jab wo jawaab dete hain. Latency dekho: chhota jump paas ka sheher, bada jump aksar samundar ke neeche ka cable.',
        },
      },
      {
        say: {
          en: 'Trace somewhere far away and compare the shape of the path.',
          hi: 'Kisi door ki jagah trace karo aur raaste ki shakl compare karo.',
        },
        run: 'tracert example.com',
        after: {
          en: 'Different destination, different path, and some hops show nothing at all. Those routers chose not to answer — that is allowed, not an error.',
          hi: 'Alag destination, alag raasta, aur kuch hops bilkul khaali. Un routers ne jawaab na dene ka faisla kiya — ye allowed hai, error nahi.',
        },
      },
    ],
  },

  tier3: {
    intro: {
      en: 'Traceroute is a trick. There is no "list the path" command on the internet.',
      hi: 'Traceroute ek jugaad hai. Internet pe "raasta batao" naam ki koi command hai hi nahi.',
    },
    steps: [
      {
        say: {
          en: 'Trace something deliberately close to everyone.',
          hi: 'Aisi jagah trace karo jo jaanbujh kar sabke paas hai.',
        },
        run: 'tracert 1.1.1.1',
        after: {
          en: 'Very few hops. Cloudflare pays to sit near you, and the hop count is the receipt for that money.',
          hi: 'Bahut kam hops. Cloudflare tumhare paas baithne ke paise deta hai, aur hop count us paise ki raseed hai.',
        },
      },
      {
        say: {
          en: 'Now trace something genuinely far away and count the difference.',
          hi: 'Ab sach me door ki koi cheez trace karo aur farak gino.',
        },
        run: 'tracert example.com',
        after: {
          en: 'More hops, and one link where the latency roughly doubles in a single step. That step is almost always a cable under an ocean.',
          hi: 'Zyada hops, aur ek link jahan ek hi step me latency lagbhag dugni ho jaati hai. Wo step lagbhag hamesha samundar ke neeche ka cable hota hai.',
        },
      },
    ],

    points: [
      {
        en: 'Every packet carries a TTL that each router decreases by one. At zero the router throws it away AND complains back to you. That complaint is the discovery.',
        hi: 'Har packet me ek TTL hota hai jise har router ek se kam karta hai. Zero pe router use phenk deta hai AUR tumhe shikayat bhejta hai. Wahi shikayat hi khoj hai.',
      },
      {
        en: 'So: send TTL=1, hop 1 complains, you learn hop 1. Send TTL=2, hop 2 complains. Repeat until the destination itself replies.',
        hi: 'To: TTL=1 bhejo, hop 1 shikayat karta hai, hop 1 pata chal gaya. TTL=2 bhejo, hop 2 bolta hai. Aise chalta raho jab tak destination khud jawaab na de.',
      },
      {
        en: 'A reply with TTL=119 almost certainly started at 128 — so the server is nine hops away. You can count hops without running traceroute at all.',
        hi: 'TTL=119 wala reply lagbhag pakka 128 se shuru hua tha — matlab server nau hops door hai. Traceroute chalaye bina hops gine ja sakte hain.',
      },
      {
        en: 'Stars mean a router chose not to reply. It still forwarded your packet. Silence is a policy, not a failure.',
        hi: 'Star ka matlab router ne jawaab na dene ka faisla kiya. Usne packet phir bhi aage bheja. Chuppi ek policy hai, failure nahi.',
      },
    ],
  },

  challenge: {
    run: 'tracert example.com',
    // Somewhere far enough that the path has room for a big latency step.
    verify: { kind: 'hops', min: 8 },
    ask: {
      en: 'Trace a server in another country. Find the hop where latency jumps the most — that is usually the undersea cable.',
      hi: 'Kisi doosre desh ke server ko trace karo. Wo hop dhoondho jahan latency sabse zyada badhi — wahi aksar samundar ke neeche ka cable hota hai.',
    },
  },

  terms: ['router', 'routing table', 'default route', 'hop', 'TTL', 'ICMP', 'latency', 'traceroute', 'IX'],
}
