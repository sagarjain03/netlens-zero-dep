/**
 * glossary.js — plain-language meaning for every term the lessons use.
 *
 * The rule this file exists to enforce: no word appears on screen that the
 * learner cannot click. A beginner who hits "resolver" in the third sentence
 * and has to leave to look it up has already left.
 *
 * Keys are lowercase; `term` is how it is spelled back to the reader. Matching
 * is longest-key-first, so "subnet mask" wins over "mask" and "MAC address"
 * over "address". `see` links to the chapter where the thing is visible for
 * real, which is the one move a textbook cannot make.
 *
 * Definitions are one sentence wherever one sentence is honest. They explain
 * what the thing IS and why anybody bothered, never what it stands for alone —
 * an expansion is not an explanation.
 */

export const GLOSSARY = {
  // ── chapter 1 · your own network ────────────────────────────────────────
  'ip address': {
    term: 'IP address', see: 1,
    en: 'The number that identifies one machine on a network, the way a house number identifies one house on a street. Your computer has one right now.',
    hi: 'Wo number jo network pe ek machine ko pehchanta hai, jaise ghar ka number ek ghar ko. Tumhare computer ka bhi ek hai, abhi.',
  },
  'subnet mask': {
    term: 'subnet mask', see: 1,
    en: 'A pattern of bits that splits your IP into "which network" and "which machine on it". It is how your computer decides whether a destination is a neighbour or needs the router.',
    hi: 'Bits ka ek pattern jo tumhare IP ko do hisso me baantta hai: "kaunsa network" aur "us par kaunsi machine". Isi se computer tay karta hai ki destination padosi hai ya router chahiye.',
  },
  gateway: {
    term: 'gateway', see: 1,
    en: 'The machine your computer hands a packet to when the destination is not a neighbour. At home this is your router — the one door out.',
    hi: 'Wo machine jise tumhara computer packet deta hai jab destination padosi na ho. Ghar pe ye tumhara router hai — bahar jaane ka ek darwaza.',
  },
  'mac address': {
    term: 'MAC address', see: 1,
    en: 'A hardware address burned into a network card. Your IP changes every time you join a new network; this does not.',
    hi: 'Network card me fix kiya hua hardware address. IP har naye network pe badal jaata hai; ye nahi badalta.',
  },
  arp: {
    term: 'ARP', see: 1,
    en: 'How your computer asks "who on this network has this IP?" and remembers the answer. The ARP table is the list of neighbours it has actually spoken to.',
    hi: 'Isse tumhara computer poochta hai "is network pe ye IP kiske paas hai?" aur jawaab yaad rakhta hai. ARP table un padosiyon ki list hai jinse sach me baat hui.',
  },
  lan: {
    term: 'LAN', see: 1,
    en: 'The small network inside one building or home. Machines on it reach each other directly, without any router in between.',
    hi: 'Ek building ya ghar ke andar ka chhota network. Ispe machines bina kisi router ke seedha ek doosre tak pahunchti hain.',
  },
  oui: {
    term: 'OUI', see: 1,
    en: 'The first three bytes of a MAC address, which identify who made the hardware. a4:83:e7 is Apple.',
    hi: 'MAC address ke pehle teen bytes, jo batate hain hardware kisne banaya. a4:83:e7 Apple hai.',
  },
  'private ip': {
    term: 'private IP', see: 1,
    en: 'An address from a range reserved for use inside a network only. No router on the public internet will forward it, which is why millions of homes can all use 192.168.1.1.',
    hi: 'Aisa address jo sirf network ke andar use hone ke liye reserve hai. Public internet ka koi router ise aage nahi bhejta, isliye laakhon ghar 192.168.1.1 use kar sakte hain.',
  },
  nat: {
    term: 'NAT', see: 1,
    en: 'The trick your router uses to let many private addresses share one public one: it rewrites the addresses on the way out and remembers how to undo it on the way back.',
    hi: 'Router ki wo jugaad jisse kai private address ek public address share kar lete hain: jaate waqt address badal deta hai aur wapsi pe ulta karna yaad rakhta hai.',
  },

  // ── chapter 2 · names to numbers ────────────────────────────────────────
  dns: {
    term: 'DNS', see: 2,
    en: 'The internet\'s phonebook: you give it a name, it gives you back a number. Your computer does this before every page you open.',
    hi: 'Internet ki phonebook: naam do, number lo. Har page kholne se pehle tumhara computer yahi karta hai.',
  },
  resolver: {
    term: 'resolver', see: 2,
    en: 'The DNS server your computer actually asks. It does the chasing on your behalf and caches the answer for the next person.',
    hi: 'Wo DNS server jise tumhara computer sach me poochta hai. Wo tumhare liye jawaab dhoondhta hai aur agle bande ke liye cache kar leta hai.',
  },
  'a record': {
    term: 'A record', see: 2,
    en: 'The DNS entry that maps a name to an IPv4 address. This is the ordinary answer you get when you look up a website.',
    hi: 'Wo DNS entry jo naam ko IPv4 address se jodti hai. Website dhoondhne pe yahi normal jawaab milta hai.',
  },
  'aaaa record': {
    term: 'AAAA record', see: 2,
    en: 'The same idea as an A record, but for an IPv6 address. Four A\'s because an IPv6 address is four times longer.',
    hi: 'A record jaisa hi, par IPv6 address ke liye. Chaar A isliye kyunki IPv6 address chaar guna lamba hota hai.',
  },
  cname: {
    term: 'CNAME', see: 2,
    en: 'A DNS answer that says "this name is a nickname for that name, go ask about that one instead".',
    hi: 'Aisa DNS jawaab jo kehta hai "ye naam us naam ka nickname hai, us wale ke baare me poochho".',
  },
  mx: {
    term: 'MX record', see: 2,
    en: 'The DNS entry that names the mail servers for a domain, with numbers saying which to try first.',
    hi: 'Wo DNS entry jo domain ke mail servers batati hai, saath me number ki pehle kis ko try karna hai.',
  },
  ns: {
    term: 'NS record', see: 2,
    en: 'The DNS entry naming the servers that actually own a domain and answer for it authoritatively.',
    hi: 'Wo DNS entry jo un servers ka naam deti hai jo domain ke asli maalik hain aur uske liye jawaab dete hain.',
  },
  nxdomain: {
    term: 'NXDOMAIN', see: 2,
    en: 'A real DNS answer meaning "there is no such name". Not an error and not silence — a definite no.',
    hi: 'Ek asli DNS jawaab jiska matlab hai "aisa naam hai hi nahi". Na error, na chuppi — pakka inkaar.',
  },
  qtype: {
    term: 'QTYPE', see: 2,
    en: 'The field in a DNS question saying what kind of answer you want: an IPv4 address, an IPv6 one, mail servers, and so on.',
    hi: 'DNS sawaal ka wo field jo batata hai kis kism ka jawaab chahiye: IPv4 address, IPv6, mail servers, waghera.',
  },
  qname: {
    term: 'QNAME', see: 2,
    en: 'The name being asked about, written on the wire as length-prefixed labels rather than as a dotted string.',
    hi: 'Jis naam ke baare me poocha ja raha hai. Wire pe ye dotted string nahi, length-prefixed labels me likha jaata hai.',
  },
  'transaction id': {
    term: 'transaction ID', see: 2,
    en: 'A random number tying one DNS question to its answer. A reply carrying a different one is thrown away — that is what stops forged answers.',
    hi: 'Ek random number jo DNS sawaal aur uske jawaab ko jodta hai. Alag number wala reply phenk diya jaata hai — isi se fake jawaab rukte hain.',
  },
  ttl: {
    term: 'TTL', see: 3,
    en: 'A countdown. In DNS it is how long an answer may be cached; in a packet it is how many routers it may pass before being thrown away.',
    hi: 'Ek ulti ginti. DNS me ye batata hai jawaab kitni der cache ho sakta hai; packet me kitne routers se guzar sakta hai phenke jaane se pehle.',
  },
  label: {
    term: 'label', see: 2,
    en: 'One piece of a domain name between the dots. On the wire each is sent with its length in front of it.',
    hi: 'Domain naam ka ek tukda, do dots ke beech ka. Wire pe har ek apni length ke saath bheja jaata hai.',
  },
  'round trip': {
    term: 'round trip', see: 7,
    en: 'One question going out and its answer coming back. Distance is paid per round trip, which is why cutting them matters more than sending fewer bytes.',
    hi: 'Ek sawaal jaana aur jawaab wapas aana. Doori ki keemat har round trip pe lagti hai, isliye inhe ghatana kam bytes bhejne se zyada faayda deta hai.',
  },

  // ── chapter 3 · finding the path ────────────────────────────────────────
  router: {
    term: 'router', see: 3,
    en: 'A machine whose job is to take a packet and pass it one step closer to its destination. It does not know the whole route, only the next hop.',
    hi: 'Wo machine jiska kaam packet ko destination ke ek step aur paas pahunchana hai. Use poora raasta nahi pata, sirf agla hop.',
  },
  'routing table': {
    term: 'routing table', see: 3,
    en: 'The small map a machine keeps of where to send things. Your computer has one; so does every router on the internet.',
    hi: 'Wo chhota map jo machine rakhti hai ki kya kahan bhejna hai. Tumhare computer ke paas bhi hai, aur internet ke har router ke paas bhi.',
  },
  'default route': {
    term: 'default route', see: 3,
    en: 'The line in a routing table that means "I have no idea where this goes, send it to my parent". Almost all your traffic uses it.',
    hi: 'Routing table ki wo line jiska matlab hai "mujhe nahi pata ye kahan jaayega, mere parent ko bhej do". Tumhara lagbhag saara traffic isi se jaata hai.',
  },
  hop: {
    term: 'hop', see: 3,
    en: 'One router along the way. A packet from your house to a server abroad typically makes ten to fifteen of them.',
    hi: 'Raaste ka ek router. Tumhare ghar se videshi server tak packet aam taur pe das se pandrah hops leta hai.',
  },
  icmp: {
    term: 'ICMP', see: 3,
    en: 'The protocol routers use to complain — "your packet expired", "no route to that host". Traceroute and ping are built entirely out of those complaints.',
    hi: 'Wo protocol jisse routers shikayat karte hain — "tumhara packet expire ho gaya", "us host ka raasta nahi". Traceroute aur ping poori tarah inhi shikayaton se bane hain.',
  },
  latency: {
    term: 'latency', see: 3,
    en: 'How long one round trip takes. Mostly distance, which no amount of faster hardware can reduce.',
    hi: 'Ek round trip me kitna time lagta hai. Zyadatar ye doori hai, jise tez hardware se ghataya nahi ja sakta.',
  },
  traceroute: {
    term: 'traceroute', see: 3,
    en: 'A trick for discovering the path: send a packet allowed only one hop, see who complains, then allow two, and so on.',
    hi: 'Raasta pata karne ki jugaad: aisa packet bhejo jo sirf ek hop chal sake, dekho kaun shikayat karta hai, phir do allow karo, aise hi aage.',
  },
  ix: {
    term: 'internet exchange', see: 3,
    en: 'A building where many networks physically plug into each other. Traffic between two Indian networks usually meets at one instead of going abroad.',
    hi: 'Aisi building jahan kai networks physically ek doosre se jude hote hain. Do Indian networks ka traffic aksar wahin milta hai, videsh nahi jaata.',
  },

  // ── chapter 4 · reliable or fast ────────────────────────────────────────
  tcp: {
    term: 'TCP', see: 4,
    en: 'The protocol that numbers every byte and re-sends whatever goes missing, so what arrives is exactly what was sent. Slower, but complete.',
    hi: 'Wo protocol jo har byte ko number deta hai aur jo kho jaaye use dobara bhejta hai, taaki jo pahuche wahi ho jo bheja tha. Dheema, par poora.',
  },
  udp: {
    term: 'UDP', see: 4,
    en: 'The protocol that sends a packet and forgets about it. Nothing is re-sent, so nothing waits — which is what a voice call needs.',
    hi: 'Wo protocol jo packet bhej ke bhool jaata hai. Kuch dobara nahi bhejta, isliye kuch rukta nahi — voice call ko yahi chahiye.',
  },
  'packet loss': {
    term: 'packet loss', see: 4,
    en: 'Packets that never arrive. This is normal on every network, all the time — protocols are designed around it, not surprised by it.',
    hi: 'Wo packets jo kabhi pahunchte hi nahi. Har network pe ye hamesha hota hai — protocols isi ko maan ke bane hain, ye koi hairani ki baat nahi.',
  },
  acknowledgement: {
    term: 'acknowledgement', see: 4,
    en: 'The receiver telling the sender what it has got so far. Silence where an acknowledgement should be is how loss gets noticed.',
    hi: 'Receiver bhejne wale ko batata hai ki ab tak kya mila. Jahan acknowledgement aana chahiye tha wahan chuppi — isi se loss pakda jaata hai.',
  },
  'sequence number': {
    term: 'sequence number', see: 4,
    en: 'The number TCP puts on each byte so the receiver can spot a gap and put everything back in order.',
    hi: 'Wo number jo TCP har byte pe lagata hai, taaki receiver gap pehchan sake aur sab kuch sahi kram me laga sake.',
  },
  'ephemeral port': {
    term: 'ephemeral port', see: 4,
    en: 'A throwaway high-numbered port your OS picks for one outgoing connection and never reuses for it.',
    hi: 'Ek use-and-throw bada port number jo tumhara OS ek outgoing connection ke liye chunta hai aur uske liye dobara use nahi karta.',
  },
  port: {
    term: 'port', see: 4,
    en: 'A number that says which program on a machine a packet is for. The IP finds the machine; the port finds the program.',
    hi: 'Wo number jo batata hai machine pe packet kis program ke liye hai. IP machine dhoondhta hai; port program.',
  },
  socket: {
    term: 'socket', see: 4,
    en: 'One open connection, seen from your program\'s side: an address and port at each end.',
    hi: 'Ek khula connection, tumhare program ki taraf se dekha gaya: dono siron pe ek address aur ek port.',
  },
  'head-of-line blocking': {
    term: 'head-of-line blocking', see: 4,
    en: 'One lost packet stalling everything queued behind it, even data that already arrived safely. The cost of insisting on order.',
    hi: 'Ek khoya packet apne peeche ki poori line rok deta hai, us data ko bhi jo safely aa chuka tha. Kram pe zid karne ki yahi keemat hai.',
  },

  // ── chapter 5 · the lock ────────────────────────────────────────────────
  tls: {
    term: 'TLS', see: 5,
    en: 'The layer that locks a connection: first both sides agree on how, then everything after that is unreadable to anyone in between.',
    hi: 'Wo layer jo connection ko lock karti hai: pehle dono taraf tay karte hain kaise, phir uske baad sab kuch beech wale ke liye padhne laayak nahi rehta.',
  },
  https: {
    term: 'HTTPS', see: 5,
    en: 'Ordinary HTTP carried inside TLS. The padlock in your browser is that handshake having succeeded.',
    hi: 'Normal HTTP, TLS ke andar. Browser me jo taala dikhta hai wo isi handshake ke safal hone ka nishaan hai.',
  },
  handshake: {
    term: 'handshake', see: 5,
    en: 'The opening conversation where two machines agree on how to talk before saying anything real.',
    hi: 'Shuruaati baatcheet jisme do machines asli baat karne se pehle tay karti hain ki baat kaise karni hai.',
  },
  clienthello: {
    term: 'ClientHello', see: 5,
    en: 'The first message of a TLS handshake: "hi, here are the versions and ciphers I speak, and here is the site I want".',
    hi: 'TLS handshake ka pehla message: "hi, ye rahe wo versions aur ciphers jo mai bol sakta hoon, aur ye rahi wo site jo mujhe chahiye".',
  },
  serverhello: {
    term: 'ServerHello', see: 5,
    en: 'The server\'s reply picking one version and one cipher from what the client offered.',
    hi: 'Server ka jawaab, jisme wo client ke offer me se ek version aur ek cipher chunta hai.',
  },
  certificate: {
    term: 'certificate', see: 5,
    en: 'A server\'s ID card: which name it claims, who vouched for that claim, and until when.',
    hi: 'Server ka ID card: wo kaunsa naam bata raha hai, uski guarantee kisne di, aur kab tak.',
  },
  sni: {
    term: 'SNI', see: 5,
    en: 'The hostname sent in the clear at the very start of a TLS handshake, because the server must know which certificate to show before any key exists. It is also why your ISP still sees which sites you visit.',
    hi: 'Wo hostname jo TLS handshake ke bilkul shuru me bina taale ke jaata hai, kyunki server ko key banne se pehle pata hona chahiye kaunsa certificate dikhana hai. Isiliye tumhare ISP ko aaj bhi pata rehta hai tum kaunsi sites khol rahe ho.',
  },
  'cipher suite': {
    term: 'cipher suite', see: 5,
    en: 'The named bundle of algorithms two machines agree to use for a connection.',
    hi: 'Algorithms ka wo naamdaar bundle jise do machines ek connection ke liye use karne pe raazi hoti hain.',
  },
  'x.509': {
    term: 'X.509', see: 5,
    en: 'The standard shape a certificate is written in. Our own parser reads it, which is why every field can point at its exact bytes.',
    hi: 'Wo standard shakl jisme certificate likha jaata hai. Hamara apna parser ise padhta hai, isiliye har field apne exact bytes pe ishaara kar sakta hai.',
  },
  'asn.1 der': {
    term: 'ASN.1 DER', see: 5,
    en: 'A nested tag-length-value format: every piece says what it is, how long it is, then the value. Certificates are written in it.',
    hi: 'Ek nested tag-length-value format: har tukda batata hai wo kya hai, kitna lamba hai, phir value. Certificates isi me likhe jaate hain.',
  },
  subject: {
    term: 'Subject', see: 5,
    en: 'Who a certificate is for — the name being claimed.',
    hi: 'Certificate kiske liye hai — wo naam jo claim kiya ja raha hai.',
  },
  issuer: {
    term: 'Issuer', see: 5,
    en: 'Who signed a certificate and is vouching for it.',
    hi: 'Certificate pe kisne dastakhat kiye aur kaun uski guarantee de raha hai.',
  },
  san: {
    term: 'SAN', see: 5,
    en: 'The list of every hostname one certificate is valid for. This is how one certificate covers a site and its www version at once.',
    hi: 'Un saare hostnames ki list jinke liye ek certificate valid hai. Isi se ek certificate site aur uske www version dono ko cover karta hai.',
  },
  'certificate chain': {
    term: 'certificate chain', see: 5,
    en: 'A certificate signed by another, signed by another, up to one your machine already trusts. Trust is delegated, not declared.',
    hi: 'Ek certificate jise doosre ne sign kiya, use teesre ne, upar tak jahan koi aisa ho jis pe tumhari machine pehle se bharosa karti hai. Bharosa saunpa jaata hai, ghoshit nahi kiya jaata.',
  },

  // ── chapter 6 · asking for a page ───────────────────────────────────────
  http: {
    term: 'HTTP', see: 6,
    en: 'The language browsers and servers use to ask for and hand over pages. It is plain text you could type by hand.',
    hi: 'Wo bhasha jisme browser aur server page maangte aur dete hain. Ye saadi text hai, tum haath se type kar sakte ho.',
  },
  'request line': {
    term: 'request line', see: 6,
    en: 'The first line of an HTTP request: what to do, what to do it to, and which version. "GET / HTTP/1.1".',
    hi: 'HTTP request ki pehli line: kya karna hai, kis pe karna hai, aur kaunsa version. "GET / HTTP/1.1".',
  },
  header: {
    term: 'header', see: 8,
    en: 'Information wrapped around data saying where it goes and how to read it — the writing on the envelope rather than the letter.',
    hi: 'Data ke around lipti hui jaankari jo batati hai wo kahan jaayega aur kaise padha jaayega — lifaafe pe likha pata, chitthi nahi.',
  },
  'status code': {
    term: 'status code', see: 6,
    en: 'The three-digit answer a server gives about how the request went. 200 fine, 301 moved, 404 no such page.',
    hi: 'Teen ank ka jawaab jo server deta hai ki request ka kya hua. 200 theek, 301 shift ho gaya, 404 aisa page nahi.',
  },
  'host header': {
    term: 'Host header', see: 6,
    en: 'The line naming which site you want, so one server holding thousands of sites knows which to serve.',
    hi: 'Wo line jo batati hai kaunsi site chahiye, taaki hazaaron sites wala ek server jaan sake kaunsi deni hai.',
  },
  'user-agent': {
    term: 'User-Agent', see: 6,
    en: 'A line describing the program making the request. Servers use it to decide what to send you, and to track you.',
    hi: 'Ek line jo batati hai request kaunsa program kar raha hai. Servers isse tay karte hain kya bhejna hai, aur tumhe track bhi karte hain.',
  },
  'chunked encoding': {
    term: 'chunked encoding', see: 6,
    en: 'Sending a reply in pieces when the total size is not known yet: a length, that many bytes, repeat, then a zero to finish.',
    hi: 'Jab total size pata na ho to jawaab tukdo me bhejna: ek length, utne bytes, dohrao, phir zero se khatam.',
  },
  crlf: {
    term: 'CRLF', see: 6,
    en: 'The two characters HTTP ends every line with. Use only one of them and some servers stop understanding you.',
    hi: 'Wo do characters jinse HTTP har line khatam karta hai. Sirf ek use karo to kuch servers samajhna band kar dete hain.',
  },
  'keep-alive': {
    term: 'keep-alive', see: 6,
    en: 'Reusing one open connection for several requests, so the second one skips DNS, TCP and the whole TLS handshake.',
    hi: 'Ek hi khule connection pe kai requests bhejna, taaki doosri wali DNS, TCP aur poora TLS handshake skip kar de.',
  },
  '304 not modified': {
    term: '304 Not Modified', see: 6,
    en: 'A server saying "what you already have is still current" without re-sending it. The cheapest possible reply.',
    hi: 'Server ka jawaab: "jo tumhare paas hai wahi abhi bhi sahi hai", bina dobara bheje. Sabse sasta jawaab.',
  },

  // ── chapter 7 · the journey ─────────────────────────────────────────────
  caching: {
    term: 'caching', see: 7,
    en: 'Keeping an answer so you do not have to ask again. Run the same journey twice and a whole stage nearly disappears.',
    hi: 'Jawaab sambhaal ke rakhna taaki dobara na poochna pade. Ek hi journey do baar chalao aur ek poora stage lagbhag gayab ho jaata hai.',
  },
  'session resumption': {
    term: 'session resumption', see: 7,
    en: 'Picking up a previously agreed TLS session instead of doing the whole handshake again.',
    hi: 'Poora handshake dobara karne ki jagah pehle se tay TLS session wahin se uthana.',
  },
  'http/2': {
    term: 'HTTP/2', see: 7,
    en: 'A newer version of HTTP that carries many requests over one connection at once, to stop paying setup costs repeatedly.',
    hi: 'HTTP ka naya version jo ek hi connection pe kai requests ek saath le jaata hai, taaki setup ki keemat baar-baar na deni pade.',
  },
  '0-rtt': {
    term: '0-RTT', see: 7,
    en: 'Sending your request in the very first packet to a server you have talked to before, paying no round trip for setup at all.',
    hi: 'Jis server se pehle baat ho chuki ho, use pehle hi packet me request bhej dena — setup pe ek bhi round trip kharch kiye bina.',
  },

  // ── chapter 8 · layers ──────────────────────────────────────────────────
  'osi model': {
    term: 'OSI model', see: 8,
    en: 'A seven-layer way of organising what a network does. Useful as a filing system for things you already understand, useless as an introduction.',
    hi: 'Network kya karta hai use saat layers me baantne ka tareeka. Jo cheezein pehle se samajh aa gayi ho unhe organise karne me kaam ka, shuruaat ke liye bekaar.',
  },
  'tcp/ip model': {
    term: 'TCP/IP model', see: 8,
    en: 'The four-layer model the internet actually runs on. OSI has seven; two of them barely exist in practice.',
    hi: 'Chaar layers wala model jis pe internet asal me chalta hai. OSI me saat hain; unme se do practice me lagbhag hain hi nahi.',
  },
  layer: {
    term: 'layer', see: 8,
    en: 'One job in the stack, talking only to the layer directly above and below it. That is why you can swap Wi-Fi for cable and nothing above notices.',
    hi: 'Stack ka ek kaam, jo sirf apne theek upar aur neeche wali layer se baat karta hai. Isi liye Wi-Fi ko cable se badlo to upar kisi ko farak nahi padta.',
  },
  encapsulation: {
    term: 'encapsulation', see: 8,
    en: 'Each layer wrapping the one above it in its own header on the way down, and unwrapping on the way up. That sentence is the whole meaning of "network stack".',
    hi: 'Neeche jaate hue har layer apne upar wali ko apne header me lapetti hai, aur upar jaate hue kholti hai. Isi ek vaakya me "network stack" ka poora matlab hai.',
  },
  payload: {
    term: 'payload', see: 8,
    en: 'The part of a packet you actually wanted to send, as opposed to the headers wrapped around it.',
    hi: 'Packet ka wo hissa jo tum sach me bhejna chahte the, uske around lipte headers ke ulat.',
  },
  ethernet: {
    term: 'Ethernet', see: 8,
    en: 'The rules for moving a frame between two machines on the same local network, using MAC addresses rather than IPs.',
    hi: 'Ek hi local network pe do machines ke beech frame bhejne ke niyam, IP ki jagah MAC address se.',
  },
  frame: {
    term: 'frame', see: 8,
    en: 'What a packet is called at the bottom layer, once it has an Ethernet header wrapped around it.',
    hi: 'Sabse neeche wali layer pe packet ko frame kehte hain, jab uske around Ethernet header lipat jaata hai.',
  },
  overhead: {
    term: 'overhead', see: 8,
    en: 'Bytes spent on addressing and bookkeeping rather than on what you meant to send. Roughly a quarter of a small request.',
    hi: 'Wo bytes jo address aur hisaab-kitaab me lagte hain, us cheez me nahi jo tum bhejna chahte the. Chhoti request ka lagbhag chauthai hissa.',
  },

  // ── words the lessons lean on everywhere ────────────────────────────────
  packet: {
    term: 'packet', see: 2,
    en: 'One small parcel of data sent across a network. Everything you do online is chopped into these.',
    hi: 'Network pe bheja gaya data ka ek chhota parcel. Online tum jo bhi karte ho, sab inhi me kata hota hai.',
  },
  protocol: {
    term: 'protocol', see: 8,
    en: 'An agreement about what to say and in what order, so two machines written by strangers can still talk.',
    hi: 'Kya kehna hai aur kis kram me — iska samjhauta, taaki ajnabiyon ki likhi do machines bhi baat kar sakein.',
  },
  byte: {
    term: 'byte', see: 2,
    en: 'Eight bits, the unit everything on the wire is counted in. One letter of plain English is one byte.',
    hi: 'Aath bits, wo unit jisme wire pe sab kuch gina jaata hai. Normal English ka ek akshar ek byte hai.',
  },
  bit: {
    term: 'bit', see: 2,
    en: 'A single one or zero. Protocol flags are often one bit each, packed eight to a byte.',
    hi: 'Ek akela one ya zero. Protocol flags aksar ek-ek bit ke hote hain, aath ek byte me thuse hue.',
  },
  hex: {
    term: 'hex', see: 2,
    en: 'Counting in sixteens instead of tens, so one byte is always exactly two digits. 0x1c is 28.',
    hi: 'Das ki jagah solah me ginna, taaki ek byte hamesha theek do digits ka ho. 0x1c matlab 28.',
  },
  ascii: {
    term: 'ASCII', see: 6,
    en: 'The oldest agreement about which number means which letter. 65 is A, and HTTP is written entirely in it.',
    hi: 'Sabse purana samjhauta ki kaunsa number kaunsa akshar hai. 65 matlab A, aur HTTP poora isi me likha hota hai.',
  },
  ipv4: {
    term: 'IPv4', see: 1,
    en: 'The older address format, four numbers like 140.82.113.4. There are about four billion, and they ran out.',
    hi: 'Purana address format, chaar numbers jaise 140.82.113.4. Ye lagbhag chaar arab hain, aur khatam ho gaye.',
  },
  ipv6: {
    term: 'IPv6', see: 2,
    en: 'The newer, much longer address format written in hex. Enough addresses that running out is not a concern.',
    hi: 'Naya, kaafi lamba address format, hex me likha hua. Itne address ki khatam hone ki chinta hi nahi.',
  },
  kernel: {
    term: 'kernel', see: 4,
    en: 'The core of your operating system. It owns the network card, which is why some packet details are never visible to a program like this one.',
    hi: 'Tumhare operating system ka core. Network card usi ke paas hai, isliye packet ki kuch details is jaise program ko kabhi nahi dikhtin.',
  },
  cache: {
    term: 'cache', see: 7,
    en: 'A kept copy of an answer, so the same question does not have to be asked twice.',
    hi: 'Jawaab ki rakhi hui copy, taaki wahi sawaal do baar na poochna pade.',
  },
  isp: {
    term: 'ISP', see: 3,
    en: 'The company your router connects to. Every packet you send passes through their machines first.',
    hi: 'Wo company jisse tumhara router judta hai. Tumhara har packet sabse pehle unki machines se guzarta hai.',
  },
  sim: {
    term: 'SIM', see: 4,
    en: 'Our label for anything modelled rather than measured. If it does not say SIM, a real packet produced it.',
    hi: 'Hamara label un cheezon pe jo naapi nahi, model ki gayi hain. Agar SIM nahi likha, to use ek asli packet ne banaya hai.',
  },
}

/** Keys longest first, so "subnet mask" is matched before "mask". */
export const KEYS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length)

export const define = (key) => GLOSSARY[String(key).toLowerCase()] ?? null
