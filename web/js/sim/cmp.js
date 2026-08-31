/**
 * cmp.js — the comparisons, as data.
 *
 * Half the syllabus is "X vs Y", and a comparison table is the one format
 * where a textbook is genuinely hard to beat. So this does not try to beat it
 * on the table. It adds the two things a printed table cannot have:
 *
 *   `see`   a real command that demonstrates the difference. Reading that DNS
 *           uses UDP and HTTP uses TCP is not the same as running both and
 *           watching one take a round trip and the other take six.
 *
 *   `asks`  the question an exam actually poses — a situation, not a property.
 *           Nobody is asked to list the differences between TCP and UDP; they
 *           are asked which one a video call should use.
 *
 * Rows are marked `same: true` where the two genuinely agree, because the
 * agreements are as informative as the differences and tables usually omit them.
 */

const T = (en, hi) => ({ en, hi })

export const COMPARISONS = {
  'tcp-udp': {
    title: T('TCP vs UDP', 'TCP vs UDP'),
    blurb: T(
      'Both carry your data between two programs. They differ on one question: what to do when a packet goes missing.',
      'Dono tumhara data do programs ke beech le jaate hain. Farak sirf ek sawaal pe hai: packet kho jaaye to karna kya hai.',
    ),
    columns: ['TCP', 'UDP'],
    rows: [
      { aspect: T('lost packet', 'khoya packet'), values: ['re-sent until it arrives', 'gone, and nobody mentions it'] },
      { aspect: T('order', 'kram'), values: ['guaranteed', 'whatever order it arrives in'] },
      { aspect: T('setup', 'shuruaat'), values: ['a handshake before any data', 'none — the first packet is data'] },
      { aspect: T('header', 'header'), values: ['20 bytes', '8 bytes'] },
      { aspect: T('speed under loss', 'loss me raftaar'), values: ['stalls until the gap is filled', 'never stalls'] },
      { aspect: T('finds the right program', 'sahi program dhoondhna'), values: ['port numbers', 'port numbers'], same: true },
      { aspect: T('travels over', 'kis pe chalta hai'), values: ['IP', 'IP'], same: true },
    ],
    see: [
      { say: T('DNS chose UDP — one question, one answer, no setup.', 'DNS ne UDP chuna — ek sawaal, ek jawaab, koi setup nahi.'), run: 'dig facebook.com' },
      { say: T('A web page chose TCP. Count the round trips before any content arrives.', 'Web page ne TCP chuna. Content aane se pehle round trips gino.'), run: 'journey https://example.com' },
    ],
    asks: [
      { q: T('a voice call', 'ek voice call'), a: 'UDP', why: T('A re-sent word arriving late is worse than a word missing.', 'Der se aaya dobara-bheja shabd, gayab shabd se bura hai.') },
      { q: T('downloading a file', 'file download'), a: 'TCP', why: T('A file with a hole in it is not a file.', 'Chhed wali file, file hoti hi nahi.') },
      { q: T('a DNS lookup', 'DNS lookup'), a: 'UDP', why: T('One small question. A handshake would cost more than simply asking again.', 'Ek chhota sawaal. Handshake ki keemat dobara poochne se zyada hoti.') },
      { q: T('live video', 'live video'), a: 'UDP', why: T('A dropped frame is a glitch; waiting for it is a freeze.', 'Ek frame gira to glitch; uske intezaar me ruke to freeze.') },
    ],
  },

  'osi-tcpip': {
    title: T('OSI vs TCP/IP', 'OSI vs TCP/IP'),
    blurb: T(
      'Two ways of dividing the same job. OSI is the teaching model with seven layers; TCP/IP is the four the internet is actually built on.',
      'Ek hi kaam ko baantne ke do tareeke. OSI padhane wala model hai, saat layers ka; TCP/IP wo chaar hain jin pe internet sach me bana hai.',
    ),
    columns: ['OSI', 'TCP/IP'],
    rows: [
      { aspect: T('layers', 'layers'), values: ['7', '4'] },
      { aspect: T('came from', 'aaya kahan se'), values: ['a committee, designed first', 'working code, described afterwards'] },
      { aspect: T('the internet runs on', 'internet chalta hai'), values: ['no', 'yes'] },
      { aspect: T('session and presentation', 'session aur presentation'), values: ['layers 5 and 6', 'folded into the application'] },
      { aspect: T('used for', 'kis kaam aata hai'), values: ['naming and teaching', 'building'] },
      { aspect: T('physical and data link', 'physical aur data link'), values: ['two separate layers', 'one link layer'] },
    ],
    see: [
      { say: T('One journey touches four of these layers. Watch them fire in order.', 'Ek journey inme se chaar layers chhooti hai. Unhe kram se chalte dekho.'), run: 'journey https://example.com' },
    ],
    asks: [
      { q: T('which model does a router implement?', 'router kaunsa model use karta hai?'), a: 'TCP/IP', why: T('Routers are built, not taught. Layer 3 is where they live in both models.', 'Router banaye jaate hain, padhaye nahi. Dono models me wo layer 3 pe hi hain.') },
      { q: T('which model has a presentation layer?', 'presentation layer kisme hai?'), a: 'OSI', why: T('And almost nothing implements it separately — that is the honest part.', 'Aur use alag se lagbhag koi lagata nahi — yahi imaandaar baat hai.') },
    ],
  },

  'ipv4-ipv6': {
    title: T('IPv4 vs IPv6', 'IPv4 vs IPv6'),
    blurb: T(
      'The same job, done with four times the address. IPv6 is not IPv4 with more digits — a few things were tidied up on the way.',
      'Wahi kaam, chaar guna bade address ke saath. IPv6 sirf lambe IPv4 nahi hai — raaste me kuch cheezein sudhaar bhi di gayin.',
    ),
    columns: ['IPv4', 'IPv6'],
    rows: [
      { aspect: T('address size', 'address ka size'), values: ['32 bits', '128 bits'] },
      { aspect: T('how many', 'kitne'), values: ['4.3 billion', '340 undecillion'] },
      { aspect: T('written as', 'likha kaise jaata hai'), values: ['140.82.113.4', '2a03:2880:f312:1:face:b00c:0:25de'] },
      { aspect: T('header size', 'header ka size'), values: ['20 bytes, variable', '40 bytes, fixed'] },
      { aspect: T('header checksum', 'header checksum'), values: ['yes, recomputed at every hop', 'dropped — the layers above already check'] },
      { aspect: T('NAT', 'NAT'), values: ['everywhere, out of necessity', 'not needed'] },
      { aspect: T('DNS record', 'DNS record'), values: ['A', 'AAAA'] },
      { aspect: T('routed by', 'route kaise hota hai'), values: ['longest prefix match', 'longest prefix match'], same: true },
    ],
    see: [
      { say: T('Ask for the IPv4 address.', 'IPv4 address maango.'), run: 'dig facebook.com' },
      { say: T('Now the IPv6 one. Same name, same resolver, one field changed.', 'Ab IPv6. Wahi naam, wahi resolver, ek field badla.'), run: 'dig facebook.com AAAA' },
    ],
    asks: [
      { q: T('why did IPv6 drop the header checksum?', 'IPv6 ne header checksum kyun hataya?'), a: T('it was wasted work', 'wo bekaar ka kaam tha'), why: T('Every router had to recompute it at every hop, and TCP, UDP and the link layer were all checking anyway.', 'Har router ko har hop pe dobara ginna padta tha, jabki TCP, UDP aur link layer waise bhi check kar rahe the.') },
      { q: T('why does NAT exist at all?', 'NAT hai hi kyun?'), a: T('IPv4 ran out', 'IPv4 khatam ho gaye'), why: T('4.3 billion addresses sounded limitless in 1981. NAT is the workaround that bought thirty more years.', '1981 me 4.3 arab address anant lagte the. NAT wahi jugaad hai jisne tees saal aur khareed diye.') },
    ],
  },

  'devices': {
    title: T('Hub vs switch vs router', 'Hub vs switch vs router'),
    blurb: T(
      'Three boxes with cables in them, working at three different layers. Which layer a box understands is the whole difference.',
      'Teen dabbe jinme cable lagte hain, teen alag layers pe kaam karte hue. Farak sirf itna hai ki dabba kaunsi layer samajhta hai.',
    ),
    columns: ['Hub', 'Switch', 'Router'],
    rows: [
      { aspect: T('works at layer', 'kaam karta hai layer'), values: ['1 — physical', '2 — data link', '3 — network'] },
      { aspect: T('understands', 'samajhta hai'), values: ['nothing, it repeats', 'MAC addresses', 'IP addresses'] },
      { aspect: T('sends a frame to', 'frame bhejta hai'), values: ['every port', 'the one port that needs it', 'the next network'] },
      { aspect: T('can join two networks', 'do networks jod sakta hai'), values: ['no', 'no', 'yes'] },
      { aspect: T('everyone hears everything', 'sab sab kuch sunte hain'), values: ['yes', 'no', 'no'] },
      { aspect: T('still sold', 'aaj bhi milta hai'), values: ['no', 'yes', 'yes'] },
    ],
    see: [
      { say: T('Your gateway is the router in this story. Here is its address.', 'Is kahani ka router tumhara gateway hai. Ye raha uska address.'), run: 'ifconfig' },
      { say: T('And here is every neighbour the switch has let you speak to.', 'Aur ye rahe wo saare padosi jinse switch ne baat karwayi.'), run: 'arp' },
    ],
    asks: [
      { q: T('which one lets your laptop reach the internet?', 'laptop ko internet tak kaun pahunchata hai?'), a: T('router', 'router'), why: T('Only it understands addresses on the other network.', 'Doosre network ke address sirf wahi samajhta hai.') },
      { q: T('why did switches replace hubs?', 'switch ne hub ko kyun hataya?'), a: T('a hub repeats to everyone', 'hub sabko bhejta hai'), why: T('That wastes the wire and lets anyone read anyone. A switch sends each frame to one port.', 'Isse taar bhi barbaad hota hai aur koi bhi kisi ko padh sakta hai. Switch har frame ek hi port pe bhejta hai.') },
    ],
  },

  'switching': {
    title: T('Circuit vs packet switching', 'Circuit vs packet switching'),
    blurb: T(
      'Reserve a path for the whole conversation, or chop the conversation up and let each piece find its own way. The internet made the second choice, and everything about it follows from that.',
      'Poori baatcheet ke liye raasta reserve kar lo, ya baat ko tukdo me kaat ke har tukde ko apna raasta dhoondhne do. Internet ne doosra chuna, aur uski har baat isi se nikalti hai.',
    ),
    columns: [T('Circuit', 'Circuit'), T('Packet', 'Packet')],
    rows: [
      { aspect: T('the path', 'raasta'), values: ['fixed before you speak', 'chosen per packet, per hop'] },
      { aspect: T('if a link dies', 'link mar jaaye to'), values: ['the call drops', 'the next packet goes another way'] },
      { aspect: T('idle time', 'khaali waqt'), values: ['reserved and wasted', 'used by somebody else'] },
      { aspect: T('delay', 'deri'), values: ['steady', 'varies with the queue'] },
      { aspect: T('example', 'misaal'), values: ['the old telephone network', 'the internet'] },
    ],
    see: [
      { say: T('Every hop here made its own decision. No path was reserved for you.', 'Yahan har hop ne apna faisla khud liya. Tumhare liye koi raasta reserve nahi hua tha.'), run: 'tracert example.com' },
    ],
    asks: [
      { q: T('why does internet latency wobble?', 'internet ki latency oopar-neeche kyun hoti hai?'), a: T('queues', 'queues'), why: T('Nothing is reserved, so every packet waits behind whatever else reached that router first.', 'Kuch reserve nahi hota, isliye har packet unke peeche lagta hai jo us router pe pehle pahunch gaye.') },
      { q: T('which survives a cable being cut?', 'cable katne pe kaun bacha rehta hai?'), a: T('packet', 'packet'), why: T('The next packet simply takes a different route. A reserved circuit has nowhere to go.', 'Agla packet bas doosra raasta le leta hai. Reserved circuit ke paas jaane ko kuch hota hi nahi.') },
    ],
  },
}

export const IDS = Object.keys(COMPARISONS)

/** Every command a comparison offers to run, for the test that checks they exist. */
export const commandsUsed = () =>
  IDS.flatMap((id) => (COMPARISONS[id].see ?? []).map((s) => s.run))
