/**
 * application.js — the Application module.
 *
 * The opposite of Data Link. Almost none of this needs simulating: DNS, mail
 * routing, HTTP and CDNs are all observable from an ordinary process, so every
 * topic here is driven by real commands against the live internet rather than
 * by a lab.
 *
 * It is also the part of the syllabus most often taught as a list of port
 * numbers. The CDN topic in particular is a measurement, not a definition —
 * you ask three resolvers for one name and then count the hops to whatever
 * they answer, which is what proves the copy you were sent to is the near one.
 *
 * That topic is careful about what it promises. Resolvers often return the
 * same address, because all three of the public ones are close by anyway, so
 * the lesson rests on the hop count rather than on the addresses differing.
 */

const T = (en, hi) => ({ en, hi })

export default {
  // ── the layer ──────────────────────────────────────────────────────────
  'application-layer': {
    title: T('The application layer', 'Application layer'),
    question: T(
      'Everything underneath just moves bytes. So who decides what the bytes mean?',
      'Neeche sab kuch sirf bytes hilata hai. To bytes ka matlab kaun tay karta hai?',
    ),
    beats: [
      {
        text: T(
          'Layer 4 delivers a stream of bytes to the right program and stops there.\nIt has no opinion about what they say.',
          'Layer 4 bytes ki dhaar sahi program tak pahunchati hai aur wahin ruk jaati hai.\nUnme likha kya hai, isse uska koi lena-dena nahi.',
        ),
        art: [
          '  TCP delivers:  47 45 54 20 2f 20 48 54 54 50 2f 31 2e 31',
          '  HTTP reads:    G  E  T     /     H  T  T  P  /  1  .  1',
          '  same bytes, and only the top layer knows they are a request',
        ].join('\n'),
      },
      {
        text: T(
          'The application layer is the agreement about meaning. GET means fetch,\nMX means mail server, 200 means it worked.',
          'Application layer matlab ka samjhauta hai. GET matlab laao,\nMX matlab mail server, 200 matlab ho gaya.',
        ),
      },
      {
        text: T(
          'That is why it is the easiest layer to watch. There is nothing hidden in\nthe kernel here — the protocol is text you can read and type.',
          'Isliye ye sabse aasan layer hai dekhne ke liye. Yahan kernel me kuch chhupa nahi —\nprotocol aisi text hai jo tum padh bhi sakte ho aur likh bhi.',
        ),
      },
    ],
    hook: T(
      'Every command in this app is an application-layer protocol, written by hand. Here is one, from the first byte.',
      'Is app ki har command ek application-layer protocol hai, haath se likhi hui. Ye rahi ek, pehle byte se.',
    ),
    steps: [
      {
        say: T('Watch a request go out as literal characters.', 'Request ko akshar-dar-akshar jaate dekho.'),
        run: 'curl https://example.com',
        after: T(
          'The bytes we sent are the text you can read in the terminal. No encoding, no framing of our own — the layers below handled all of that.',
          'Jo bytes humne bheje wahi text terminal me padhi ja sakti hai. Na encoding, na apni koi framing — wo sab neeche wali layers ne sambhala.',
        ),
      },
      {
        say: T('Now a completely different application protocol, over a different transport.', 'Ab bilkul alag application protocol, alag transport pe.'),
        run: 'dig example.com',
        after: T(
          'DNS is binary and HTTP is text; DNS rides UDP and HTTP rides TCP. Same layer, opposite choices — the layer names a job, not a style.',
          'DNS binary hai aur HTTP text; DNS UDP pe chalta hai aur HTTP TCP pe. Ek hi layer, ulte faisle — layer kaam ka naam hai, tareeke ka nahi.',
        ),
      },
    ],
    points: [
      T('A port number is how the transport layer picks which application protocol to hand the bytes to. 53 means DNS, 443 means HTTPS.',
        'Port number se transport layer tay karti hai bytes kis application protocol ko dene hain. 53 matlab DNS, 443 matlab HTTPS.'),
      T('Nothing enforces this. A web server can listen on port 22 — the numbers are a convention so that strangers can find each other.',
        'Isko koi zabardasti nahi karwata. Web server port 22 pe bhi baith sakta hai — ye number bas convention hain taaki ajnabi ek doosre ko dhoondh sakein.'),
      T('OSI puts session and presentation below this layer. In practice an application protocol does those jobs itself, or skips them.',
        'OSI is layer ke neeche session aur presentation rakhta hai. Practice me application protocol ye kaam khud kar leta hai, ya karta hi nahi.'),
    ],
    challenge: {
      ask: T('Run both commands above and compare the byte counts. Why is the text protocol so much larger than the binary one for the same amount of meaning?',
        'Upar ki dono commands chalao aur bytes gino. Utni hi baat kehne ke liye text protocol binary se itna bada kyun hai?'),
      run: 'dig example.com',
    },
    terms: ['protocol', 'port', 'HTTP', 'DNS', 'layer', 'ASCII'],
  },

  // ── client and server ──────────────────────────────────────────────────
  'client-server': {
    title: T('Client and server', 'Client aur server'),
    question: T(
      'Two machines, both with addresses. Which one starts the conversation?',
      'Do machines, dono ke paas address. Baat shuru kaun karta hai?',
    ),
    beats: [
      {
        text: T(
          'The difference is not the hardware. A server is simply the one that was\nalready listening; a client is the one that dialled.',
          'Farak hardware ka nahi hai. Server bas wo hai jo pehle se sun raha tha;\nclient wo hai jisne dial kiya.',
        ),
        art: [
          '  server   listening on :443, forever, doing nothing',
          '  client   picks a fresh high port, connects, asks, leaves',
        ].join('\n'),
      },
      {
        text: T(
          'That asymmetry is why the server needs a fixed, known port and the client\ndoes not. You have to know where to knock.',
          'Isi asymmetry ki wajah se server ko fix, jaana-pehchana port chahiye aur client ko nahi.\nDastak kahan deni hai, ye pata hona zaroori hai.',
        ),
      },
      {
        text: T(
          'Your machine is doing both right now. It is a client to a hundred servers,\nand it is listening on a few ports of its own.',
          'Tumhari machine abhi dono hai. Sau servers ki client hai,\naur khud bhi kuch ports pe sun rahi hai.',
        ),
      },
    ],
    hook: T(
      'Every open connection on your machine has a client end and a server end. Here they all are.',
      'Tumhari machine ke har khule connection ka ek client sira hai aur ek server sira. Ye rahe sab.',
    ),
    steps: [
      {
        say: T('List every conversation your machine currently holds open.', 'Wo saari baatcheet dekho jo tumhari machine ne abhi khol rakhi hai.'),
        run: 'netstat',
        after: T(
          'Read the port numbers. The low, familiar ones are servers you dialled; the high random ones are your own end of each call.',
          'Port numbers padho. Chhote, jaane-pehchane number wo servers hain jinhe tumne dial kiya; bade random number har call ka tumhara apna sira hain.',
        ),
      },
      {
        say: T('Now be a client on purpose, and watch a fresh port get picked.', 'Ab jaan boojh kar client bano, aur naya port chuna jaate dekho.'),
        run: 'curl https://example.com',
        after: T(
          'Your OS chose that local port a millisecond ago. Run it again and it will choose a different one — the server end never moves.',
          'Wo local port tumhare OS ne ek millisecond pehle chuna. Dobara chalao to doosra chunega — server wala sira kabhi nahi hilta.',
        ),
      },
    ],
    points: [
      T('A connection is identified by four things: both addresses and both ports. Change any one and it is a different connection.',
        'Ek connection chaar cheezon se pehchana jaata hai: dono address aur dono port. Koi ek badlo, connection alag ho jaata hai.'),
      T('This is why one server can hold thousands of connections on port 443 at once — the client side of each pair is different.',
        'Isiliye ek server port 443 pe hazaaron connections ek saath rakh sakta hai — har jodi ka client wala hissa alag hota hai.'),
      T('Peer-to-peer does not abolish the roles. Both sides simply take turns being the one that listened.',
        'Peer-to-peer se ye roles khatam nahi hote. Bas dono taraf bari-bari se sunne wala banti hai.'),
    ],
    challenge: {
      ask: T('Run curl twice and note both local port numbers. What would break if your OS reused the same one immediately?',
        'curl do baar chalao aur dono local port note karo. Agar OS turant wahi port dobara use kar leta to kya toot jaata?'),
      run: 'netstat',
    },
    terms: ['port', 'socket', 'ephemeral port', 'TCP'],
  },

  // ── DNS ────────────────────────────────────────────────────────────────
  dns: {
    title: T('DNS', 'DNS'),
    question: T(
      'Chapter 2 showed one lookup. But who actually knows the answer?',
      'Chapter 2 me ek lookup dekha. Par jawaab asal me kiske paas hai?',
    ),
    beats: [
      {
        text: T(
          'No single machine holds the phonebook. It is split into zones, and each\nzone has servers that are authoritative for their part and nothing else.',
          'Poori phonebook kisi ek machine ke paas nahi hai. Wo zones me bati hai, aur har zone ke\napne servers hain jo sirf apne hisse ke liye authoritative hain, aur kisi ke liye nahi.',
        ),
        art: [
          '  .            root servers    "ask the com servers"',
          '  com          TLD servers     "ask github com servers"',
          '  github.com   authoritative   "140.82.113.4"',
        ].join('\n'),
      },
      {
        text: T(
          'Your resolver walks that chain on your behalf, then keeps the answer for\nas long as the owner allowed. That allowance is the TTL.',
          'Tumhara resolver ye poori chain tumhare liye chalta hai, phir jawaab utni der rakhta hai\njitni maalik ne ijazat di. Wahi ijazat TTL hai.',
        ),
      },
      {
        text: T(
          'So most lookups never leave your ISP. You are usually reading a cached\nanswer that somebody else paid for.',
          'Isliye zyadatar lookups tumhare ISP se bahar jaate hi nahi. Tum aksar wo cached jawaab\npadh rahe hote ho jiski keemat kisi aur ne chukayi thi.',
        ),
      },
    ],
    hook: T(
      'Ask two different resolvers the same question and the TTL will differ — that difference is how long ago somebody else asked.',
      'Do alag resolvers se wahi sawaal poochho aur TTL alag hogi — wahi farak batata hai kisi aur ne kitni der pehle poocha tha.',
    ),
    steps: [
      {
        say: T('Ask one resolver, and note the TTL on the answer.', 'Ek resolver se poochho, aur jawaab pe TTL note karo.'),
        run: 'dig @1.1.1.1 example.com',
        after: T(
          'That TTL is a countdown, not a constant. It is what remains of the owner’s allowance at this particular resolver.',
          'Ye TTL ulti ginti hai, koi fix number nahi. Ye is khaas resolver pe maalik ki di hui ijazat ka bacha hua hissa hai.',
        ),
      },
      {
        say: T('Now ask a different one, and compare.', 'Ab doosre se poochho, aur milaao.'),
        run: 'dig @8.8.8.8 example.com',
        after: T(
          'Same name, same address, different TTL. Each resolver is counting down from whenever it last asked — you are seeing two independent caches.',
          'Wahi naam, wahi address, alag TTL. Har resolver apne aakhri sawaal se ginti kar raha hai — tum do alag caches dekh rahe ho.',
        ),
      },
      {
        say: T('Ask who actually owns the zone, rather than who remembers it.', 'Poochho ki zone ka asli maalik kaun hai, yaad kisne rakha ye nahi.'),
        run: 'dig example.com NS',
        after: T(
          'These are the authoritative servers. Everything else on the internet is repeating what they said.',
          'Ye authoritative servers hain. Internet pe baaki sab bas inhi ki baat dohra rahe hain.',
        ),
      },
    ],
    points: [
      T('Recursive means "you go and find out"; iterative means "tell me who to ask next". Your resolver does the recursion, the root and TLD servers only ever do iteration.',
        'Recursive matlab "tum jaake pata karo"; iterative matlab "batao aage kisse poochhun". Recursion tumhara resolver karta hai, root aur TLD servers sirf iteration karte hain.'),
      T('A short TTL buys agility and costs traffic. Sites about to move their servers cut it to minutes days in advance.',
        'Chhoti TTL phurti deti hai aur traffic kharch karti hai. Jo sites server badalne wali hoti hain, wo kai din pehle use minute me le aati hain.'),
      T('Nothing about DNS is encrypted by default. Your resolver sees every name you look up, which is what DoH and DoT exist to change.',
        'DNS me default se kuch encrypted nahi hota. Tumhara resolver har naam dekhta hai jo tum dhoondhte ho — DoH aur DoT isi ko badalne ke liye hain.'),
      T('The transaction ID and the source port are the only thing stopping a forged answer. That is thin, and it is why DNSSEC was written.',
        'Fake jawaab rokne ke liye sirf transaction ID aur source port hain. Ye patla bachaav hai, aur isiliye DNSSEC likha gaya.'),
    ],
    challenge: {
      ask: T('Ask the same name twice in a row at one resolver. Explain why the second TTL is lower, and what it will do when it reaches zero.',
        'Ek hi resolver pe wahi naam do baar poochho. Batao doosri TTL kam kyun hai, aur zero pe pahunchne pe kya hoga.'),
      run: 'dig @1.1.1.1 example.com',
    },
    terms: ['DNS', 'resolver', 'TTL', 'NS record', 'A record', 'cache', 'ISP'],
  },

  // ── the web ────────────────────────────────────────────────────────────
  'www-http': {
    title: T('The web and HTTP', 'Web aur HTTP'),
    question: T(
      'The web is one application of the internet. What exactly makes it the web?',
      'Web internet ka ek istemaal hai. Par use web banata kya hai?',
    ),
    beats: [
      {
        text: T(
          'Three ideas, and nothing else. A way to name a thing (the URL), a way to\nask for it (HTTP), and a way to write it down (HTML).',
          'Teen ideas, aur kuch nahi. Cheez ko naam dene ka tareeka (URL), use maangne ka\ntareeka (HTTP), aur use likhne ka tareeka (HTML).',
        ),
        art: [
          '  https://example.com/about',
          '  ^^^^^   ^^^^^^^^^^^ ^^^^^^',
          '  how     who         what',
        ].join('\n'),
      },
      {
        text: T(
          'HTTP is stateless on purpose. Every request stands alone and the server\nis allowed to forget you the moment it answers.',
          'HTTP jaan boojh kar stateless hai. Har request akeli khadi hoti hai aur server ko\njawaab dete hi tumhe bhool jaane ki chhoot hai.',
        ),
      },
      {
        text: T(
          'Everything that feels like memory — logins, carts, sessions — is built on\ntop of that forgetting, with cookies and headers.',
          'Jo kuch bhi yaad rakha hua lagta hai — login, cart, session — wo isi bhoolne ke\nupar bana hai, cookies aur headers ki madad se.',
        ),
      },
    ],
    hook: T(
      'You can hold an entire HTTP conversation by typing. It is the only layer where that is true.',
      'Poori HTTP baatcheet tum type karke kar sakte ho. Ye ekmatra layer hai jahan ye mumkin hai.',
    ),
    steps: [
      {
        say: T('Ask for a page and read exactly what was sent.', 'Ek page maango aur padho ki bheja kya gaya tha.'),
        run: 'curl https://example.com',
        after: T(
          'A request line, some headers, a blank line. The blank line is the entire framing rule of HTTP/1.1 — it means "I have finished asking".',
          'Ek request line, kuch headers, ek khaali line. Wahi khaali line HTTP/1.1 ka poora framing niyam hai — matlab "maine poochhna khatam kiya".',
        ),
      },
      {
        say: T('Ask for the headers only, and compare the cost.', 'Sirf headers maango, aur keemat compare karo.'),
        run: 'curl https://example.com --head',
        after: T(
          'Nearly the same request, a fraction of the reply. The setup cost was paid either way — which is the entire argument for keep-alive.',
          'Request lagbhag utni hi, jawaab uska chhota sa hissa. Setup ki keemat dono baar chukani padi — yahi keep-alive ka poora tark hai.',
        ),
      },
      {
        say: T('Now reuse one connection instead of opening a second.', 'Ab doosra connection kholne ki jagah ek hi dobara use karo.'),
        run: 'curl https://example.com --keep-alive',
        after: T(
          'The second request skipped DNS, TCP and the whole TLS handshake. Nothing was optimised — something was simply not thrown away.',
          'Doosri request ne DNS, TCP aur poora TLS handshake chhod diya. Kuch optimise nahi hua — bas kuch phenka nahi gaya.',
        ),
      },
    ],
    points: [
      T('The Host header is why one server can hold thousands of sites — the same job SNI does one layer down, and for the same reason.',
        'Host header ki wajah se ek server hazaaron sites rakh sakta hai — wahi kaam ek layer neeche SNI karta hai, aur usi wajah se.'),
      T('Status codes are a conversation, not just errors. 301 moved, 304 "you already have it", 404 the server is fine and the page is not.',
        'Status codes baatcheet hain, sirf errors nahi. 301 shift ho gaya, 304 "tumhare paas already hai", 404 server theek hai aur page nahi.'),
      T('HTTP/2 and HTTP/3 changed the framing, not the meaning. GET still means GET; only the way it is packed on the wire is different.',
        'HTTP/2 aur HTTP/3 ne framing badli, matlab nahi. GET ab bhi GET hi hai; sirf wire pe packing ka tareeka alag hai.'),
    ],
    challenge: {
      ask: T('Get a server to answer 304 Not Modified. Which header did you have to send, and what does the server compare it against?',
        'Kisi server se 304 Not Modified kehlwao. Kaunsa header bhejna pada, aur server use kis se milaata hai?'),
      run: 'curl https://example.com --head',
    },
    terms: ['HTTP', 'header', 'status code', 'Host header', 'keep-alive', '304 Not Modified', 'SNI'],
  },

  // ── email ──────────────────────────────────────────────────────────────
  email: {
    title: T('Electronic mail', 'Electronic mail'),
    question: T(
      'The web needs the server to be up when you ask. Mail does not. How?',
      'Web ke liye server ka chaalu hona zaroori hai jab tum poochho. Mail ke liye nahi. Kaise?',
    ),
    beats: [
      {
        text: T(
          'Mail is store-and-forward. Your message is handed to a server that accepts\nresponsibility for it, and it is that server’s problem now.',
          'Mail store-and-forward hai. Tumhara message ek server ko diya jaata hai jo uski\nzimmedari le leta hai, aur ab wo usi server ki museebat hai.',
        ),
        art: [
          '  you -> your mail server -> ... -> their mail server -> them',
          '         SMTP                SMTP                        IMAP',
          '         push it along                       they pull it down',
        ].join('\n'),
      },
      {
        text: T(
          'So the recipient can be offline for a week. Nobody is waiting on a\nconnection; the message is queued at each hop until the next one accepts it.',
          'Isliye paane wala hafte bhar offline reh sakta hai. Koi connection pe intezaar nahi kar raha;\nmessage har hop pe queue me rehta hai jab tak agla use na le le.',
        ),
      },
      {
        text: T(
          'Finding the right server is a DNS question, and it has its own record\ntype — because the mail server for a domain is rarely the web server.',
          'Sahi server dhoondhna DNS ka sawaal hai, aur uska apna record type hai —\nkyunki domain ka mail server shaayad hi kabhi web server hota hai.',
        ),
      },
    ],
    hook: T(
      'Ask any domain where its mail goes and it will tell you, with the servers ranked in the order to try them.',
      'Kisi bhi domain se poochho uski mail kahan jaati hai, wo bata dega — servers ke saath, kis kram me try karna hai wo bhi.',
    ),
    steps: [
      {
        say: T('Ask a large domain where its mail is accepted.', 'Kisi bade domain se poochho uski mail kahan li jaati hai.'),
        run: 'dig gmail.com MX',
        after: T(
          'Each answer has a preference number. Lower is tried first — the higher ones are the fallbacks, and they exist because mail must not be lost.',
          'Har jawaab ke saath ek preference number hai. Chhota pehle try hota hai — bade wale backup hain, aur wo isliye hain kyunki mail kho nahi sakti.',
        ),
      },
      {
        say: T('Now compare that with where its website lives.', 'Ab dekho uski website kahan rehti hai.'),
        run: 'dig gmail.com',
        after: T(
          'Different machines entirely. One domain, two services, two completely separate sets of servers — which is exactly why MX exists as its own record.',
          'Bilkul alag machines. Ek domain, do services, servers ke do poori tarah alag set — aur isiliye MX apna alag record hai.',
        ),
      },
    ],
    points: [
      T('SMTP pushes mail towards the recipient; IMAP and POP3 pull it down to a device. They are different protocols for different directions.',
        'SMTP mail ko paane wale ki taraf dhakelta hai; IMAP aur POP3 use device pe kheenchte hain. Alag disha, alag protocol.'),
      T('The From address is not verified by SMTP itself. SPF, DKIM and DMARC are all DNS records bolted on afterwards to fix that.',
        'From address ko SMTP khud verify nahi karta. SPF, DKIM aur DMARC — teeno DNS records hain jo baad me isi ko theek karne ke liye jode gaye.'),
      T('MIME is what lets a plain-text protocol carry an image. The attachment is encoded into printable characters and decoded at the far end.',
        'MIME ki wajah se plain-text protocol image le jaa paata hai. Attachment ko printable characters me badla jaata hai aur doosre sire pe wapas khola.'),
      T('Store-and-forward is why mail is slow to fail. A web request errors in seconds; a mail can bounce three days later.',
        'Store-and-forward ki wajah se mail dheere fail hoti hai. Web request seconds me error deti hai; mail teen din baad bounce ho sakti hai.'),
    ],
    challenge: {
      ask: T('Find a domain whose mail is handled by a different company than its website. What does that tell you about who reads their mail?',
        'Aisa domain dhoondho jiski mail koi aur company sambhalti hai aur website koi aur. Isse kya pata chalta hai ki unki mail kaun padhta hai?'),
      run: 'dig gmail.com MX',
    },
    terms: ['MX record', 'DNS', 'protocol', 'ASCII'],
  },

  // ── CDN ────────────────────────────────────────────────────────────────
  cdn: {
    title: T('Content delivery networks', 'Content delivery networks'),
    question: T(
      'The server is in another country. So why does the site load instantly?',
      'Server doosre desh me hai. To site turant kaise khul jaati hai?',
    ),
    beats: [
      {
        text: T(
          'Distance is not a software problem. Light in fibre takes about 5 ms per\n1000 km, and no amount of faster hardware changes that.',
          'Doori software ki samasya nahi hai. Fibre me roshni 1000 km me lagbhag 5 ms leti hai,\naur kitna bhi tez hardware ise nahi badal sakta.',
        ),
      },
      {
        text: T(
          'So the answer is not to go faster. It is to not go as far: keep a copy of\nthe content in every major city and hand people the nearest one.',
          'To hal tez jaana nahi hai. Hal itna door na jaana hai: content ki ek copy har bade\nsheher me rakho aur logon ko sabse paas wali do.',
        ),
        art: [
          '  without a CDN   you --------- 12,000 km --------> one server',
          '  with a CDN      you -- 40 km --> a copy in your city',
        ].join('\n'),
      },
      {
        text: T(
          'The trick is in the answer to the DNS question. Ask from Mumbai and you\nare told a Mumbai address; ask from Berlin and you are told a Berlin one.',
          'Jugaad DNS ke jawaab me hai. Mumbai se poochho to Mumbai ka address milta hai;\nBerlin se poochho to Berlin ka.',
        ),
      },
    ],
    hook: T(
      'This is not a definition you have to take on faith. Ask three resolvers the same name, then count the hops to whatever they tell you.',
      'Ye koi definition nahi jise maan lena pade. Teen resolvers se wahi naam poochho, phir jo bhi wo batayein uske hops gino.',
    ),
    steps: [
      {
        say: T('Ask three public resolvers for one CDN-hosted name.', 'Ek CDN wale naam ke liye teen public resolvers se poochho.'),
        run: 'resolvers medium.com',
        after: T(
          'Read the addresses, not the times. Differing addresses are a CDN steering each resolver to a nearby copy — but they often agree, because all three of these are themselves close to you. Either way the next step is the real proof.',
          'Addresses padho, time nahi. Alag addresses matlab CDN har resolver ko paas wali copy pe bhej raha hai — par aksar wo ek jaise bhi hote hain, kyunki ye teeno khud tumhare paas hain. Kuch bhi ho, asli saboot agla step hai.',
        ),
      },
      {
        say: T('Now count the hops to whatever address you were given.', 'Ab jo bhi address mila uske hops gino.'),
        run: 'tracert medium.com',
        after: T(
          'Count them, and watch where the latency stops climbing. A CDN sells exactly this number — the content is not on the far side of the world, it is a few hops away in a building near you.',
          'Gino, aur dekho latency kahan chadhna band karti hai. CDN yahi number bechta hai — content duniya ke doosre kone pe nahi, tumhare paas kisi building me chand hops door hai.',
        ),
      },
      {
        say: T('Now trace a second name and compare the two.', 'Ab doosra naam trace karo aur dono milaao.'),
        run: 'tracert example.com',
        after: T(
          'If this one is much longer, with the latency climbing in one big step, that step is a cable under an ocean and you have just measured the difference a CDN makes. If it is about the same length — which is the common result — that is the finding: this host is near you too, because almost everything popular now sits behind one.',
          'Agar ye kaafi lamba hai aur latency ek bade step me chadhti hai, to wo step samundar ke neeche ka cable hai aur tumne CDN ka farak naap liya. Aur agar dono lagbhag barabar hain — jo aam nateeja hai — to wahi khoj hai: ye host bhi tumhare paas hai, kyunki aaj lagbhag har mashhoor cheez CDN ke peeche hi baithi hai.',
        ),
      },
    ],
    points: [
      T('A CDN sells you two things: copies near the user, and a DNS answer that points at the right copy. The second is the harder half.',
        'CDN do cheezein bechta hai: user ke paas copies, aur aisa DNS jawaab jo sahi copy pe bhejta hai. Doosra hissa hi mushkil wala hai.'),
      T('Anycast does the same job at layer 3 instead: one address announced from many cities, and routing delivers you to the closest.',
        'Anycast yahi kaam layer 3 pe karta hai: ek hi address kai sheharon se announce hota hai, aur routing tumhe sabse paas wale tak pahuncha deta hai.'),
      T('This is why one IP can serve thousands of sites, and why the certificate you get back is chosen by the name in your SNI.',
        'Isiliye ek IP hazaaron sites chala sakta hai, aur isiliye jo certificate wapas aata hai wo tumhare SNI ke naam se chuna jaata hai.'),
      T('Cached copies go stale. Everything hard about running a CDN is deciding when a copy is allowed to be wrong, and for how long.',
        'Cached copies purani ho jaati hain. CDN chalane ki har mushkil isi me hai ki copy kab tak galat rehne di jaaye.'),
    ],
    challenge: {
      ask: T('Trace several sites you use every day and write down the hop counts. How many of them turn out to be far away, and what does that tell you about who is running the internet you actually touch?',
        'Roz istemaal hone wali kai sites trace karo aur hop counts likho. Unme se kitni sach me door nikleen, aur isse kya pata chalta hai ki jo internet tum chhoote ho use chala kaun raha hai?'),
      run: 'resolvers medium.com',
    },
    terms: ['CDN', 'DNS', 'resolver', 'latency', 'hop', 'traceroute', 'cache', 'SNI', 'IX'],
  },
}
