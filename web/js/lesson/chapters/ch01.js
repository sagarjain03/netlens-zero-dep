export default {
  id: 1,
  slug: 'YOUR_OWN_NETWORK',
  title: 'Your Own Network',
  real: true,
  proto: 'IP / ARP',

  question: {
    en: 'Where does anything on the internet even start?',
    hi: 'Internet pe kuch bhi shuru kahan se hota hai?',
  },

  tier1: {
    beats: [
      {
        text: {
          en: 'Every device on a network has an address, like a house number.\nYour computer has one right now. So does your router.',
          hi: 'Network pe har device ka ek address hota hai, ghar ke number jaisa.\nTumhare computer ka bhi ek hai, abhi. Router ka bhi.',
        },
        art: [
          '  [ Your PC ]  ──  [ Router ]  ──▶  🌍 Internet',
          '  192.168.1.5      192.168.1.1',
          '      you            the door out',
        ].join('\n'),
      },
      {
        text: {
          en: 'That address is not one idea but three: who you are,\nwho counts as your neighbour, and which door leads outside.',
          hi: 'Wo address ek idea nahi, teen hain: tum kaun ho,\npadosi kaun gina jaayega, aur bahar ka darwaza kaunsa hai.',
        },
      },
      {
        text: {
          en: 'Your computer also keeps a list of every neighbour it has spoken to.\nIt is called the ARP table, and you have never looked at it.',
          hi: 'Tumhara computer un sab padosiyon ki list bhi rakhta hai jinse baat hui.\nUse ARP table kehte hain, aur tumne kabhi dekha nahi hoga.',
        },
      },
    ],
    hook: {
      en: 'That second device in the list? That is somebody phone in your house. Your computer already knows about it.',
      hi: 'List me jo doosri device hai? Wo ghar me kisi ka phone hai. Tumhare computer ko already pata hai.',
    },
  },

  tier2: {
    intro: {
      en: 'Three commands. All of them read your real machine — nothing here is made up.',
      hi: 'Teen commands. Teeno tumhari asli machine se padhte hain — yahan kuch banaya hua nahi hai.',
    },
    steps: [
      {
        say: {
          en: 'Ask your own machine who it is on this network.',
          hi: 'Apni machine se poochho ki is network pe wo kaun hai.',
        },
        run: 'ifconfig',
        after: {
          en: 'Four things matter: your IP (you), the subnet mask (who is a neighbour), the gateway (the way out), the MAC (the hardware itself).',
          hi: 'Chaar cheezein important hain: IP (tum), subnet mask (padosi kaun), gateway (bahar ka raasta), MAC (hardware khud).',
        },
      },
      {
        say: {
          en: 'Now ask which neighbours it has actually seen.',
          hi: 'Ab poochho ki usne asal me kaun se padosi dekhe hain.',
        },
        run: 'arp',
        after: {
          en: 'Every line is a device that answered on your LAN. The one matching your gateway IP is your router.',
          hi: 'Har line ek device hai jisne tumhare LAN pe jawaab diya. Jo gateway IP se match kare, wahi tumhara router hai.',
        },
      },
      {
        say: {
          en: 'Check that your router is reachable, and how long it takes.',
          hi: 'Check karo ki router pahunch me hai, aur kitna time lagta hai.',
        },
        run: 'ping 192.168.1.1',
        after: {
          en: 'A reply in 1-5 ms means it is inside your house. Compare that with a server abroad later — distance is measurable.',
          hi: '1-5 ms ka jawaab matlab wo tumhare ghar ke andar hai. Baad me kisi videshi server se compare karna — doori naapi ja sakti hai.',
        },
      },
    ],
  },

  tier3: {
    intro: {
      en: 'Why 192.168.x.x is not on the public internet at all.',
      hi: '192.168.x.x public internet pe hai hi nahi — kyun.',
    },
    steps: [
      {
        say: {
          en: 'Ping your router, then ping a public address, back to back.',
          hi: 'Ping your router, phir koi public address ping karo, ek ke baad ek.',
        },
        run: 'ping 1.1.1.1',
        after: {
          en: 'Your router answers in single-digit milliseconds; 1.1.1.1 takes several times longer. Same one hop in the routing table - what you are measuring is distance, not hops.',
          hi: 'Router single-digit milliseconds me jawaab deta hai; 1.1.1.1 kaafi zyada leta hai. Routing table me dono ek hi hop hain - tum hops nahi, doori naap rahe ho.',
        },
      },
      {
        say: {
          en: 'Ask the app what your machine will and will not let us do.',
          hi: 'App se poochho ki tumhari machine humein kya karne degi aur kya nahi.',
        },
        run: 'doctor',
        after: {
          en: 'Raw sockets, ICMP, UDP to port 53 - each one either works on your OS or it does not. Every limit you see here is a limit we chose to show rather than hide.',
          hi: 'Raw sockets, ICMP, UDP port 53 pe - har ek ya to tumhare OS pe chalta hai ya nahi. Yahan dikhne wali har limit wo hai jise humne chhupane ki jagah dikhaya.',
        },
      },
    ],

    points: [
      {
        en: 'Private ranges (10.x, 172.16-31.x, 192.168.x) are reserved. No router on the public internet forwards them, which is why millions of homes reuse the same numbers.',
        hi: 'Private ranges (10.x, 172.16-31.x, 192.168.x) reserved hain. Public internet ka koi router inhe aage nahi bhejta, isliye laakhon ghar wahi numbers dobara use karte hain.',
      },
      {
        en: 'The subnet mask is a bitmask, not a number. IP AND mask = your network. Two addresses with the same result are neighbours and skip the router entirely.',
        hi: 'Subnet mask ek bitmask hai, number nahi. IP AND mask = tumhara network. Same result wale do address padosi hain aur router ko bypass kar dete hain.',
      },
      {
        en: 'MAC is your face, IP is your current address. The face never changes; the address changes every time you join a new network.',
        hi: 'MAC tumhara chehra hai, IP tumhara current pata. Chehra kabhi nahi badalta; pata har naye network pe badal jaata hai.',
      },
      {
        en: 'The first three bytes of a MAC are the OUI — the vendor code. a4:83:e7 is Apple. You can identify hardware without ever touching it.',
        hi: 'MAC ke pehle teen bytes OUI hain — vendor code. a4:83:e7 Apple hai. Hardware ko chhue bina pehchana ja sakta hai.',
      },
    ],
  },

  challenge: {
    run: 'arp',
    ask: {
      en: 'Find your router MAC address, then identify the vendor from its first three bytes.',
      hi: 'Apne router ka MAC address dhoondho, phir uske pehle teen bytes se vendor pehchano.',
    },
  },

  terms: ['IP address', 'subnet mask', 'gateway', 'MAC address', 'ARP', 'LAN', 'OUI', 'private IP'],
}
