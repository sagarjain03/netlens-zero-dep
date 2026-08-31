/**
 * transport.js — the Transport module.
 *
 * The layer where the honest limits matter most. A process can see the socket
 * it opened and the numbers the kernel attached to it, and cannot see the
 * SYN, the ACK or the congestion window — those never leave the kernel. So
 * these topics show what is genuinely observable, say plainly what is not,
 * and send the rest to a lab that is labelled SIM.
 *
 * Chapter 4 is the SIM one. Chapters 2 and 6 are where UDP and TCP are
 * visible for real, which is why the cross-links point there.
 */

const T = (en, hi) => ({ en, hi })

export default {
  // ── the layer ──────────────────────────────────────────────────────────
  'transport-layer': {
    title: T('The transport layer', 'Transport layer'),
    question: T(
      'IP delivers a packet to a machine. But a machine is running forty programs.',
      'IP packet ko machine tak pahuncha deta hai. Par machine pe to chalees program chal rahe hain.',
    ),
    beats: [
      {
        text: T(
          'Layer 3 finds the machine and stops there. Layer 4 finishes the job:\ngetting the bytes to the one program that was waiting for them.',
          'Layer 3 machine dhoondh ke ruk jaati hai. Layer 4 kaam poora karti hai:\nbytes us ek program tak pahunchana jo unka intezaar kar raha tha.',
        ),
        art: [
          '  IP      to this machine',
          '  port    to this program on it',
          '  together, a conversation between two programs',
        ].join('\n'),
      },
      {
        text: T(
          'It also decides how much care to take. Layer 3 promises nothing, so if\nanything is going to notice a lost packet, it has to be this layer.',
          'Ye ye bhi tay karti hai ki kitni ehtiyaat barti jaaye. Layer 3 kuch waada nahi karti,\nto khoya packet agar kisi ko pakadna hai to isi layer ko.',
        ),
      },
      {
        text: T(
          'Two answers exist and both are in daily use. One notices and repairs;\nthe other does not look, and that is not laziness but a choice.',
          'Iske do jawaab hain aur dono roz use hote hain. Ek dekhta hai aur theek karta hai;\ndoosra dekhta hi nahi, aur ye aalas nahi, ek faisla hai.',
        ),
      },
    ],
    hook: T(
      'Every one of those conversations is listed on your machine right now, with both ends of each.',
      'Un sab baaton ki list abhi tumhari machine pe hai, har ek ke dono siron ke saath.',
    ),
    steps: [
      {
        say: T('List every layer 4 conversation your machine is holding open.', 'Wo saari layer 4 baatcheet dekho jo tumhari machine khole baithi hai.'),
        run: 'netstat',
        after: T(
          'Each line has two addresses and two ports. The addresses came from layer 3; the ports are what layer 4 added, and they are the reason the right program gets the bytes.',
          'Har line me do address aur do port hain. Address layer 3 se aaye; port layer 4 ne jode, aur unhi ki wajah se sahi program tak bytes pahunchte hain.',
        ),
      },
    ],
    points: [
      T('The transport layer runs only on the two end machines. No router on the path opens it, which is why it can add reliability the network itself never promised.',
        'Transport layer sirf dono sire ki machines pe chalti hai. Raaste ka koi router ise kholta nahi, isiliye ye wo bharosemandi jod paati hai jo network ne khud kabhi waada nahi ki.'),
      T('That end-to-end placement is the design idea the internet is built on. Keep the middle simple and stupid; put the cleverness at the edges.',
        'Yahi end-to-end soch wo design hai jis pe internet bana hai. Beech ko simple aur bewakoof rakho; hoshiyari kinaron pe rakho.'),
      T('Honest limit: a program can see the socket and the numbers the kernel attached to it, and never the handshake bytes. Those are the kernel’s, and this app says so rather than inventing them.',
        'Imaandaar limit: program ko socket aur kernel ke lagaye numbers dikhte hain, handshake ke bytes kabhi nahi. Wo kernel ke hain, aur ye app unhe banane ki jagah saaf keh deta hai.'),
    ],
    challenge: {
      ask: T('Two programs on your machine are talking to the same server. What in the packet keeps their replies from being handed to the wrong one?',
        'Tumhari machine ke do program ek hi server se baat kar rahe hain. Packet me aisa kya hai jo unke jawaab aapas me nahi badalne deta?'),
      run: 'netstat',
    },
    terms: ['TCP', 'UDP', 'port', 'socket', 'IP address', 'layer'],
  },

  // ── TCP ────────────────────────────────────────────────────────────────
  tcp: {
    title: T('TCP', 'TCP'),
    question: T(
      'The network loses packets and reorders them. So how does a file arrive intact?',
      'Network packets khota bhi hai aur unka kram bhi badal deta hai. To file saabut kaise pahunchti hai?',
    ),
    beats: [
      {
        text: T(
          'TCP numbers every byte. The receiver says what it has, so a gap is\nvisible without anybody having to report an error.',
          'TCP har byte ko number deta hai. Receiver batata hai uske paas kya hai, isliye gap\nkhud dikh jaata hai, kisi ko error batana nahi padta.',
        ),
        art: [
          '  sender    1..500  501..1000  1001..1500',
          '  receiver  got 1000, still waiting for 1001',
          '  the number is the whole mechanism',
        ].join('\n'),
      },
      {
        text: T(
          'Before any of that, three messages set the connection up and agree the\nstarting numbers. That is the handshake, and it costs a round trip.',
          'Isse pehle teen message connection banate hain aur shuruaati number tay karte hain.\nYahi handshake hai, aur iski keemat ek round trip hai.',
        ),
      },
      {
        text: T(
          'Then it watches the timing and slows itself down when the network is\nfull. Nobody tells it to — a missing acknowledgement is the only signal.',
          'Phir ye timing dekhta rehta hai aur network bhar jaane pe khud dheema ho jaata hai.\nKoi kehta nahi — bas ek na aaya acknowledgement hi poora ishaara hai.',
        ),
      },
    ],
    hook: T(
      'You cannot see the handshake bytes from a program, but you can see exactly what it cost.',
      'Handshake ke bytes program se nahi dikhte, par unki keemat theek-theek dikh jaati hai.',
    ),
    steps: [
      {
        say: T('Open one connection and read what the socket reports.', 'Ek connection kholo aur dekho socket kya batata hai.'),
        run: 'curl https://example.com --head',
        after: T(
          'Note the connect time. That is the handshake, measured — the delay before a single byte of your request could be sent.',
          'Connect time dekho. Wahi handshake hai, naapa hua — wo deri jo tumhari request ka ek byte bhi jaane se pehle lagi.',
        ),
      },
      {
        say: T('Now watch the same cost inside a full page load.', 'Ab wahi kharcha poore page load ke andar dekho.'),
        run: 'journey https://example.com',
        after: T(
          'The TCP stage is a whole round trip before TLS can even start. Count how much of the total elapsed before any content moved.',
          'TLS shuru hone se pehle hi TCP ka ek poora round trip lag jaata hai. Gino ki content chalne se pehle kitna time nikal gaya.',
        ),
      },
    ],
    points: [
      T('Head-of-line blocking is the price of order: one lost segment stalls everything queued behind it, including data that already arrived safely.',
        'Head-of-line blocking kram ki keemat hai: ek khoya segment apne peeche ki poori line rok deta hai, us data ko bhi jo theek pahunch chuka tha.'),
      T('Congestion control is separate from flow control. Flow control stops you drowning the receiver; congestion control stops you drowning the network.',
        'Congestion control aur flow control alag hain. Flow control receiver ko doobne se bachata hai; congestion control network ko.'),
      T('A connection is identified by four things: both addresses and both ports. That is why one server can hold thousands of them on port 443 at once.',
        'Connection chaar cheezon se pehchana jaata hai: dono address aur dono port. Isiliye ek server port 443 pe hazaaron ek saath rakh sakta hai.'),
      T('Closing takes messages too. A connection that ends badly leaves state behind, which is what all those TIME_WAIT lines in netstat are.',
        'Band karne me bhi message lagte hain. Bura ant hua connection peeche state chhod jaata hai, aur netstat ki wo saari TIME_WAIT line wahi hain.'),
    ],
    challenge: {
      ask: T('Run journey twice on one site and compare the TCP stage. What was reused the second time, and what could not be?',
        'Ek hi site pe journey do baar chalao aur TCP stage compare karo. Doosri baar kya dobara istemaal hua, aur kya nahi ho saka?'),
      run: 'journey https://example.com',
    },
    terms: ['TCP', 'handshake', 'sequence number', 'acknowledgement', 'head-of-line blocking', 'round trip', 'socket'],
  },

  // ── UDP ────────────────────────────────────────────────────────────────
  udp: {
    title: T('UDP', 'UDP'),
    question: T(
      'If TCP repairs everything, why would anyone choose the protocol that does not?',
      'Agar TCP sab theek kar deta hai, to koi wo protocol kyun chunega jo nahi karta?',
    ),
    beats: [
      {
        text: T(
          'Because repair takes time, and some things are worthless late. A word\nre-sent after the conversation moved on is worse than a word missing.',
          'Kyunki marammat me waqt lagta hai, aur kuch cheezein der se bekaar ho jaati hain.\nBaat aage badhne ke baad dobara aaya shabd, gayab shabd se bura hai.',
        ),
      },
      {
        text: T(
          'UDP sends the packet and forgets it. No handshake, no numbering, no\nmemory of what went — the first packet is already your data.',
          'UDP packet bhej ke bhool jaata hai. Na handshake, na numbering, na yaad ki kya gaya —\npehla packet hi tumhara data hota hai.',
        ),
        art: [
          '  TCP   hello -> hello -> ok -> then finally your data',
          '  UDP   your data',
        ].join('\n'),
      },
      {
        text: T(
          'Its header is eight bytes against TCP’s twenty. For one small question\nand one small answer, the setup would have cost more than asking twice.',
          'Iska header aath bytes ka hai, TCP ka bees. Ek chhote sawaal aur chhote jawaab ke liye\nsetup ki keemat dobara poochne se zyada hoti.',
        ),
      },
    ],
    hook: T(
      'The lookup that starts every page you open chose UDP, for exactly that reason. Watch it.',
      'Har page ke shuru me hone wala lookup UDP chunta hai, theek isi wajah se. Dekho.',
    ),
    steps: [
      {
        say: T('Send a real UDP exchange and count what it cost.', 'Ek asli UDP baatcheet bhejo aur uska kharcha gino.'),
        run: 'dig example.com',
        after: T(
          'One packet out, one back. No connection was set up and none was torn down — over TCP the setup alone would have cost more than the whole exchange did.',
          'Ek packet gaya, ek aaya. Na koi connection bana, na toota — TCP pe to akele setup ki keemat is poori baatcheet se zyada hoti.',
        ),
      },
      {
        say: T('Compare that with the cost of a TCP exchange.', 'Ab isse TCP wali baatcheet ka kharcha milaao.'),
        run: 'curl https://example.com --head',
        after: T(
          'Look at the two elapsed times. Most of the difference is not the data — it is the setup TCP insists on and UDP skips.',
          'Dono ka time dekho. Farak ka zyadatar hissa data nahi hai — wo setup hai jis pe TCP zid karta hai aur UDP chhod deta hai.',
        ),
      },
    ],
    points: [
      T('UDP does not mean unreliable data. It means the protocol will not repair loss for you, so the application decides whether to care.',
        'UDP ka matlab bharosa-laayak na hona nahi hai. Matlab ye ki protocol tumhare liye loss theek nahi karega, isliye parwah karni hai ya nahi ye application tay karti hai.'),
      T('Many things build their own reliability on top of UDP. QUIC does exactly that, and HTTP/3 runs on it — reliability without TCP’s head-of-line blocking.',
        'Kai cheezein UDP ke upar apni bharosemandi khud banati hain. QUIC yahi karta hai, aur HTTP/3 usi pe chalta hai — bharosa, par TCP wale head-of-line blocking ke bina.'),
      T('A DNS answer too large for one UDP packet sets the truncated flag, and the client is expected to ask again over TCP. The escape hatch is part of the design.',
        'Jo DNS jawaab ek UDP packet me na samaaye wo truncated flag laga deta hai, aur client se TCP pe dobara poochne ki umeed ki jaati hai. Ye raasta design ka hissa hai.'),
      T('Because there is no connection, a forged reply only has to arrive first. That is why the transaction ID and source port matter so much in DNS.',
        'Connection hai hi nahi, isliye fake jawaab ko sirf pehle pahunchna hota hai. Isiliye DNS me transaction ID aur source port itne mayne rakhte hain.'),
    ],
    challenge: {
      ask: T('DNS chose UDP but can fall back to TCP. Describe the situation that forces the fallback, and what the client sees that tells it to.',
        'DNS ne UDP chuna par wo TCP pe ja sakta hai. Wo haalat batao jo majboor karti hai, aur client ko kya dikhta hai jisse use pata chalta hai.'),
      run: 'dig example.com',
    },
    terms: ['UDP', 'TCP', 'header', 'DNS', 'round trip', 'packet'],
  },

  // ── the comparison ─────────────────────────────────────────────────────
  'tcp-vs-udp': {
    title: T('TCP vs UDP', 'TCP vs UDP'),
    question: T(
      'Both carry bytes between two programs. Where exactly do they part company?',
      'Dono do program ke beech bytes le jaate hain. Inke raaste alag theek kahan hote hain?',
    ),
    beats: [
      {
        text: T(
          'On one question, and only one: what to do when a packet goes missing.\nEverything else in the table follows from that single answer.',
          'Sirf ek sawaal pe: packet kho jaaye to karna kya hai.\nTable ki baaki har baat isi ek jawaab se nikalti hai.',
        ),
      },
      {
        text: T(
          'Choose to repair and you need numbering, acknowledgements, timers and a\nhandshake to agree where the numbers start. Reliability is not one feature.',
          'Marammat chuno to numbering, acknowledgements, timers aur ek handshake chahiye taaki\nnumber kahan se shuru hon ye tay ho. Bharosemandi koi ek feature nahi hai.',
        ),
      },
      {
        text: T(
          'Choose not to and all of that disappears, along with the delay it caused.\nNeither is the winner. The question is what your data is for.',
          'Na chuno to ye sab gayab ho jaata hai, aur uski laayi hui deri bhi.\nKoi jeetta nahi. Sawaal ye hai ki tumhara data kis kaam ka hai.',
        ),
      },
    ],
    hook: T(
      'The lab puts them side by side, including the rows where they agree — which is usually the more surprising half.',
      'Lab dono ko saath rakhta hai, un rows samet jahan dono ek jaise hain — aur aksar wahi zyada chaunkane wala hissa hota hai.',
    ),
    lab: 'compare',
    labSay: T(
      'Read the table, then answer each situation before you open it.',
      'Table padho, phir har haalat ka jawaab khud socho, uske baad kholo.',
    ),
    points: [
      T('They agree on more than they differ on. Both find the right program with port numbers, and both ride on IP and inherit its best-effort promise.',
        'Ye jitne me alag hain usse zyada me ek jaise hain. Dono port numbers se sahi program dhoondhte hain, aur dono IP pe chalte hain aur uska best-effort waada wirasat me lete hain.'),
      T('The choice is per application, not per network. Your machine is using both right now, on the same wire, at the same time.',
        'Ye chunaav har application ka hai, network ka nahi. Tumhari machine abhi dono use kar rahi hai, ek hi taar pe, ek hi waqt.'),
      T('QUIC muddies the tidy answer: it is reliable like TCP but built on UDP, precisely to avoid the head-of-line blocking that ordering costs.',
        'QUIC is saaf jawaab ko gadbad kar deta hai: ye TCP jaisa bharosemand hai par bana UDP pe hai, theek us head-of-line blocking se bachne ke liye jo kram ki keemat hai.'),
    ],
    challenge: {
      ask: T('A video call and a file download run at once on your machine. Say which protocol each chose and what would go wrong if they were swapped.',
        'Tumhari machine pe ek video call aur ek file download saath chal rahe hain. Batao dono ne kaunsa protocol chuna aur badal dene pe kya bigadta.'),
    },
    terms: ['TCP', 'UDP', 'port', 'packet loss', 'head-of-line blocking'],
  },

  // ── ports ──────────────────────────────────────────────────────────────
  ports: {
    title: T('Ports and sockets', 'Ports aur sockets'),
    question: T(
      'Forty programs, one address, one cable. How does a reply find the right one?',
      'Chalees program, ek address, ek cable. Jawaab sahi wale tak pahunchta kaise hai?',
    ),
    beats: [
      {
        text: T(
          'A port is a number in the transport header saying which program the bytes\nare for. Nothing more than that — it is not a place or a door.',
          'Port transport header me likha ek number hai jo batata hai bytes kis program ke liye hain.\nBas itna hi — ye koi jagah ya darwaza nahi hai.',
        ),
        art: [
          '  server    listens on a known number, forever',
          '  client    is given a fresh high number, for one call',
          '  reply     carries both, so it can only match one conversation',
        ].join('\n'),
      },
      {
        text: T(
          'The server’s number has to be known in advance, because you have to know\nwhere to knock. The client’s does not, so the OS picks one and discards it.',
          'Server ka number pehle se pata hona chahiye, kyunki dastak kahan deni hai ye jaanna zaroori hai.\nClient ka nahi, isliye OS ek chun leta hai aur baad me phenk deta hai.',
        ),
      },
      {
        text: T(
          'A socket is the pair in use: an address and a port at each end. Four\nnumbers, and together they name exactly one conversation on the internet.',
          'Socket wahi joda hai jo istemaal me hai: har sire pe ek address aur ek port. Chaar number,\naur milke wo internet pe theek ek baatcheet ka naam ban jaate hain.',
        ),
      },
    ],
    hook: T(
      'Your OS is handing out those throwaway numbers constantly. Take two in a row and watch.',
      'Tumhara OS ye use-and-throw number lagataar baant raha hai. Do lagataar lo aur dekho.',
    ),
    steps: [
      {
        say: T('Be a client once, and note the local port.', 'Ek baar client bano, aur local port note karo.'),
        run: 'curl https://example.com --head',
        after: T(
          'That high number was chosen a millisecond ago for this one call, and will not be used for it again.',
          'Wo bada number ek millisecond pehle isi ek call ke liye chuna gaya, aur iske liye dobara use nahi hoga.',
        ),
      },
      {
        say: T('Do it again and compare the two.', 'Dobara karo aur dono milaao.'),
        run: 'curl https://example.com --head',
        after: T(
          'A different local port, the same remote one. The server end never moves; your end is new every time, and that is what keeps the two replies apart.',
          'Local port alag, remote wahi. Server wala sira kabhi nahi hilta; tumhara sira har baar naya hota hai, aur isi se dono jawaab alag rehte hain.',
        ),
      },
      {
        say: T('Now see every number your machine is currently holding.', 'Ab wo saare number dekho jo tumhari machine abhi rakhe hue hai.'),
        run: 'netstat',
        after: T(
          'Low familiar numbers on the far side, high scattered ones on yours. Each line is one socket, and no two lines can have all four numbers in common.',
          'Doosri taraf chhote jaane-pehchane number, tumhari taraf bade bikhre hue. Har line ek socket hai, aur do line ke chaaron number kabhi ek jaise nahi ho sakte.',
        ),
      },
    ],
    points: [
      T('The ranges are a convention, not a rule: 0–1023 well known, 1024–49151 registered, above that ephemeral. Nothing stops a server listening anywhere.',
        'Ye ranges convention hain, niyam nahi: 0–1023 well known, 1024–49151 registered, uske upar ephemeral. Server ko kahin bhi sunne se koi nahi rokta.'),
      T('Low ports usually need privilege to bind, which is a security convention rather than anything the protocol requires.',
        'Chhote ports pe baithne ke liye aksar privilege chahiye, aur ye suraksha ka riwaaz hai, protocol ki koi zaroorat nahi.'),
      T('TCP and UDP have separate port spaces. Port 53 for UDP and port 53 for TCP are two different places, and DNS uses both.',
        'TCP aur UDP ke port space alag hain. UDP ka port 53 aur TCP ka port 53 do alag jagah hain, aur DNS dono use karta hai.'),
      T('A closed connection cannot free its port instantly. TIME_WAIT holds it long enough that a straggling packet cannot be mistaken for part of the next conversation.',
        'Band hua connection apna port turant nahi chhod sakta. TIME_WAIT use itni der rokta hai ki peeche reh gaya packet agli baatcheet ka hissa na samjha jaaye.'),
    ],
    challenge: {
      ask: T('Two browser tabs open the same site at the same second. All four numbers are nearly identical — name the one that is not, and explain why it has to be.',
        'Do browser tab ek hi second me ek hi site kholte hain. Chaaron number lagbhag ek jaise hain — batao kaunsa nahi hai, aur kyun nahi ho sakta.'),
      run: 'netstat',
    },
    terms: ['port', 'socket', 'ephemeral port', 'TCP', 'UDP', 'IP address'],
  },
}
