export default {
  id: 5,
  slug: 'THE_LOCK',
  title: 'The Lock',
  real: true,
  proto: 'TLS / X.509',

  question: {
    en: 'Your packet survives the trip. But every router on the way could read it.',
    hi: 'Packet safar poora kar leta hai. Par raaste ka har router use padh sakta tha.',
  },

  tier1: {
    beats: [
      {
        text: {
          en: 'You just watched your packet pass through nine strangers machines.\nAny one of them could read every word of it.',
          hi: 'Tumne abhi apne packet ko nau ajnabiyon ki machines se guzarte dekha.\nUnme se koi bhi uska har shabd padh sakta tha.',
        },
        art: [
          '  no HTTPS   you --- router --- router --- server',
          '             open: every hop can read it',
          '',
          '  HTTPS      you -#- router -#- router -#- server',
          '             locked: only the two ends can',
        ].join('\n'),
      },
      {
        text: {
          en: 'HTTPS fixes this with a handshake first, then a locked conversation.\nThe padlock in your browser is that handshake having succeeded.',
          hi: 'HTTPS pehle ek handshake karke ise theek karta hai, phir baat locked ho jaati hai.\nBrowser me jo taala dikhta hai wo isi handshake ke safal hone ka nishaan hai.',
        },
      },
      {
        text: {
          en: 'The handshake is not only about secrecy. It is about identity:\nproving the server really is who the name says it is.',
          hi: 'Handshake sirf chhupane ke liye nahi hai. Ye pehchaan ke liye hai:\nsaabit karna ki server wahi hai jo naam kehta hai.',
        },
      },
    ],
    hook: {
      en: 'One field in that handshake is sent in the clear. It is the hostname — which is exactly how your ISP still knows which sites you visit.',
      hi: 'Us handshake me ek field bina taale ke jaati hai. Wo hostname hai — isiliye tumhare ISP ko aaj bhi pata rehta hai tum kaun si sites khol rahe ho.',
    },
  },

  tier2: {
    intro: {
      en: 'Watch a real handshake, then read the certificate the server sends as its ID card.',
      hi: 'Ek asli handshake dekho, phir wo certificate padho jo server apne ID card ki tarah bhejta hai.',
    },
    steps: [
      {
        say: {
          en: 'Say hello to a server in the language of TLS.',
          hi: 'Ek server ko TLS ki bhasha me hello bolo.',
        },
        run: 'tls github.com',
        after: {
          en: 'We sent a 517-byte ClientHello. The server replied with its choice of cipher and its full certificate chain — parsed by our own X.509 code.',
          hi: 'Humne 517-byte ka ClientHello bheja. Server ne apna cipher chuna aur poori certificate chain bheji — jise hamare apne X.509 code ne padha.',
        },
      },
      {
        say: {
          en: 'Read the ID card: who issued it, who it is for, and until when.',
          hi: 'ID card padho: kisne jaari kiya, kiske liye hai, aur kab tak.',
        },
        run: 'tls medium.com',
        after: {
          en: 'Subject is the site, Issuer is the authority that vouched for it, and the SAN list is every name this one certificate covers.',
          hi: 'Subject site hai, Issuer wo authority hai jisne guarantee di, aur SAN list me wo saare naam hain jo ye ek certificate cover karta hai.',
        },
      },
      {
        say: {
          en: 'Now refuse to say which site you want, and watch the server refuse you back.',
          hi: 'Ab batao hi mat ki kaunsi site chahiye, aur dekho server tumhe mana kar deta hai.',
        },
        run: 'tls medium.com --no-sni',
        after: {
          en: 'A fatal alert, level 2 code 40: handshake_failure. This machine hosts thousands of sites and cannot guess which certificate to show.',
          hi: 'Fatal alert, level 2 code 40: handshake_failure. Is machine pe hazaaron sites hain, wo andaaza nahi laga sakti ki kaunsa certificate dikhaye.',
        },
      },
      {
        say: {
          en: 'Now dial that same machine but ask for somebody else name.',
          hi: 'Ab usi machine pe dial karo par kisi aur ka naam maango.',
        },
        run: 'tls medium.com --sni discord.com',
        after: {
          en: 'You connected to Medium and got back a certificate for discord.com. One IP, thousands of sites, and the name is the only thing choosing between them.',
          hi: 'Tum Medium se jude aur discord.com ka certificate mila. Ek IP, hazaaron sites, aur unme se chunne wali ekmatra cheez wo naam hai.',
        },
      },
    ],
  },

  tier3: {
    intro: {
      en: 'The record header, the extensions, and why we deliberately ask for older crypto.',
      hi: 'Record header, extensions, aur hum jaanbujh kar purani crypto kyun maangte hain.',
    },
    steps: [
      {
        say: {
          en: 'Take one handshake and open its bytes.',
          hi: 'Ek handshake lo aur uske bytes kholo.',
        },
        run: 'tls medium.com',
        after: {
          en: 'Find the SNI extension in the tree. The hostname is sitting there in readable ASCII, before any key exists - click it and watch the same letters light up in the hex.',
          hi: 'Tree me SNI extension dhoondho. Hostname wahan padhne laayak ASCII me pada hai, kisi key ke banne se pehle - click karo aur wahi akshar hex me jalte dekho.',
        },
      },
      {
        say: {
          en: 'Now send the same hello with the name taken out, and read the refusal.',
          hi: 'Ab wahi hello bina naam ke bhejo, aur inkaar padho.',
        },
        run: 'tls medium.com --no-sni',
        after: {
          en: 'Two bytes come back: level 2, description 40. That is the entire message - fatal, handshake_failure. A refusal costs the server almost nothing to send.',
          hi: 'Do bytes wapas aate hain: level 2, description 40. Bas itna hi sandesh hai - fatal, handshake_failure. Inkaar bhejne me server ka kuch kharch hi nahi hota.',
        },
      },
    ],

    points: [
      {
        en: 'Byte 0x16 means handshake, then two version bytes, then a length. Every TLS record on earth starts this way, encrypted or not.',
        hi: 'Byte 0x16 matlab handshake, phir do version bytes, phir length. Duniya ka har TLS record aise hi shuru hota hai, encrypted ho ya na ho.',
      },
      {
        en: 'Extension 0x0000 is SNI — the hostname, in plain readable ASCII, before any key exists. It has to be plain: the server cannot pick a key until it knows who you asked for.',
        hi: 'Extension 0x0000 SNI hai — hostname, saaf padhne laayak ASCII me, kisi key ke banne se pehle. Ye plain hona hi tha: server key chun hi nahi sakta jab tak use pata na ho tumne kiska naam liya.',
      },
      {
        en: 'The certificate is ASN.1 DER — a nested tag-length-value format. We parse it ourselves, which is why every field in the tree can point back at its exact bytes.',
        hi: 'Certificate ASN.1 DER hai — nested tag-length-value format. Hum ise khud parse karte hain, isiliye tree ka har field apne exact bytes pe ishaara kar paata hai.',
      },
      {
        en: 'We deliberately offer TLS 1.2, not 1.3. In 1.3 the certificate is encrypted and we would see nothing. That is itself the lesson: reading this certificate is only possible because we asked for older crypto — exactly what 1.3 fixed.',
        hi: 'Hum jaanbujh kar TLS 1.2 offer karte hain, 1.3 nahi. 1.3 me certificate encrypted hota hai aur humein kuch nahi dikhta. Yahi sabak hai: ye certificate isiliye padh paa rahe ho kyunki humne purani crypto maangi — aur 1.3 ne isi ko theek kiya.',
      },
    ],
    edits: [
      {
        field: 'SNI extension',
        to: 'a different hostname',
        result: {
          en: 'The wrong site certificate comes back from the right machine. The best moment in the whole project.',
          hi: 'Sahi machine se galat site ka certificate aata hai. Poore project ka sabse achha moment.',
        },
      },
      {
        field: 'record length',
        to: 'anything wrong',
        result: {
          en: 'The connection closes instantly. The server stops reading the moment the framing stops making sense.',
          hi: 'Connection turant band. Jaise hi framing ka matlab nahi banta, server padhna band kar deta hai.',
        },
      },
    ],
  },

  challenge: {
    run: 'tls medium.com --sni discord.com',
    // Met when the certificate does not cover the host actually dialled.
    verify: { kind: 'certForOtherName' },
    ask: {
      en: 'Connect to medium.com but ask for discord.com in the SNI field. Whose certificate comes back, and why can one IP serve thousands of sites?',
      hi: 'medium.com se juro par SNI field me discord.com maango. Kiska certificate aata hai, aur ek IP hazaaron sites kaise chala sakta hai?',
    },
  },

  terms: ['TLS', 'HTTPS', 'handshake', 'ClientHello', 'ServerHello', 'certificate', 'SNI',
    'cipher suite', 'X.509', 'ASN.1 DER', 'Subject', 'Issuer', 'SAN', 'certificate chain'],
}
