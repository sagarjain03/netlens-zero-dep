export default {
  id: 8,
  slug: 'IT_WAS_LAYERS',
  title: 'It Was Layers All Along',
  real: false,
  proto: 'OSI / TCP-IP',

  question: {
    en: 'Seven chapters, four protocols. Was any of that actually organised?',
    hi: 'Saat chapters, chaar protocols. Kya wo sab kisi kram me tha bhi?',
  },

  tier1: {
    beats: [
      {
        text: {
          en: 'Everything you just learned was organised in layers.\nYou already know all of them. Here are their real names.',
          hi: 'Jo kuch tumne abhi seekha wo layers me bata hua tha.\nTum sab already jaante ho. Ye rahe unke asli naam.',
        },
        art: [
          '  ┌ Ethernet   MAC to MAC          ← ch 1 ┐',
          '  │ ┌ IP       address to address  ← ch 3 │',
          '  │ │ ┌ TCP    port to port        ← ch 4 │',
          '  │ │ │ ┌ TLS  locked              ← ch 5 │',
          '  │ │ │ │ ┌ HTTP  GET /            ← ch 6 │',
        ].join('\n'),
      },
      {
        text: {
          en: 'Each layer wraps the one above it in its own header,\nlike putting a letter in an envelope in a sack on a truck.',
          hi: 'Har layer apne upar wali ko apne header me lapet leti hai,\njaise chitthi ko lifaafe me, lifaafe ko bori me, bori ko truck me.',
        },
      },
      {
        text: {
          en: 'A layer only talks to the one directly above and below it.\nThat is why you can change Wi-Fi to cable and nothing above notices.',
          hi: 'Ek layer sirf apne theek upar aur neeche wali se baat karti hai.\nIsi liye Wi-Fi se cable pe jao to upar wali kisi layer ko farak nahi padta.',
        },
      },
    ],
    hook: {
      en: 'This is OSI. If it had been chapter one, it would have been seven meaningless words. On chapter eight it is a filing system for things you already own.',
      hi: 'Yahi OSI hai. Chapter ek me hota to saat bekaar shabd hote. Chapter aath me ye un cheezon ka filing system hai jo tumhare paas pehle se hain.',
    },
  },

  // The reveal this chapter exists for is the peel, and it was ASCII art
  // until the encapsulation lab was built. Now the boxes are operable and
  // the overhead is a number that moves.
  lab: 'layers',
  labSay: {
    en: 'Drag the payload size and watch the envelopes stay the same while their share of the total changes.',
    hi: 'Payload ka size ghumao aur dekho lifaafe wahi rehte hain jabki total me unka hissa badalta hai.',
  },

  tier2: {
    intro: {
      en: 'We do not simulate a packet for this. We take a real one you already captured and peel it.',
      hi: 'Iske liye hum packet banate nahi. Jo tumne already capture kiya hai, usi asli packet ko chheelte hain.',
    },
    steps: [
      {
        say: {
          en: 'Capture a full exchange first, so there is something real to peel.',
          hi: 'Pehle poora exchange capture karo, taaki chheelne ko kuch asli ho.',
        },
        run: 'journey https://example.com',
        after: {
          en: 'Every layer you are about to name is already sitting in that timeline. Nothing new will be fetched.',
          hi: 'Jin layers ke naam abhi rakhne hain, wo sab us timeline me baithi hain. Naya kuch nahi mangwaya jaayega.',
        },
      },
      {
        say: {
          en: 'Look at where your own machine sits in the stack — layers 2 and 3.',
          hi: 'Dekho tumhari apni machine stack me kahan baithi hai — layer 2 aur 3.',
        },
        run: 'ifconfig',
        after: {
          en: 'The MAC is layer 2, the IP is layer 3. One address, two layers, and you have been carrying both since chapter one.',
          hi: 'MAC layer 2 hai, IP layer 3. Ek device, do layers, aur tum dono chapter ek se leke ghoom rahe ho.',
        },
      },
      {
        say: {
          en: 'Look at layer 4 — the ports holding your live conversations.',
          hi: 'Layer 4 dekho — wo ports jo tumhari zinda baatcheet pakde hue hain.',
        },
        run: 'netstat',
        after: {
          en: 'Layer 3 gets the packet to the machine. Layer 4 decides which program on it. That split is the entire reason both layers exist.',
          hi: 'Layer 3 packet ko machine tak pahunchati hai. Layer 4 tay karti hai usme kaunsa program. Yahi batwara dono layers ke hone ka poora kaaran hai.',
        },
      },
    ],
  },

  tier3: {
    intro: {
      en: 'The honest version, including the part textbooks skip.',
      hi: 'Imaandaar version, wo hissa bhi jo kitaabein chhod deti hain.',
    },
    steps: [
      {
        say: {
          en: 'Capture the real exchange you are about to take apart.',
          hi: 'Wo asli exchange capture karo jise tum abhi kholne ja rahe ho.',
        },
        run: 'journey https://example.com',
        after: {
          en: 'Every layer named in this chapter is already in that timeline. We are not fetching anything new - we are relabelling what you already have.',
          hi: 'Is chapter me jitni layers ka naam aayega, sab us timeline me pehle se hain. Naya kuch nahi laa rahe - jo tumhare paas hai usi pe naye label lag rahe hain.',
        },
      },
      {
        say: {
          en: 'Look at layer 3 on its own - the table that picks the next machine.',
          hi: 'Layer 3 ko alag se dekho - wo table jo agli machine chunti hai.',
        },
        run: 'route',
        after: {
          en: 'Layer 3 decides which machine. Layer 4 decides which program on it. Split those two apart and you have explained why both layers had to exist.',
          hi: 'Layer 3 tay karti hai kaunsi machine. Layer 4 tay karti hai usme kaunsa program. In dono ko alag karke dekho aur samajh aa jaayega ki dono layers zaroori kyun thi.',
        },
      },
    ],

    points: [
      {
        en: 'Encapsulation: data goes down the stack gaining a header at each layer, crosses the wire, then goes up losing them in reverse. That sentence is the entire meaning of "the network stack".',
        hi: 'Encapsulation: data neeche jaate hue har layer pe ek header pehanta hai, wire paar karta hai, phir upar jaate hue ulte kram me utaarta hai. Isi ek vaakya me "network stack" ka poora matlab hai.',
      },
      {
        en: 'Overhead is real: 54 bytes of headers wrapped around 142 bytes of request. Roughly a quarter of what leaves your machine is addressing, not content.',
        hi: 'Overhead asli hai: 142 bytes ki request ke around 54 bytes headers. Tumhari machine se jo nikalta hai uska lagbhag chauthai hissa content nahi, address hai.',
      },
      {
        en: 'OSI has seven layers, TCP/IP has four, and the internet actually runs on the four. Layers 5 and 6 barely exist in practice — nobody tells you that.',
        hi: 'OSI me saat layers hain, TCP/IP me chaar, aur internet asal me chaar wale pe chalta hai. Layer 5 aur 6 practice me lagbhag hain hi nahi — ye koi nahi batata.',
      },
      {
        en: 'The payoff of layering is substitution. Swap Wi-Fi for fibre and layer 3 upwards never finds out. Swap HTTP for a chat protocol and layers 1 to 4 never find out either.',
        hi: 'Layering ka fayda badalne me hai. Wi-Fi ki jagah fibre lagao, layer 3 se upar kisi ko pata nahi chalega. HTTP ki jagah chat protocol lagao, layer 1 se 4 ko bhi pata nahi chalega.',
      },
    ],
  },

  challenge: {
    run: 'journey https://example.com',
    ask: {
      en: 'Which layer would you change to move this app to a server in another country? Which one to switch from HTTP to a chat protocol?',
      hi: 'Is app ko doosre desh ke server pe le jaane ke liye kaunsi layer badlogi? Aur HTTP se chat protocol pe jaane ke liye kaunsi?',
    },
  },

  terms: ['OSI model', 'TCP/IP model', 'layer', 'encapsulation', 'header', 'payload',
    'Ethernet', 'frame', 'overhead'],
}
