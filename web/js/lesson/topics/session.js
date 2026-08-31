/**
 * session.js — the Session & Presentation module.
 *
 * The awkward part of the syllabus, and the module that has to be most honest.
 * OSI layers 5 and 6 are examinable and almost nothing implements them
 * separately: the jobs are real, and they are done inside the application
 * protocol or by a library beside it.
 *
 * So rather than pretend, these topics name the jobs, show where each one is
 * genuinely performed, and point at the two chapters where you can watch it
 * happen on a live connection.
 */

const T = (en, hi) => ({ en, hi })

export default {
  // ── the two layers ─────────────────────────────────────────────────────
  'session-presentation': {
    title: T('Session and presentation', 'Session aur presentation'),
    question: T(
      'OSI has seven layers. Why does every real diagram seem to have four?',
      'OSI me saat layers hain. To har asli diagram me chaar hi kyun dikhti hain?',
    ),
    beats: [
      {
        text: T(
          'Layers 5 and 6 describe two real jobs. Keeping track of a conversation\nacross several exchanges, and agreeing how the data is written down.',
          'Layer 5 aur 6 do asli kaam batati hain. Kai exchanges me faili ek baatcheet ka hisaab rakhna,\naur ye tay karna ki data likha kaise jaayega.',
        ),
        art: [
          '  OSI 7  Application  |',
          '  OSI 6  Presentation |  all three are "the application"',
          '  OSI 5  Session      |  in TCP/IP',
          '  OSI 4  Transport    -> Transport',
        ].join('\n'),
      },
      {
        text: T(
          'Both jobs get done. Neither gets its own layer in any stack anybody\nships — they are done inside the application protocol, or by a library.',
          'Dono kaam hote hain. Par kisi bhi chalne wale stack me inki apni layer nahi hoti —\nye application protocol ke andar hote hain, ya kisi library se.',
        ),
      },
      {
        text: T(
          'That is worth knowing plainly rather than discovering in an exam. The\nmodel is a filing system, and two of its drawers are mostly empty.',
          'Ye baat exam me pata chalne se behtar hai ki pehle hi saaf pata ho. Model ek filing system hai,\naur uske do khaane lagbhag khaali hain.',
        ),
      },
    ],
    hook: T(
      'The encapsulation lab shows both models at once, and marks the two layers nobody implements separately.',
      'Encapsulation lab dono models ek saath dikhata hai, aur un do layers pe nishaan lagata hai jinhe koi alag se nahi banata.',
    ),
    lab: 'layers',
    labSay: T(
      'Scroll to "seven against four" and read the two greyed rows.',
      '"Seven against four" tak jao aur wo do dhundhli rows padho.',
    ),
    points: [
      T('The session job is real: HTTP is stateless, so logins and carts are built with cookies and tokens on top of that forgetting.',
        'Session ka kaam asli hai: HTTP stateless hai, isliye login aur cart usi bhoolne ke upar cookies aur tokens se bante hain.'),
      T('The presentation job is real too: character encodings, compression and encryption all decide how the bytes are written rather than what they mean.',
        'Presentation ka kaam bhi asli hai: character encoding, compression aur encryption sab ye tay karte hain ki bytes likhe kaise jaayein, matlab kya hai ye nahi.'),
      T('TLS is the usual example given for layer 6, and it sits between transport and application without being either. That is the closest anything comes to a presentation layer.',
        'Layer 6 ki misaal aksar TLS di jaati hai, aur wo transport aur application ke beech baithta hai bina koi ek hue. Presentation layer ke sabse kareeb yahi cheez aati hai.'),
      T('OSI was designed first and TCP/IP was described after the code worked. That is most of why one has seven layers and the other four.',
        'OSI pehle design hua tha aur TCP/IP code chalne ke baad likha gaya. Ek me saat layers hain aur doosre me chaar — wajah zyadatar yahi hai.'),
    ],
    challenge: {
      ask: T('Name one thing a browser does that is a session job and one that is a presentation job, and say which layer of TCP/IP each actually lives in.',
        'Browser ka ek aisa kaam batao jo session ka hai aur ek jo presentation ka, aur batao TCP/IP me dono asal me kaunsi layer me hain.'),
    },
    terms: ['OSI model', 'TCP/IP model', 'layer', 'TLS', 'HTTP', 'encapsulation'],
  },

  // ── SSL and TLS ────────────────────────────────────────────────────────
  'ssl-tls': {
    title: T('SSL and TLS', 'SSL aur TLS'),
    question: T(
      'Every router on the path can read your packets. What actually stops them?',
      'Raaste ka har router tumhare packets padh sakta hai. Rokta unhe kya hai?',
    ),
    beats: [
      {
        text: T(
          'TLS does two separate jobs, and the second is the one people forget.\nIt hides the conversation, and it proves who you are talking to.',
          'TLS do alag kaam karta hai, aur doosra wahi hai jo log bhool jaate hain.\nYe baat chhupata hai, aur ye bhi saabit karta hai ki tum baat kis se kar rahe ho.',
        ),
      },
      {
        text: T(
          'Hiding without proving is useless. An eavesdropper who can also answer\nyou would simply be the one you agreed a key with.',
          'Chhupana bina saabit kiye bekaar hai. Jo sun bhi sakta ho aur jawaab bhi de sakta ho,\nwo bas wahi ban jaata jisse tumne key tay ki.',
        ),
        art: [
          '  ClientHello   "I speak these versions and ciphers"',
          '  ServerHello   "then we will use this one"',
          '  Certificate   "and here is proof of who I am"',
        ].join('\n'),
      },
      {
        text: T(
          'SSL is the old name. Every version of it is broken and disabled; what\nruns today is TLS, and the word SSL survives only in habit.',
          'SSL purana naam hai. Uska har version toot chuka hai aur band hai; aaj jo chalta hai wo TLS hai,\naur SSL shabd sirf aadat me bacha hai.',
        ),
      },
    ],
    hook: T(
      'One field in that handshake is sent in the clear, and it is the site name. Chapter 5 makes a server hand back somebody else’s certificate with it.',
      'Us handshake ki ek field bina taale ke jaati hai, aur wo site ka naam hai. Chapter 5 me usi se server kisi aur ka certificate thama deta hai.',
    ),
    steps: [
      {
        say: T('Watch a real handshake and read the ID card that comes back.', 'Ek asli handshake dekho aur jo ID card aaye use padho.'),
        run: 'tls github.com',
        after: T(
          'Subject is the name claimed, Issuer is who vouched for it, and the SAN list is every name this one certificate covers.',
          'Subject wo naam hai jo claim kiya gaya, Issuer wo hai jisne guarantee di, aur SAN list me wo saare naam hain jo ye ek certificate cover karta hai.',
        ),
      },
      {
        say: T('Now refuse to say which site you want.', 'Ab batao hi mat ki kaunsi site chahiye.'),
        run: 'tls medium.com --no-sni',
        after: T(
          'A machine hosting many sites cannot guess which certificate to show. Read what came back — a refusal is two bytes, and costs the server nothing.',
          'Kai sites wali machine andaaza nahi laga sakti ki kaunsa certificate dikhaye. Jo aaya wo padho — inkaar do bytes ka hai, aur server ka kuch kharch nahi hota.',
        ),
      },
    ],
    points: [
      T('The certificate proves the name, not the honesty. It says this really is that domain; it says nothing about whether the domain deserves trust.',
        'Certificate naam saabit karta hai, imaandaari nahi. Ye kehta hai ye sach me wahi domain hai; ye nahi kehta ki us domain pe bharosa karna chahiye.'),
      T('Trust is delegated in a chain up to a root your machine already holds. Nobody vouches for everyone; each link vouches only for the next.',
        'Bharosa ek chain me upar tak saunpa jaata hai, us root tak jo tumhari machine ke paas pehle se hai. Koi sabke liye guarantee nahi deta; har kadi sirf agli ke liye deti hai.'),
      T('SNI is sent before any key exists, so it cannot be encrypted — the server has to know which certificate to send. That is why your ISP still sees which sites you visit.',
        'SNI kisi key ke banne se pehle jaata hai, isliye use encrypt nahi kiya ja sakta — server ko pata hona chahiye kaunsa certificate bhejna hai. Isiliye ISP aaj bhi dekh leta hai tum kaunsi sites kholte ho.'),
      T('In TLS 1.3 the certificate itself is encrypted. This app deliberately offers 1.2 so the certificate is readable, and the interface says so.',
        'TLS 1.3 me certificate khud encrypted hota hai. Ye app jaan boojh kar 1.2 offer karta hai taaki certificate padha ja sake, aur interface ye batata bhi hai.'),
    ],
    challenge: {
      ask: T('Ask one machine for a certificate under a different site’s name. Whose certificate comes back, and what does that prove about how one IP serves thousands of sites?',
        'Ek machine se kisi doosri site ke naam ka certificate maango. Kiska certificate aata hai, aur isse kya saabit hota hai ki ek IP hazaaron sites kaise chalata hai?'),
      run: 'tls medium.com --sni discord.com',
    },
    terms: ['TLS', 'HTTPS', 'handshake', 'certificate', 'SNI', 'Subject', 'Issuer', 'SAN', 'certificate chain', 'cipher suite'],
  },

  // ── MIME ───────────────────────────────────────────────────────────────
  mime: {
    title: T('MIME', 'MIME'),
    question: T(
      'The reply is a stream of bytes. How does the browser know it is a picture?',
      'Jawaab to bytes ki dhaar hai. Browser ko kaise pata ki ye tasveer hai?',
    ),
    beats: [
      {
        text: T(
          'It does not guess from the file name, and it should not. The sender says\nwhat the bytes are, in a header, and that declaration is the whole of MIME.',
          'Wo file ke naam se andaaza nahi lagata, aur lagana bhi nahi chahiye. Bhejne wala header me\nbatata hai bytes hain kya, aur wahi ghoshna poora MIME hai.',
        ),
        art: [
          '  Content-Type: text/html; charset=UTF-8',
          '                ^^^^ ^^^^  ^^^^^^^^^^^^^',
          '                kind form  how to decode it',
        ].join('\n'),
      },
      {
        text: T(
          'It began as a way to send anything but plain text through mail, which\ncould only carry ASCII. Hence the name: Multipurpose Internet Mail Extensions.',
          'Iski shuruaat mail se plain text ke alawa kuch bhejne ke liye hui, jo sirf ASCII le ja sakti thi.\nIsi se naam bana: Multipurpose Internet Mail Extensions.',
        ),
      },
      {
        text: T(
          'The web borrowed it wholesale. Every reply you have ever received carried\none of these lines, and it is the only reason your browser knew what to do.',
          'Web ne ise poora ka poora udhaar le liya. Tumhe mila har jawaab isi kism ki ek line laaya tha,\naur browser ko kya karna hai ye sirf usi se pata chala.',
        ),
      },
    ],
    hook: T(
      'Ask any server for just its headers and the declaration is right there, in plain text, before a single byte of content.',
      'Kisi bhi server se sirf headers maango aur wo ghoshna wahin milegi, saadi text me, content ke ek byte se bhi pehle.',
    ),
    steps: [
      {
        say: T('Fetch only the headers and find the declaration.', 'Sirf headers laao aur wo ghoshna dhoondho.'),
        run: 'curl https://example.com --head',
        after: T(
          'Content-Type names a kind and a form, and often a charset. Without the charset the same bytes could decode into different letters entirely.',
          'Content-Type kism aur roop batata hai, aur aksar charset bhi. Charset ke bina wahi bytes bilkul alag akshar ban sakte hain.',
        ),
      },
      {
        say: T('Now see the same header on a full response.', 'Ab wahi header poore jawaab pe dekho.'),
        run: 'curl https://example.com',
        after: T(
          'The header arrives before the body, which is what lets the browser decide how to read the bytes while they are still arriving.',
          'Header body se pehle aata hai, isi se browser tay kar paata hai ki bytes ko kaise padhna hai jab wo aa hi rahe hote hain.',
        ),
      },
    ],
    points: [
      T('Mail could carry only ASCII, so binary is encoded into printable characters and decoded at the far end. That is why an attachment is about a third larger than the file.',
        'Mail sirf ASCII le ja sakti thi, isliye binary ko printable characters me badla jaata hai aur doosre sire pe wapas. Isiliye attachment file se lagbhag ek tihai bada hota hai.'),
      T('Multipart is how one message carries several parts, each with its own type, separated by a boundary string the sender promises does not appear inside.',
        'Multipart se ek message kai hisse le jaata hai, har ek ka apna type, aur beech me ek boundary string jiske andar na aane ka bhejne wala waada karta hai.'),
      T('A wrong Content-Type is a security problem, not just a display bug. A browser that treats uploaded data as HTML will run whatever script is in it.',
        'Galat Content-Type sirf dikhne ki gadbad nahi, suraksha ki samasya hai. Jo browser upload kiye data ko HTML maan le wo usme likha koi bhi script chala dega.'),
      T('This is a presentation-layer job in OSI terms, done by the application protocol — which is the module’s whole point in one header line.',
        'OSI ki bhasha me ye presentation layer ka kaam hai, jo application protocol karta hai — aur is module ki poori baat isi ek header line me hai.'),
    ],
    challenge: {
      ask: T('Find two responses with different Content-Type values. What would break if a server sent the bytes of one under the declaration of the other?',
        'Do aise jawaab dhoondho jinke Content-Type alag hon. Agar server ek ke bytes doosre ki ghoshna ke saath bhej de to kya bigadta?'),
      run: 'curl https://example.com --head',
    },
    terms: ['HTTP', 'header', 'ASCII', 'byte', 'protocol'],
  },
}
