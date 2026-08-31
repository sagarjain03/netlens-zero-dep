/**
 * network.js — the Network module.
 *
 * The layer with the most arithmetic in it, and the one students are most
 * likely to be examined on with a pencil. So every topic here opens a lab
 * that does the same arithmetic they will be asked to do by hand — and the
 * lab is the real thing, so an answer it gives can be checked against a
 * textbook and will agree.
 *
 * Where a topic makes a claim about the live network it states what to
 * measure rather than what the result will be. Two claims written the other
 * way round in the Application module turned out to be wrong when run.
 */

const T = (en, hi) => ({ en, hi })

export default {
  // ── the layer ──────────────────────────────────────────────────────────
  'network-layer': {
    title: T('The network layer', 'Network layer'),
    question: T(
      'Layer 2 crosses one cable. So who is responsible for the other nine thousand kilometres?',
      'Layer 2 ek cable paar karti hai. To baaki nau hazaar kilometre ki zimmedari kiski hai?',
    ),
    beats: [
      {
        text: T(
          'Layer 2 can only talk to a machine on the same wire. Everything beyond\nthat is layer 3: getting a packet across networks it has never seen.',
          'Layer 2 sirf usi taar par ki machine se baat kar sakti hai. Uske aage sab layer 3 hai:\npacket ko un networks ke paar le jaana jo usne kabhi dekhe hi nahi.',
        ),
        art: [
          '  L2   this cable, this hop, MAC to MAC',
          '  L3   the whole journey, address to address, hop after hop',
        ].join('\n'),
      },
      {
        text: T(
          'It does that with two things and nothing else: an address with structure\nin it, and a table at every machine saying where to send things next.',
          'Ye kaam wo sirf do cheezon se karti hai: aisa address jisme structure ho,\naur har machine pe ek table jo bataye aage kya kahan bhejna hai.',
        ),
      },
      {
        text: T(
          'Notice what it does not promise. Not delivery, not order, not speed.\nOnly a best effort — everything else is built on top of that admission.',
          'Dhyan do ye kya waada nahi karti. Na pahunchne ka, na kram ka, na raftaar ka.\nSirf poori koshish — baaki sab isi swikaarokti ke upar bana hai.',
        ),
      },
    ],
    hook: T(
      'Your machine has a routing table right now. It is three lines long, and it is the whole of layer 3 as your computer understands it.',
      'Tumhari machine ke paas abhi routing table hai. Teen line ka hai, aur tumhare computer ke liye yahi poori layer 3 hai.',
    ),
    steps: [
      {
        say: T('Read the map your machine actually uses.', 'Wo map padho jo tumhari machine sach me use karti hai.'),
        run: 'route',
        after: T(
          'One line for the neighbours it can reach directly, and one that means "anything else, send it to my router". That second line handles almost all your traffic.',
          'Ek line un padosiyon ke liye jinse seedha baat ho sakti hai, aur ek jiska matlab hai "baaki sab router ko bhej do". Tumhara lagbhag saara traffic usi doosri line se jaata hai.',
        ),
      },
      {
        say: T('Now watch that default line get used, one hop at a time.', 'Ab dekho wo default line ek-ek hop karke istemaal hoti hai.'),
        run: 'tracert 1.1.1.1',
        after: T(
          'Every machine in that list made the same decision your routing table just made, using a table of its own. Nobody knew the whole path.',
          'Us list ki har machine ne wahi faisla liya jo abhi tumhare routing table ne liya, apne table se. Poora raasta kisi ko nahi pata tha.',
        ),
      },
    ],
    points: [
      T('Layer 3 addresses have structure so they can be grouped. A router does not store a route to every machine on earth, only to blocks of them.',
        'Layer 3 addresses me structure isliye hai taaki unhe group kiya ja sake. Router har machine ka raasta nahi rakhta, sirf unke blocks ka.'),
      T('The layer 2 addresses are rewritten at every hop; the layer 3 addresses are not touched. The envelope changes, the letter does not.',
        'Layer 2 ke address har hop pe naye likhe jaate hain; layer 3 wale chhue nahi jaate. Lifaafa badalta hai, chitthi nahi.'),
      T('Best effort is a design choice, not a failure. Pushing reliability up to layer 4 is what let the network stay simple enough to grow this large.',
        'Best effort ek soch-samajh ka faisla hai, kami nahi. Bharosemandi ko layer 4 pe dhakelna hi wo baat hai jisne network ko itna simple rakha ki wo itna bada ho saka.'),
    ],
    challenge: {
      ask: T('Your routing table has only a few lines but reaches the whole internet. Explain how that is possible without it knowing where anything is.',
        'Tumhare routing table me sirf kuch line hain par wo poore internet tak pahunchta hai. Batao ye kaise mumkin hai jab use pata hi nahi kuch kahan hai.'),
      run: 'route',
    },
    terms: ['router', 'routing table', 'default route', 'IP address', 'hop', 'layer'],
  },

  // ── addresses ──────────────────────────────────────────────────────────
  'ip-address': {
    title: T('IP addresses', 'IP addresses'),
    question: T(
      'A MAC address already identifies a machine. Why invent a second one?',
      'MAC address to machine ko pehchanta hi hai. Doosra address banane ki zaroorat kya thi?',
    ),
    beats: [
      {
        text: T(
          'A MAC address says who. An IP address says where — and "where" is the\nonly thing you can route on.',
          'MAC address batata hai kaun. IP address batata hai kahan — aur route sirf\n"kahan" pe hi kiya ja sakta hai.',
        ),
        art: [
          '  MAC   a4:83:e7:1c:9f:22    burned in, means nothing about location',
          '  IP    192.168.1.5          means: network 192.168.1, machine 5',
        ].join('\n'),
      },
      {
        text: T(
          'That is the whole point of the structure. The address splits into a part\nnaming the network and a part naming a machine on it.',
          'Structure ka poora maqsad yahi hai. Address do hisso me batta hai: ek network ka naam,\ndoosra us par ki machine ka.',
        ),
      },
      {
        text: T(
          'Where exactly it splits is not fixed. The prefix says how many bits go to\nthe network, and everything else follows from that one number.',
          'Ye batwara theek kahan hoga, ye fix nahi hai. Prefix batata hai kitne bits network ke hain,\naur baaki sab usi ek number se nikalta hai.',
        ),
      },
    ],
    hook: T(
      'Your own address is split that way right now. Drag the prefix and watch the same 32 bits change hands.',
      'Tumhara apna address abhi isi tarah bata hua hai. Prefix ghumao aur wahi 32 bits haath badalte dekho.',
    ),
    lab: 'subnet',
    labSay: T(
      'Put your own address in and move the line. Everything below it recomputes.',
      'Apna address daalo aur line hilao. Uske neeche sab kuch dobara ginta hai.',
    ),
    steps: [
      {
        say: T('Read your real address and the mask beside it.', 'Apna asli address padho aur uske saath ka mask.'),
        run: 'ifconfig',
        after: T(
          'The mask is the prefix written the long way. Take those two numbers into the lab above and it will tell you who your neighbours are.',
          'Mask wahi prefix hai, lambe tareeke se likha. Ye do number upar wale lab me daalo aur wo bata dega tumhare padosi kaun hain.',
        ),
      },
    ],
    points: [
      T('The mask is a bitmask, not a number. IP AND mask gives the network; two addresses with the same result are neighbours and skip the router.',
        'Mask ek bitmask hai, number nahi. IP AND mask se network milta hai; same result wale do address padosi hain aur router ko chhod dete hain.'),
      T('Ones in a mask must be contiguous from the left. 255.255.254.0 is a mask; 255.0.255.0 is a typo, and the lab will refuse it.',
        'Mask ke ones baayein se lagataar hone chahiye. 255.255.254.0 mask hai; 255.0.255.0 galti hai, aur lab use maanega nahi.'),
      T('An address belongs to an interface, not a machine. A laptop on Wi-Fi and Ethernet at once has two, and neither is more real than the other.',
        'Address interface ka hota hai, machine ka nahi. Wi-Fi aur Ethernet dono pe laga laptop do rakhta hai, aur koi doosre se zyada asli nahi.'),
      T('This is why moving a laptop to a new network changes its IP and never its MAC. The face stays; the address is about where you are standing.',
        'Isiliye laptop naye network pe le jaane se IP badalta hai, MAC kabhi nahi. Chehra wahi rehta hai; address is baare me hai ki tum khade kahan ho.'),
    ],
    challenge: {
      ask: T('Take your own address and mask into the lab. How many machines could your network hold, and how many of those addresses can never be given to one?',
        'Apna address aur mask lab me daalo. Tumhara network kitni machines rakh sakta hai, aur unme se kitne address kabhi kisi machine ko nahi diye ja sakte?'),
      run: 'ifconfig',
    },
    terms: ['IP address', 'subnet mask', 'MAC address', 'gateway', 'bit'],
  },

  // ── classful and classless ─────────────────────────────────────────────
  classful: {
    title: T('Classful and classless', 'Classful aur classless'),
    question: T(
      'Why does an address get a /24 by default? Who decided that?',
      'Kisi address ko default me /24 kyun milta hai? Ye tay kisne kiya?',
    ),
    beats: [
      {
        text: T(
          'Originally the split was not a choice. The first few bits of the address\ndecided it for you, and there were exactly three sizes on offer.',
          'Shuru me ye batwara chunna nahi padta tha. Address ke pehle kuch bits khud tay kar dete the,\naur naap sirf teen the.',
        ),
        art: [
          '  class A   1.0.0.0   - 126.x    /8    16 million machines',
          '  class B   128.0.0.0 - 191.x    /16   65 thousand',
          '  class C   192.0.0.0 - 223.x    /24   just 254',
        ].join('\n'),
      },
      {
        text: T(
          'Look at the gap. A company with 300 machines was too big for a class C\nand got a class B — and wasted sixty-five thousand addresses.',
          'Us khaayi ko dekho. Teen sau machines wali company class C ke liye badi thi\nto use class B milta tha — aur painsath hazaar address barbaad ho jaate the.',
        ),
      },
      {
        text: T(
          'That waste is why the address space ran out decades before it should have.\nCIDR fixed it by making the split a number you choose.',
          'Isi barbaadi ki wajah se address space dashakon pehle khatam ho gaya.\nCIDR ne batware ko ek chunne laayak number bana kar ise theek kiya.',
        ),
      },
    ],
    hook: T(
      'The classes still exist in every textbook and in almost no equipment. The lab shows you both answers at once.',
      'Classes aaj bhi har kitaab me hain aur lagbhag kisi machine me nahi. Lab tumhe dono jawaab ek saath dikhata hai.',
    ),
    lab: 'subnet',
    labSay: T(
      'Type any address. The lab names its class, and tells you when the classful default disagrees with the prefix you chose.',
      'Koi bhi address likho. Lab uski class batayega, aur ye bhi ki classful default tumhare chune hue prefix se kahan alag hai.',
    ),
    points: [
      T('Classes were decided by the leading bits, so the class was visible in the address itself. That is the property CIDR gave up, and routing tables grew as a result.',
        'Class shuru ke bits se tay hoti thi, isliye class address me hi dikh jaati thi. CIDR ne yahi cheez chhodi, aur badle me routing tables bade ho gaye.'),
      T('Class D is multicast and class E was reserved for the future. The future arrived and used IPv6 instead, so class E has never been used for anything.',
        'Class D multicast hai aur class E bhavishya ke liye rakhi thi. Bhavishya aaya aur usne IPv6 chun liya, isliye class E kabhi kisi kaam nahi aayi.'),
      T('CIDR also allowed the reverse: many small networks summarised into one line in a router. Without that, the internet routing table would not fit in any router built.',
        'CIDR ne ulta bhi mumkin kiya: kai chhote networks ek line me sameth dena. Iske bina internet ka routing table kisi bhi bane hue router me nahi samaata.'),
    ],
    challenge: {
      ask: T('Find an address whose classful default is /8 but which would sensibly be given a /30 today. How many addresses did the old rule waste on it?',
        'Aisa address dhoondho jiska classful default /8 hai par aaj samajhdaari se /30 milta. Purane niyam ne uspe kitne address barbaad kiye?'),
    },
    terms: ['IP address', 'subnet mask', 'private IP'],
  },

  // ── subnetting ─────────────────────────────────────────────────────────
  subnetting: {
    title: T('Subnetting', 'Subnetting'),
    question: T(
      'You have been given one network. How do you split it between four departments?',
      'Tumhe ek network mila hai. Use chaar department me kaise baantoge?',
    ),
    beats: [
      {
        text: T(
          'Borrow bits from the host part. Every bit you borrow doubles the number\nof networks and halves the machines each one can hold.',
          'Host wale hisse se bits udhaar lo. Har udhaar liya bit networks ki ginti dugni kar deta hai\naur har network ki machines aadhi.',
        ),
        art: [
          '  /24   1 network    254 machines',
          '  /25   2 networks   126 each',
          '  /26   4 networks    62 each',
          '  /27   8 networks    30 each',
        ].join('\n'),
      },
      {
        text: T(
          'Two addresses in every subnet are spoken for. The first names the network\nitself and the last is the broadcast, so the usable count is always two less.',
          'Har subnet me do address pehle se bike hain. Pehla khud network ka naam hai aur\naakhri broadcast, isliye kaam ke address hamesha do kam hote hain.',
        ),
      },
      {
        text: T(
          'That is the whole exam question. Given an address and a prefix, name the\nnetwork, the broadcast, the first host and the last.',
          'Poora exam sawaal yahi hai. Ek address aur prefix diya ho to network, broadcast,\npehla host aur aakhri host batao.',
        ),
      },
    ],
    hook: T(
      'The lab does this arithmetic for real, so an answer it gives will agree with the one in the back of the book.',
      'Lab ye ganit sach me karta hai, isliye uska jawaab kitaab ke peeche wale jawaab se milega.',
    ),
    lab: 'subnet',
    labSay: T(
      'Set a prefix, then borrow bits with the second slider and watch the parent split into equal pieces.',
      'Prefix set karo, phir doosre slider se bits udhaar lo aur parent ko barabar tukdon me batte dekho.',
    ),
    points: [
      T('The subnets tile the parent exactly: no gaps and no overlap. The lab checks that every time, because an off-by-one here is invisible until something stops working.',
        'Subnets parent ko theek-theek dhak lete hain: na gap, na overlap. Lab ye har baar jaanchta hai, kyunki yahan ek ki galti tab tak dikhti nahi jab tak kuch band na ho jaaye.'),
      T('A /31 is the exception everyone forgets. On a point-to-point link both addresses are usable, precisely because there is no room for the usual two.',
        'Ek /31 wo apwaad hai jo sab bhool jaate hain. Point-to-point link pe dono address kaam ke hote hain, kyunki wahan un do ke liye jagah hi nahi bachti.'),
      T('A /32 is a single machine, and is how a specific host is written in a routing table or a firewall rule.',
        'Ek /32 ek hi machine hai, aur routing table ya firewall rule me koi khaas host aise hi likha jaata hai.'),
      T('Variable-length subnetting is the same trick applied unevenly: a large department and a two-machine link do not have to be given the same size.',
        'Variable-length subnetting wahi jugaad hai, bas alag-alag naap me: bade department aur do machine wale link ko ek jaisa naap dena zaroori nahi.'),
    ],
    challenge: {
      ask: T('Split a /24 so that one department gets at least 100 machines and three others get at least 20 each. What prefix does each one need?',
        'Ek /24 ko aise baanto ki ek department ko kam se kam 100 machines milein aur teen ko kam se kam 20-20. Har ek ko kaunsa prefix chahiye?'),
    },
    terms: ['subnet mask', 'IP address', 'gateway'],
  },

  // ── the header ─────────────────────────────────────────────────────────
  'ipv4-header': {
    title: T('The IPv4 header', 'IPv4 header'),
    question: T(
      'Every packet you have ever sent carried twenty bytes in front of it. What is in them?',
      'Tumne jo bhi packet bheja, uske aage bees bytes lage the. Unme hai kya?',
    ),
    beats: [
      {
        text: T(
          'Two addresses, and eighteen bytes of instructions to the routers in between.\nOnly one field is used to decide where the packet goes.',
          'Do address, aur beech ke routers ke liye athaarah bytes ke nirdesh.\nPacket kahan jaayega, ye tay karne me sirf ek field kaam aati hai.',
        ),
        art: [
          '  0        TTL is here, at byte 8',
          '  8   TTL  every router subtracts one',
          '  10  sum  so every router recomputes this',
          '  12  src',
          '  16  dst  the only field routing looks at',
        ].join('\n'),
      },
      {
        text: T(
          'The TTL is the safety net. Each router subtracts one, and at zero the\npacket is thrown away — which is what stops a routing loop lasting forever.',
          'TTL suraksha jaal hai. Har router ek ghata deta hai, aur zero pe packet phenk diya jaata hai —\nisi se routing loop hamesha ke liye nahi chalta.',
        ),
      },
      {
        text: T(
          'And because the TTL changes at every hop, the checksum has to be\nrecomputed at every hop too. That is a real cost, paid by every packet.',
          'Aur kyunki TTL har hop pe badalta hai, checksum bhi har hop pe dobara ginna padta hai.\nYe asli kharcha hai, jo har packet chukata hai.',
        ),
      },
    ],
    hook: T(
      'Change the TTL in the lab and watch the checksum move with it. That movement is the cost, made visible.',
      'Lab me TTL badlo aur checksum ko saath badalte dekho. Wahi hilna hi wo kharcha hai, dikhta hua.',
    ),
    lab: 'ipv4',
    labSay: T(
      'Press "one hop on" a few times, then click any byte to corrupt it and watch the check fail.',
      '"One hop on" kuch baar dabao, phir kisi byte pe click karke use bigaado aur check fail hote dekho.',
    ),
    steps: [
      {
        say: T('Watch the TTL do its job on a real path.', 'Asli raaste pe TTL ko kaam karte dekho.'),
        run: 'tracert 1.1.1.1',
        after: T(
          'Traceroute is nothing but this field, abused on purpose: send a packet allowed one hop, see who complains, then allow two.',
          'Traceroute isi field ka jaan boojh kar galat istemaal hai: ek hop wala packet bhejo, dekho kaun shikayat karta hai, phir do allow karo.',
        ),
      },
    ],
    points: [
      T('The checksum covers the header only, not the data. Layer 4 checks the payload, and doing it twice would be paying twice.',
        'Checksum sirf header ko dekhta hai, data ko nahi. Payload layer 4 jaanchti hai, aur do baar karna do baar kharch karna hota.'),
      T('IPv6 dropped this checksum entirely. Every router was recomputing it, and every layer above was checking anyway.',
        'IPv6 ne ye checksum poori tarah hata diya. Har router ise dobara gin raha tha, jabki upar ki har layer waise bhi jaanch rahi thi.'),
      T('Fragmentation lives in this header, and is now avoided rather than used. A packet too big for the next link is usually refused instead of split.',
        'Fragmentation isi header me hai, aur ab use karne ki jagah bacha jaata hai. Agli link ke liye bada packet aksar toda nahi, mana kar diya jaata hai.'),
      T('A reply arriving with TTL 119 almost certainly started at 128 — so the sender is nine hops away. You can count hops without running traceroute at all.',
        'TTL 119 wala jawaab lagbhag pakka 128 se chala tha — matlab bhejne wala nau hops door hai. Traceroute chalaye bina hops gine ja sakte hain.'),
    ],
    challenge: {
      ask: T('Corrupt one byte in the lab and read both checksums. Work out why a router discards the packet rather than trying to repair it.',
        'Lab me ek byte bigaado aur dono checksum padho. Socho ki router use theek karne ki jagah phenk kyun deta hai.'),
      run: 'tracert 1.1.1.1',
    },
    terms: ['TTL', 'IPv4', 'header', 'hop', 'router', 'payload'],
  },

  // ── IPv4 vs IPv6 ───────────────────────────────────────────────────────
  'ipv4-vs-ipv6': {
    title: T('IPv4 vs IPv6', 'IPv4 vs IPv6'),
    question: T(
      'Four billion addresses sounded limitless in 1981. What happened?',
      '1981 me chaar arab address anant lagte the. Hua kya?',
    ),
    beats: [
      {
        text: T(
          'They ran out. Not because four billion is a small number, but because\nthey were handed out in class-sized blocks and most of each block was wasted.',
          'Wo khatam ho gaye. Isliye nahi ki chaar arab kam hai, balki isliye ki wo class ke naap ke\nblocks me baante gaye the aur har block ka zyadatar hissa barbaad hua.',
        ),
      },
      {
        text: T(
          'IPv6 is not IPv4 with more digits. The address is four times longer, and\nseveral things were tidied up on the way — the header checksum is simply gone.',
          'IPv6 sirf lambe IPv4 nahi hai. Address chaar guna lamba hai, aur raaste me kuch cheezein\nsudhaar bhi di gayin — header checksum to hai hi nahi.',
        ),
        art: [
          '  IPv4   140.82.113.4                        32 bits',
          '  IPv6   2a03:2880:f312:1:face:b00c:0:25de   128 bits',
        ].join('\n'),
      },
      {
        text: T(
          'Adoption took thirty years because nothing forced it. NAT worked well\nenough to keep IPv4 usable, and a workaround that works is hard to replace.',
          'Ise apnane me tees saal lage kyunki majboori kabhi bani hi nahi. NAT itna kaam kar gaya ki\nIPv4 chalta raha, aur jo jugaad chal jaaye use hataana mushkil hota hai.',
        ),
      },
    ],
    hook: T(
      'Both records live in DNS side by side. Ask for each and see which one a site actually publishes.',
      'Dono records DNS me saath-saath rehte hain. Dono maango aur dekho site sach me kaunsa publish karti hai.',
    ),
    lab: 'compare',
    labSay: T(
      'The full comparison, including the fields IPv6 removed and why.',
      'Poora comparison, un fields samet jo IPv6 ne hataye aur kyun hataye.',
    ),
    steps: [
      {
        say: T('Ask a name for its IPv4 address.', 'Kisi naam ka IPv4 address maango.'),
        run: 'dig facebook.com',
        after: T(
          'An A record. This is the answer almost every lookup on the internet still returns.',
          'Ek A record. Internet pe aaj bhi lagbhag har lookup yahi jawaab deta hai.',
        ),
      },
      {
        say: T('Now ask the same name for IPv6.', 'Ab usi naam ka IPv6 maango.'),
        run: 'dig facebook.com AAAA',
        after: T(
          'One field changed in the question and a different kind of address came back. Read it closely — this one contains a word.',
          'Sawaal me ek field badla aur alag kism ka address aa gaya. Dhyan se padho — isme ek shabd chhupa hai.',
        ),
      },
      {
        say: T('Now try a name that may not publish one at all.', 'Ab aisa naam try karo jo shaayad publish karta hi na ho.'),
        run: 'dig github.com AAAA',
        after: T(
          'If nothing comes back, that is not an error. The name exists and the record does not — which is exactly how much of the internet still is.',
          'Agar kuch nahi aaya to ye error nahi hai. Naam maujood hai, record nahi — aur internet ka bada hissa aaj bhi aisa hi hai.',
        ),
      },
    ],
    points: [
      T('IPv6 addresses compress: leading zeros are dropped and one run of zero groups collapses to "::". Only one run, or the address would be ambiguous.',
        'IPv6 address sikudte hain: shuru ke zero hat jaate hain aur zero groups ki ek ladi "::" ban jaati hai. Sirf ek ladi, warna address ka matlab do ho jaata.'),
      T('There is no NAT in IPv6 because there is no shortage to work around. Every device can have a globally routable address again.',
        'IPv6 me NAT nahi hai kyunki bachne laayak koi kami hi nahi. Har device ko phir se globally routable address mil sakta hai.'),
      T('Both protocols run side by side on most networks. Your machine probably has an address of each kind and picks between them per connection.',
        'Zyadatar networks pe dono protocol saath chalte hain. Tumhari machine ke paas shaayad dono kism ke address hain aur wo har connection pe chunti hai.'),
    ],
    challenge: {
      ask: T('Find a well-known site that publishes no AAAA record. What does it cost them, and what does it cost a user who only has IPv6?',
        'Koi mashhoor site dhoondho jo AAAA record publish nahi karti. Iski keemat unhe kya padti hai, aur us user ko kya jiske paas sirf IPv6 hai?'),
      run: 'dig facebook.com AAAA',
    },
    terms: ['IPv4', 'IPv6', 'A record', 'AAAA record', 'NAT', 'DNS', 'header'],
  },

  // ── public and private ─────────────────────────────────────────────────
  'public-private': {
    title: T('Public and private addresses', 'Public aur private addresses'),
    question: T(
      'Your address probably starts with 192.168. So does your neighbour’s. How does that work?',
      'Tumhara address shaayad 192.168 se shuru hota hai. Padosi ka bhi. Ye chalta kaise hai?',
    ),
    beats: [
      {
        text: T(
          'Three ranges are reserved for use inside a network only. No router on the\npublic internet will forward them, so millions of homes reuse the same ones.',
          'Teen ranges sirf network ke andar use ke liye reserved hain. Public internet ka koi router\nunhe aage nahi bhejta, isliye laakhon ghar wahi ke wahi use karte hain.',
        ),
        art: [
          '  10.0.0.0/8        16 million    big organisations',
          '  172.16.0.0/12      1 million    medium ones',
          '  192.168.0.0/16    65 thousand   your house',
        ].join('\n'),
      },
      {
        text: T(
          'Your router does the translation. On the way out it rewrites your private\naddress to its one public address and remembers how to undo it.',
          'Anuvaad tumhara router karta hai. Bahar jaate waqt wo tumhara private address apne ek\npublic address me badal deta hai aur ulta karna yaad rakhta hai.',
        ),
      },
      {
        text: T(
          'That is why an incoming connection needs setting up and an outgoing one\ndoes not. Nothing outside knows your address exists.',
          'Isiliye andar aane wale connection ke liye intezaam karna padta hai aur bahar jaane wale ke liye nahi.\nBahar kisi ko pata hi nahi ki tumhara address hai bhi.',
        ),
      },
    ],
    hook: T(
      'Check your own address against the ranges. The lab will tell you which side of that line you are on.',
      'Apne address ko in ranges se milao. Lab bata dega tum us line ke kis taraf ho.',
    ),
    lab: 'subnet',
    labSay: T(
      'Type your address, then a public one like 140.82.113.4, and compare what the lab says about each.',
      'Apna address likho, phir koi public jaise 140.82.113.4, aur dekho lab dono ke baare me kya kehta hai.',
    ),
    steps: [
      {
        say: T('Find out which address your machine is actually using.', 'Pata karo tumhari machine kaunsa address use kar rahi hai.'),
        run: 'ifconfig',
        after: T(
          'If it starts with 10, 172.16-31 or 192.168 then it is private, and it has never been seen by anything outside your building.',
          'Agar ye 10, 172.16-31 ya 192.168 se shuru hota hai to private hai, aur tumhari building ke bahar ise kabhi kisi ne dekha hi nahi.',
        ),
      },
    ],
    points: [
      T('127.0.0.1 is not private, it is loopback — a packet sent there never reaches the network card at all.',
        '127.0.0.1 private nahi, loopback hai — wahan bheja packet network card tak pahunchta hi nahi.'),
      T('169.254.x.x is what a machine gives itself when DHCP fails. Seeing it means nothing handed you an address.',
        '169.254.x.x wo hai jo machine khud ko deti hai jab DHCP fail ho jaaye. Ye dikhe to matlab tumhe address kisi ne diya hi nahi.'),
      T('NAT was a workaround for address exhaustion and became a de facto firewall. Its security value is a side effect, not a design.',
        'NAT address khatam hone ka jugaad tha aur firewall ban gaya. Uski suraksha ek side effect hai, design nahi.'),
      T('Carrier-grade NAT puts a second layer of translation at the ISP, which is why some connections cannot be opened even with a router configured.',
        'Carrier-grade NAT ISP pe anuvaad ki doosri parat lagata hai, isiliye router set karne ke baad bhi kuch connections nahi khulte.'),
    ],
    challenge: {
      ask: T('Your machine and a machine in another house can both be 192.168.1.5. Explain why a packet you send never reaches the wrong one.',
        'Tumhari machine aur kisi doosre ghar ki machine, dono 192.168.1.5 ho sakti hain. Batao tumhara packet galat wali tak kabhi kyun nahi pahunchta.'),
      run: 'ifconfig',
    },
    terms: ['private IP', 'NAT', 'IP address', 'gateway', 'router'],
  },

  // ── routing ────────────────────────────────────────────────────────────
  routing: {
    title: T('Routing', 'Routing'),
    question: T(
      'Nobody knows the whole path. So how does a packet ever arrive?',
      'Poora raasta kisi ko nahi pata. To packet pahunchta kaise hai?',
    ),
    beats: [
      {
        text: T(
          'Every router knows one thing: for this destination, who is next.\nNothing more. The path is a chain of local decisions, made independently.',
          'Har router ek hi cheez jaanta hai: is destination ke liye agla kaun.\nBas. Raasta alag-alag jagah liye gaye local faislon ki ek ladi hai.',
        ),
        art: [
          '  you    -> "not my network, ask my router"',
          '  router -> "not mine either, ask my ISP"',
          '  ISP    -> "I know that block, this way"',
        ].join('\n'),
      },
      {
        text: T(
          'When two entries match, the more specific one wins. A route to a small\nblock beats a route to a large one containing it.',
          'Jab do entry match karein, jo zyada khaas ho wo jeetti hai. Chhote block ka raasta\nuse rakhne wale bade block ke raaste se aage nikal jaata hai.',
        ),
      },
      {
        text: T(
          'The tables themselves are built by protocols that gossip. Routers tell\ntheir neighbours what they can reach, and the map assembles itself.',
          'Ye tables khud aise protocols banate hain jo aapas me khabar baantte hain. Router apne padosiyon ko\nbatate hain wo kahan tak pahunch sakte hain, aur map khud ban jaata hai.',
        ),
      },
    ],
    hook: T(
      'You can watch those independent decisions happen, one hop at a time, on a real path right now.',
      'Un alag-alag faislon ko tum abhi ek asli raaste pe, ek-ek hop karke hote dekh sakte ho.',
    ),
    steps: [
      {
        say: T('Start with the only routing decision your own machine makes.', 'Us akele routing faisle se shuru karo jo tumhari apni machine leti hai.'),
        run: 'route',
        after: T(
          'Two kinds of line: the networks it can reach directly, and the default for everything else. Longest match decides between them.',
          'Do kism ki line: wo networks jinse seedha baat ho sakti hai, aur baaki sab ke liye default. Longest match unme se chunta hai.',
        ),
      },
      {
        say: T('Now watch every router along a path make the same decision.', 'Ab dekho raaste ka har router wahi faisla leta hai.'),
        run: 'tracert example.com',
        after: T(
          'Each line is one router that looked up your destination, found a next hop, and forwarded. Note where the latency jumps — that step is distance, not congestion.',
          'Har line ek router hai jisne tumhara destination dhoondha, agla hop paaya, aur aage bhej diya. Dekho latency kahan chhalaang lagati hai — wo step doori hai, bheed nahi.',
        ),
      },
      {
        say: T('Some routers will not answer. Trace something else and compare.', 'Kuch routers jawaab nahi denge. Kuch aur trace karo aur milaao.'),
        run: 'tracert 8.8.8.8',
        after: T(
          'A hop showing nothing still forwarded your packet — it simply chose not to reply. Silence is a policy, not a failure.',
          'Jis hop pe kuch nahi dikha usne bhi packet aage bheja — bas jawaab na dene ka faisla kiya. Chuppi ek policy hai, kharabi nahi.',
        ),
      },
    ],
    points: [
      T('Longest prefix match is the whole forwarding algorithm. A /32 beats a /24 beats a /8 beats the default route.',
        'Longest prefix match hi poora forwarding algorithm hai. /32 /24 se jeetta hai, /24 /8 se, aur /8 default route se.'),
      T('Interior protocols like OSPF find the best path inside one organisation. BGP decides between organisations, and its choices are as much commercial as technical.',
        'OSPF jaise interior protocols ek sanstha ke andar sabse achha raasta dhoondhte hain. BGP sansthaon ke beech tay karta hai, aur uske faisle jitne technical hain utne hi vyaparik.'),
      T('Routing is what your packet follows; forwarding is the act of one router passing it on. The first builds the table, the second reads it.',
        'Routing wo hai jise tumhara packet follow karta hai; forwarding ek router ka use aage badhana hai. Pehla table banata hai, doosra use padhta hai.'),
      T('A loop is possible while tables disagree, and the TTL is what stops it mattering. Convergence is the word for the tables agreeing again.',
        'Jab tak tables ek raay nahi hote, loop mumkin hai, aur TTL use bemaani bana deta hai. Tables ka phir se ek raay hona hi convergence kehlata hai.'),
    ],
    challenge: {
      ask: T('Trace two different destinations and find the hop where the paths stop being the same. What does that machine represent?',
        'Do alag destinations trace karo aur wo hop dhoondho jahan raaste alag hona shuru hote hain. Wo machine kya darshati hai?'),
      run: 'tracert example.com',
    },
    terms: ['routing table', 'router', 'default route', 'hop', 'TTL', 'latency', 'ISP', 'IX'],
  },
}
