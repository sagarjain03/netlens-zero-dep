export default {
  id: 2,
  slug: 'NAMES_TO_NUMBERS',
  title: 'Names to Numbers',
  real: true,
  proto: 'DNS',

  question: {
    en: 'You have an address. But how do you find facebook.com address?',
    hi: 'Tumhara address to mil gaya. Par facebook.com ka address kaise pata chalega?',
  },

  tier1: {
    beats: [
      {
        text: {
          en: 'Computers only understand numbers, not names.\nDNS is the internet phonebook: give a name, get a number.',
          hi: 'Computer sirf numbers samajhta hai, naam nahi.\nDNS internet ki phonebook hai: naam do, number lo.',
        },
        art: [
          '  "facebook.com"      a name you can read',
          '        |',
          '        v   ask the phonebook at 1.1.1.1',
          '  157.240.16.35       a number the machine uses',
        ].join('\n'),
      },
      {
        text: {
          en: 'Your computer does this before every single page you open.\nIt takes about 10 milliseconds and you have never seen it happen.',
          hi: 'Har page kholne se pehle tumhara computer yahi karta hai.\nLagbhag 10 millisecond lagte hain aur tumne kabhi hote hue dekha nahi.',
        },
      },
      {
        text: {
          en: 'The question leaves as 28 bytes over UDP. The answer comes back.\nWe wrote the code that builds those bytes and reads the reply.',
          hi: 'Sawaal 28 bytes ban ke UDP se nikalta hai. Jawaab wapas aata hai.\nUn bytes ko banane aur padhne ka code humne khud likha hai.',
        },
      },
    ],
    hook: {
      en: 'Nothing here is a recording. Press run and a real packet leaves your machine.',
      hi: 'Yahan kuch recorded nahi hai. Run dabao aur ek asli packet tumhari machine se nikalta hai.',
    },
  },

  tier2: {
    intro: {
      en: 'Ask the phonebook a question. Then change the question, and watch the answer change with it.',
      hi: 'Phonebook se ek sawaal poochho. Phir sawaal badlo, aur jawaab ko badalte dekho.',
    },
    steps: [
      {
        say: {
          en: 'Ask for one name. Watch the packet fly to the resolver and back.',
          hi: 'Ek naam poochho. Packet ko resolver tak jaate aur wapas aate dekho.',
        },
        run: 'dig facebook.com',
        after: {
          en: 'Read the timeline: bytes out, bytes in, round trip in milliseconds. The A record at the bottom is the answer.',
          hi: 'Timeline padho: bytes gaye, bytes aaye, round trip milliseconds me. Neeche jo A record hai wahi jawaab hai.',
        },
      },
      {
        say: {
          en: 'Now ask the same name for its IPv6 address instead.',
          hi: 'Ab usi naam ka IPv6 address poochho.',
        },
        run: 'dig facebook.com AAAA',
        after: {
          en: 'One field changed in the question, and a completely different kind of address came back. Look closely — this one contains face:b00c.',
          hi: 'Sawaal me ek field badla, aur bilkul alag kism ka address aa gaya. Dhyan se dekho — isme face:b00c likha hai.',
        },
      },
      {
        say: {
          en: 'Ask for a name that is really a nickname for another name.',
          hi: 'Aisa naam poochho jo asal me kisi doosre naam ka nickname hai.',
        },
        run: 'dig www.github.com',
        after: {
          en: 'A CNAME came back before the address: "this name is an alias, go look at that one instead".',
          hi: 'Address se pehle CNAME aaya: "ye naam ek alias hai, us doosre ko dekho".',
        },
      },
      {
        say: {
          en: 'Ask for a name that does not exist, so you see failure too.',
          hi: 'Aisa naam poochho jo hai hi nahi, taaki failure bhi dikhe.',
        },
        run: 'dig nonexist.abcd',
        after: {
          en: 'NXDOMAIN. Not empty, not an error — a real answer that means "no such name".',
          hi: 'NXDOMAIN. Na khaali, na error — ye asli jawaab hai jiska matlab hai "aisa naam nahi hai".',
        },
      },
      {
        say: {
          en: 'Race four public resolvers against each other on the same name.',
          hi: 'Ek hi naam pe chaar public resolvers ki race karao.',
        },
        run: 'resolvers facebook.com',
        after: {
          en: 'Same question, same answer, different speeds. Which phonebook you use is a real choice with a measurable cost.',
          hi: 'Wahi sawaal, wahi jawaab, alag speed. Kaunsi phonebook use karni hai — ye asli choice hai, aur cost naapi ja sakti hai.',
        },
      },
    ],
  },

  tier3: {
    intro: {
      en: 'The full wire format, decoded by our own parser. Twelve header bytes, then the name.',
      hi: 'Poora wire format, hamare apne parser se decode kiya hua. Barah header bytes, phir naam.',
    },
    steps: [
      {
        say: {
          en: 'Send one query, then open the bytes it was made of.',
          hi: 'Ek query bhejo, phir jin bytes se wo bani thi unhe kholo.',
        },
        run: 'dig facebook.com',
        after: {
          en: 'Click any field in the tree on the right and its exact bytes light up in the hex dump. Nothing is reconstructed for display - that is the packet that left your machine.',
          hi: 'Daayin taraf tree me kisi bhi field pe click karo aur uske exact bytes hex dump me jal uthenge. Dikhane ke liye kuch dobara banaya nahi gaya - yahi wo packet hai jo tumhari machine se nikla.',
        },
      },
      {
        say: {
          en: 'Ask a second resolver the same thing, so you have two packets to compare.',
          hi: 'Wahi cheez doosre resolver se poochho, taaki compare karne ko do packets ho.',
        },
        run: 'dig @8.8.8.8 facebook.com',
        after: {
          en: 'Same question, different transaction ID, different TTL left on the answer. The ID is random; the TTL tells you how long ago this resolver last asked the real owner.',
          hi: 'Wahi sawaal, alag transaction ID, jawaab pe bachi hui alag TTL. ID random hai; TTL batati hai ki is resolver ne asli maalik se aakhri baar kitni der pehle poocha tha.',
        },
      },
    ],

    points: [
      {
        en: 'Names are NOT dotted strings on the wire. "github.com" is sent as 06 g i t h u b 03 c o m 00 — length-prefixed labels ending in a zero byte.',
        hi: 'Wire pe naam dotted string nahi hote. "github.com" aise jaata hai: 06 g i t h u b 03 c o m 00 — length-prefixed labels, aakhir me zero byte.',
      },
      {
        en: 'The two flag bytes are eleven separate fields packed into sixteen bits. QR alone tells you which direction the packet is travelling.',
        hi: 'Do flag bytes me gyaarah alag fields solah bits me thuse hain. Akela QR bata deta hai packet kis taraf ja raha hai.',
      },
      {
        en: 'The transaction ID is the only thing stopping anyone from forging an answer. A reply carrying the wrong ID is thrown away unread.',
        hi: 'Transaction ID hi ek cheez hai jo fake jawaab rokti hai. Galat ID wala reply bina padhe phenk diya jaata hai.',
      },
      {
        en: 'Answers point backwards into the packet with a compression pointer, so a repeated name costs two bytes instead of twelve.',
        hi: 'Answers packet me peeche ki taraf compression pointer se ishaara karte hain, isliye dohraya gaya naam barah ki jagah do bytes leta hai.',
      },
    ],
    edits: [
      {
        field: 'Question.QTYPE',
        to: '0x001c',
        result: {
          en: 'IPv6 comes back instead of IPv4 — one byte changed the kind of answer.',
          hi: 'IPv4 ki jagah IPv6 aa jaata hai — ek byte ne jawaab ka type badal diya.',
        },
      },
      {
        field: 'Question.QTYPE',
        to: '0x000f',
        result: {
          en: 'MX — the mail servers for this domain, with their preference numbers.',
          hi: 'MX — is domain ke mail servers, unke preference numbers ke saath.',
        },
      },
      {
        field: 'Question.QTYPE',
        to: '0x0002',
        result: {
          en: 'NS — who actually owns this zone and answers for it.',
          hi: 'NS — is zone ka asli maalik kaun hai aur jawaab kaun deta hai.',
        },
      },
      {
        field: 'a QNAME length byte',
        to: 'anything wrong',
        result: {
          en: 'The parse fails and we show you exactly where it stopped. Nothing throws.',
          hi: 'Parse fail ho jaata hai aur hum dikhate hain ki theek kahan ruka. Kuch crash nahi hota.',
        },
      },
    ],
  },

  challenge: {
    run: 'dig facebook.com',
    // Met when an AAAA record actually comes back, however it was asked for.
    verify: { kind: 'dnsType', type: 'AAAA' },
    ask: {
      en: 'Make the DNS server return an IPv6 address for facebook.com — by editing one byte, not by typing a new command.',
      hi: 'DNS server se facebook.com ka IPv6 address mangwao — ek byte edit karke, nayi command likhe bina.',
    },
  },

  terms: ['DNS', 'resolver', 'A record', 'AAAA record', 'CNAME', 'MX', 'NS', 'NXDOMAIN',
    'UDP', 'QTYPE', 'transaction ID', 'TTL', 'label', 'round trip'],
}
