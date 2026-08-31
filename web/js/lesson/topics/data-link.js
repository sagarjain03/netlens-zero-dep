/**
 * data-link.js — the Data Link module.
 *
 * The part of the syllabus that is hardest to learn from a page, because none
 * of it is observable from a program: framing, checksums and sliding windows
 * all happen inside the kernel or on the network card. It is also the part
 * that benefits most from being operated, which is why every topic here opens
 * a lab rather than describing one.
 *
 * Same data shape as a chapter file: beats, steps, points, a challenge. The
 * renderer is shared, so a topic is content and never code.
 */

const T = (en, hi) => ({ en, hi })

export default {
  // ── the layer itself ───────────────────────────────────────────────────
  'data-link-layer': {
    title: T('The data link layer', 'Data link layer'),
    question: T(
      'IP gets a packet across the world. But how does it cross one single cable?',
      'IP packet ko duniya paar karwa deta hai. Par ek akela cable paar kaise hota hai?',
    ),
    beats: [
      {
        text: T(
          'Layer 3 worries about the whole journey. Layer 2 worries about exactly one hop:\ngetting a frame from this machine to the next machine on the same wire.',
          'Layer 3 poore safar ki fikr karti hai. Layer 2 sirf ek hop ki:\nis machine se usi taar par agli machine tak frame pahunchana.',
        ),
        art: [
          '  you ---[ hop ]--- router ---[ hop ]--- router ---> server',
          '       L2 does this      L2 again        L2 again',
          '       L3 is responsible for the whole line',
        ].join('\n'),
      },
      {
        text: T(
          'It has three jobs. Mark where a frame starts and stops, notice if it\narrived damaged, and stop a fast sender drowning a slow receiver.',
          'Iske teen kaam hain. Frame kahan shuru aur khatam hui ye batana, kharaab\naayi to pakadna, aur tez bhejne wale ko dheere lene wale pe haavi hone se rokna.',
        ),
      },
      {
        text: T(
          'None of it is visible to a program — it happens in the kernel and on the\ncard. So the labs here are the real algorithms, run on data you choose.',
          'Kisi program ko ye kuch nahi dikhta — sab kernel aur card ke andar hota hai.\nIsliye yahan ke labs asli algorithms hain, tumhare chune hue data pe.',
        ),
      },
    ],
    hook: T(
      'Your machine has already spoken layer 2 to every neighbour it knows. Here is that list.',
      'Tumhari machine har jaane-pehchane padosi se layer 2 me baat kar chuki hai. Ye rahi wo list.',
    ),
    steps: [
      {
        say: T('Every MAC address here was learned one hop at a time.', 'Yahan ka har MAC address ek-ek hop karke seekha gaya hai.'),
        run: 'arp',
        after: T(
          'These are layer 2 addresses. Notice they are hardware, not location — none of them tells you where anything is, only who it is.',
          'Ye layer 2 addresses hain. Dhyan do, ye hardware hain, jagah nahi — inme se koi nahi batata kuch kahan hai, sirf kaun hai.',
        ),
      },
    ],
    points: [
      T('A frame is what a packet is called once layer 2 has wrapped it. Same bytes, one more envelope.',
        'Layer 2 ke lapetne ke baad packet ko frame kehte hain. Wahi bytes, ek aur lifaafa.'),
      T('MAC addresses are flat: there is no structure to route on. That is why layer 3 exists at all.',
        'MAC addresses flat hote hain: unme route karne laayak koi structure nahi. Isiliye layer 3 hai hi.'),
      T('Every hop rewrites the layer 2 addresses and leaves the layer 3 ones alone. The envelope changes; the letter does not.',
        'Har hop layer 2 ke address badal deta hai aur layer 3 wale chhod deta hai. Lifaafa badalta hai, chitthi nahi.'),
    ],
    challenge: {
      ask: T('Find your router in the ARP table, then explain why its MAC address is useless to a machine one country away.',
        'ARP table me apna router dhoondho, phir batao ki ek doosre desh ki machine ke liye uska MAC address bekaar kyun hai.'),
      run: 'arp',
    },
    terms: ['frame', 'MAC address', 'ARP', 'Ethernet', 'layer'],
  },

  // ── framing ────────────────────────────────────────────────────────────
  framing: {
    title: T('Framing', 'Framing'),
    question: T(
      'A cable carries a stream of bits. Where does one frame end and the next begin?',
      'Cable pe to bits ki dhaar behti hai. Ek frame khatam kahan hoti hai aur agli shuru kahan?',
    ),
    beats: [
      {
        text: T(
          'The wire has no punctuation. It carries ones and zeros and nothing else,\nso the frame has to mark its own beginning and end.',
          'Taar pe koi viraam-chinh nahi hota. Bas ek aur zero, aur kuch nahi,\nisliye frame ko apni shuruaat aur ant khud batana padta hai.',
        ),
        art: [
          '  01111110  ...... payload ......  01111110',
          '  ^ flag                            ^ flag',
        ].join('\n'),
      },
      {
        text: T(
          'The usual answer is a flag: an agreed pattern, 01111110, at each end.\nWhich creates a new problem immediately.',
          'Aam jawaab hai flag: ek tay pattern, 01111110, dono siron pe.\nAur isse turant ek nayi museebat khadi ho jaati hai.',
        ),
      },
      {
        text: T(
          'What if the data itself contains that pattern? The receiver would stop early,\nin the middle of your frame, and hand up half a message.',
          'Agar data me hi wahi pattern aa gaya to? Receiver beech me hi ruk jaata,\naur aadha message upar bhej deta.',
        ),
      },
    ],
    hook: T(
      'The fix is one of the neatest tricks in networking, and the sender does it without telling anyone.',
      'Iska hal networking ki sabse safaai wali jugaadon me se ek hai, aur sender ise bina kisi ko bataye kar deta hai.',
    ),
    lab: 'bitstuff',
    labSay: T(
      'Type a payload containing 01111110 and watch the sender break it up.',
      'Aisa payload likho jisme 01111110 ho, aur dekho sender use kaise tod deta hai.',
    ),
    points: [
      T('After five consecutive ones the sender inserts a zero. Six ones can then only ever be a flag.',
        'Paanch lagataar ones ke baad sender ek zero ghusa deta hai. Uske baad chhe ones sirf flag hi ho sakte hain.'),
      T('The receiver removes it without being told. No length field, no negotiation — the rule alone is the agreement.',
        'Receiver use bina bataye hata deta hai. Na length field, na baatcheet — niyam hi poora samjhauta hai.'),
      T('Character-oriented protocols do the same thing with an escape byte, and hit the same problem when the data contains an escape.',
        'Character wale protocols yahi kaam escape byte se karte hain, aur data me escape aane pe wahi museebat jhelte hain.'),
      T('Framing costs bits. A payload of all ones grows by a fifth — the price of never being ambiguous.',
        'Framing bits kharch karti hai. Poore ones wala payload paanchvaan hissa bada ho jaata hai — kabhi confuse na hone ki yahi keemat hai.'),
    ],
    challenge: {
      ask: T('Find a payload that gains three stuffed bits, and one that gains none. What is different about them?',
        'Aisa payload dhoondho jisme teen bits ghuse, aur ek jisme ek bhi nahi. Dono me farak kya hai?'),
    },
    terms: ['frame', 'bit', 'payload'],
  },

  // ── error detection ────────────────────────────────────────────────────
  'error-detection': {
    title: T('Error detection', 'Error detection'),
    question: T(
      'A frame arrives. How does the receiver know it arrived unchanged?',
      'Frame pahunch gayi. Receiver ko kaise pata ki wo waisi hi hai jaisi bheji thi?',
    ),
    beats: [
      {
        text: T(
          'Wires pick up interference. Bits flip. Nobody sends a note to say so —\nthe frame simply arrives different from the way it left.',
          'Taaron pe interference aata hai. Bits palat jaate hain. Koi bata ke nahi jaata —\nframe bas waisi nahi pahunchti jaisi nikli thi.',
        ),
      },
      {
        text: T(
          'So the sender computes a number from the data and sends it along.\nThe receiver computes the same number and compares.',
          'To sender data se ek number nikaalta hai aur saath bhej deta hai.\nReceiver wahi number khud nikaal ke milaata hai.',
        ),
      },
      {
        text: T(
          'The whole question is which number. A weak one misses damage;\na strong one costs bits and time on every single frame.',
          'Poora sawaal yahi hai ki kaunsa number. Kamzor number nuksaan chhod deta hai;\nmazboot number har frame pe bits aur waqt kharch karta hai.',
        ),
      },
    ],
    hook: T(
      'Two schemes, the same broken bit. One catches it every time; the other can be blind to four errors at once.',
      'Do scheme, wahi ek toota bit. Ek use har baar pakadti hai; doosri ek saath chaar errors tak nahi dekh paati.',
    ),
    lab: 'crc',
    labSay: T(
      'Break a bit and watch the remainder stop being zero. Then try `lab parity` and break four.',
      'Ek bit todo aur dekho remainder zero rehna band kar deta hai. Phir `lab parity` me chaar todo.',
    ),
    points: [
      T('CRC is long division in binary with no carries — subtraction is XOR. That is the entire trick, and it is why a shift register can do it in hardware.',
        'CRC binary me long division hai, bina carry ke — ghataana matlab XOR. Bas yahi poori jugaad hai, aur isiliye ise hardware me shift register kar leta hai.'),
      T('The remainder travels with the frame. Divide the whole thing again at the far end and a clean frame leaves nothing behind.',
        'Remainder frame ke saath jaata hai. Doosre sire pe poora dobara divide karo, aur saaf frame kuch nahi chhodti.'),
      T('A single flipped bit always changes the remainder. That is provable, not lucky — the lab checks every position.',
        'Ek palta hua bit remainder hamesha badal deta hai. Ye saabit hota hai, kismat nahi — lab har position check karta hai.'),
      T('Two-dimensional parity locates a single error exactly, and is completely blind to four errors at the corners of a rectangle.',
        'Do-dimension wali parity ek error ki jagah theek batati hai, aur rectangle ke chaar konon wale errors use bilkul nahi dikhte.'),
      T('Detection is not correction. All of this tells you to throw the frame away and ask again.',
        'Pakadna theek karna nahi hai. Ye sab sirf itna kehta hai ki frame phenk do aur dobara maango.'),
    ],
    challenge: {
      ask: T('In the parity lab, break four bits so that every parity still passes. Then explain why CRC does not have that hole.',
        'Parity lab me chaar bits aise todo ki har parity phir bhi pass ho jaaye. Phir batao CRC me wo chhed kyun nahi hai.'),
    },
    terms: ['frame', 'bit', 'byte', 'hex'],
  },

  // ── error correction ───────────────────────────────────────────────────
  'error-correction': {
    title: T('Error correction', 'Error correction'),
    question: T(
      'Detection means asking again. What if asking again is too expensive?',
      'Pakadne ka matlab hai dobara maangna. Par dobara maangna hi mehnga ho to?',
    ),
    beats: [
      {
        text: T(
          'A satellite is half a second away. A deep-space probe is hours away.\nAsking again is not a plan; the receiver has to repair it alone.',
          'Satellite aadha second door hai. Deep-space probe ghanton door.\nDobara maangna koi hal nahi; receiver ko khud hi theek karna padega.',
        ),
      },
      {
        text: T(
          'So spend more bits up front. Enough redundancy and the damage does not\njust announce itself — it points at exactly which bit is wrong.',
          'To pehle hi zyada bits kharch karo. Itni redundancy do ki nuksaan sirf\nbataye nahi — seedha ungli uthaye ki galat bit kaunsa hai.',
        ),
      },
      {
        text: T(
          'Hamming does it with parity bits at positions 1, 2, 4, 8. Each covers the\npositions whose number contains it, so the failures spell out the answer.',
          'Hamming ye parity bits se karta hai, position 1, 2, 4, 8 pe. Har ek un positions ko\ndekhta hai jinke number me wo hai, isliye fail hui parities khud jawaab likh deti hain.',
        ),
        art: [
          '  p1 p2 d1 p4 d2 d3 d4      positions 1..7',
          '  p1 covers 3 5 7',
          '  p2 covers 3 6 7',
          '  p4 covers 5 6 7',
          '  p1 and p4 fail -> 1 + 4 = bit 5 is wrong',
        ].join('\n'),
      },
    ],
    hook: T(
      'Nothing is looked up. The failing parities, read as a binary number, are the position.',
      'Kuch dhoondhna nahi padta. Fail hui parities ko binary number ki tarah padho — wahi position hai.',
    ),
    lab: 'hamming',
    labSay: T(
      'Break one bit and watch the syndrome name it. Then break a second one.',
      'Ek bit todo aur dekho syndrome uska naam bata deta hai. Phir doosra bit todo.',
    ),
    points: [
      T('m data bits need r parity bits where 2^r is at least m + r + 1 — every position needs a distinct pattern, plus one for "nothing wrong".',
        'm data bits ko r parity bits chahiye jahan 2^r kam se kam m + r + 1 ho — har position ka alag pattern chahiye, aur ek "sab theek hai" ke liye.'),
      T('The overhead is real: four data bits cost three parity bits. Correction is bought, not free.',
        'Iski keemat asli hai: chaar data bits pe teen parity bits. Sudhaar khareedna padta hai, muft nahi milta.'),
      T('Honest limit: with two errors it still names a position, and the position is wrong. It cannot tell one error from two.',
        'Imaandaar limit: do errors pe bhi ye position batata hai, aur wo position galat hoti hai. Ek aur do error me farak nahi kar paata.'),
      T('That is why real links pair a strong detector with retransmission, and save correction for the times asking again is impossible.',
        'Isiliye asli links mazboot detector aur retransmission saath rakhte hain, aur correction wahin bachaate hain jahan dobara maangna namumkin ho.'),
    ],
    challenge: {
      ask: T('Break two bits and note the position Hamming claims. Work out why it lands there rather than on either broken bit.',
        'Do bits todo aur dekho Hamming kaunsi position batata hai. Socho ki wo wahin kyun girta hai, kisi tooti hui bit pe kyun nahi.'),
    },
    terms: ['bit', 'payload'],
  },

  // ── flow control ───────────────────────────────────────────────────────
  'flow-control': {
    title: T('Flow control', 'Flow control'),
    question: T(
      'The frame arrived intact. But what if it never arrives at all?',
      'Frame saabut pahunch gayi. Par agar wo pahunche hi nahi to?',
    ),
    beats: [
      {
        text: T(
          'Send one frame, wait for the acknowledgement, send the next.\nCorrect, simple, and mostly spent waiting for the wire.',
          'Ek frame bhejo, acknowledgement ka intezaar karo, phir agli.\nSahi hai, simple hai, aur zyadatar waqt taar ka intezaar hai.',
        ),
        art: [
          '  stop and wait   send ---- wait ---- ack ---- send ---- wait',
          '  pipelined       send send send send ---- ack ack ack ack',
        ].join('\n'),
      },
      {
        text: T(
          'So keep several in flight at once. A window says how many may be\nunacknowledged, and the whole design is what to do when one is lost.',
          'To ek saath kai chalte raho. Window batati hai kitne bina jawaab ke chal sakte hain,\naur poora design isi pe hai ki ek kho jaaye to karna kya hai.',
        ),
      },
      {
        text: T(
          'Go-Back-N throws away everything after the gap and re-sends it all.\nSelective Repeat keeps them and re-sends only what was lost.',
          'Go-Back-N gap ke baad ka sab phenk deta hai aur poora dobara bhejta hai.\nSelective Repeat unhe sambhaal leta hai aur sirf khoya hua dobara bhejta hai.',
        ),
      },
    ],
    hook: T(
      'One is simpler and wastes bandwidth. The other saves bandwidth and costs memory at both ends. Neither is the winner.',
      'Ek simple hai aur bandwidth barbaad karta hai. Doosra bandwidth bachata hai aur dono taraf memory maangta hai. Koi bhi vijeta nahi.',
    ),
    lab: 'arq',
    labSay: T(
      'Set a loss rate, then switch protocol. The losses stay identical, so the only thing that changed is the protocol.',
      'Loss rate set karo, phir protocol badlo. Losses bilkul wahi rehte hain, to badla sirf protocol hai.',
    ),
    points: [
      T('A wider window fills the wire. On a link with long delay, stop-and-wait leaves most of the capacity idle.',
        'Chaudi window taar ko bhar deti hai. Lambi deri wale link pe stop-and-wait zyadatar capacity khaali chhod deta hai.'),
      T('Go-Back-N needs one timer and no receiver buffer. Selective Repeat needs a timer per frame and a buffer at both ends.',
        'Go-Back-N ko ek timer chahiye aur receiver buffer bilkul nahi. Selective Repeat ko har frame ka timer chahiye aur dono taraf buffer.'),
      T('The window can never exceed half the sequence number space in Selective Repeat, or the receiver cannot tell a retransmission from a new frame.',
        'Selective Repeat me window kabhi sequence number space ke aadhe se zyada nahi ho sakti, warna receiver naye frame aur retransmission me farak nahi kar paayega.'),
      T('The textbook ordering assumes the acknowledgements get through. Lose those instead and Go-Back-N often wins, because its cumulative ACK repeats itself.',
        'Kitaab ka nateeja maanta hai ki acknowledgements pahunch rahe hain. Unhe khone do to aksar Go-Back-N jeet jaata hai, kyunki uska cumulative ACK khud ko dohraata rehta hai.'),
    ],
    challenge: {
      ask: T('At 25% loss, find a seed where Go-Back-N finishes sooner than Selective Repeat despite sending more. Explain how both can be true.',
        '25% loss pe aisa seed dhoondho jahan Go-Back-N zyada bhejne ke baawajood pehle khatam kare. Batao dono baatein saath sach kaise hain.'),
    },
    terms: ['acknowledgement', 'sequence number', 'packet loss', 'round trip', 'latency'],
  },

  // ── piggybacking ───────────────────────────────────────────────────────
  piggybacking: {
    title: T('Piggybacking', 'Piggybacking'),
    question: T(
      'Both sides are sending. Why send an acknowledgement in a frame of its own?',
      'Dono taraf se data ja raha hai. To acknowledgement ke liye alag frame kyun bhejna?',
    ),
    beats: [
      {
        text: T(
          'An acknowledgement is a handful of bits. Sent alone it still pays for a\nwhole frame: flags, addresses, a checksum, the lot.',
          'Acknowledgement mutthi bhar bits hai. Akele bhejo to bhi poori frame ki keemat lagti hai:\nflags, addresses, checksum, sab kuch.',
        ),
      },
      {
        text: T(
          'But the receiver usually has data of its own to send back. So it waits a\nmoment and puts the acknowledgement inside that frame instead.',
          'Par receiver ke paas aksar khud ka bhejne ko data hota hai. To wo zara ruk ke\nacknowledgement usi frame ke andar rakh deta hai.',
        ),
        art: [
          '  separate   [ ack ]  [ data ]        two frames, two sets of headers',
          '  piggyback  [ data + ack ]           one frame, one set',
        ].join('\n'),
      },
      {
        text: T(
          'A free ride. The only cost is the wait — and if nothing comes to carry it,\na timer fires and the acknowledgement goes on its own after all.',
          'Muft ki sawaari. Keemat sirf intezaar hai — aur agar le jaane ko kuch aaya hi nahi,\nto timer bajta hai aur acknowledgement akela hi chala jaata hai.',
        ),
      },
    ],
    hook: T(
      'The encapsulation lab has the number: on a small frame, headers are most of what you send. Piggybacking is refusing to pay that twice.',
      'Encapsulation lab me number likha hai: chhoti frame me zyadatar to headers hi jaate hain. Piggybacking wahi keemat do baar na dene ka faisla hai.',
    ),
    lab: 'layers',
    labSay: T(
      'Set the payload to a few bytes and read the overhead. That is what a lone acknowledgement costs.',
      'Payload ko kuch bytes pe le aao aur overhead padho. Akela acknowledgement itna hi kharch karta hai.',
    ),
    points: [
      T('The waiting timer is the whole design decision. Too short and you gain nothing; too long and the sender times out and re-sends.',
        'Poora faisla us intezaar wale timer ka hai. Bahut chhota rakho to kuch nahi milta; bahut bada rakho to sender timeout karke dobara bhej dega.'),
      T('It only works when traffic is two-way. A download is almost entirely one-way, so there is nothing to ride along with.',
        'Ye tabhi chalta hai jab traffic dono taraf ho. Download lagbhag poori tarah ek taraf ka hai, to sawaari ke liye kuch hota hi nahi.'),
      T('TCP does this constantly — the ACK field is in every segment header, whether or not it is carrying data.',
        'TCP ye hamesha karta hai — ACK field har segment ke header me hoti hai, chahe usme data ho ya na ho.'),
    ],
    challenge: {
      ask: T('Work out how many bytes two separate frames cost versus one piggybacked frame, using the numbers in the encapsulation lab.',
        'Encapsulation lab ke numbers se hisaab lagao ki do alag frames kitne bytes leti hain aur ek piggybacked frame kitne.'),
    },
    terms: ['acknowledgement', 'header', 'overhead', 'frame'],
  },

  // ── switching ──────────────────────────────────────────────────────────
  switching: {
    title: T('Switching and VLANs', 'Switching aur VLANs'),
    question: T(
      'Many machines, one network. How does a frame reach only the machine it is for?',
      'Kai machines, ek network. Frame sirf usi machine tak kaise pahunchti hai jiske liye hai?',
    ),
    beats: [
      {
        text: T(
          'A hub repeats every frame to every port. Everyone hears everything,\neveryone competes for the same wire, and nothing is private.',
          'Hub har frame har port pe dohra deta hai. Sab sab kuch sunte hain,\nsab ek hi taar ke liye ladte hain, aur kuch bhi private nahi.',
        ),
      },
      {
        text: T(
          'A switch reads the MAC address and sends the frame to one port. It learns\nwhich machine is where by watching who talks, and remembers.',
          'Switch MAC address padhta hai aur frame ek hi port pe bhejta hai. Kaun kahan hai\nye wo bolne walon ko dekh ke seekhta hai, aur yaad rakhta hai.',
        ),
        art: [
          '  hub     frame in -> out of every port      collisions, no privacy',
          '  switch  frame in -> out of one port        learned from the source',
        ].join('\n'),
      },
      {
        text: T(
          'A VLAN goes further: one physical switch, several networks that cannot\nsee each other, decided in software rather than by which cable you used.',
          'VLAN ek kadam aage: ek hi physical switch, kai networks jo ek doosre ko\ndekh hi nahi sakte, aur ye faisla cable se nahi, software se hota hai.',
        ),
      },
    ],
    hook: T(
      'Your machine has been talking to a switch this whole time, and the switch learned about it by listening.',
      'Tumhari machine is poore waqt ek switch se baat kar rahi thi, aur switch ne sun-sun ke uske baare me seekh liya.',
    ),
    lab: 'compare',
    labSay: T(
      'Hub, switch and router side by side — and the layer each one understands is the whole difference.',
      'Hub, switch aur router saath-saath — aur poora farak bas itna hai ki kaun kaunsi layer samajhta hai.',
    ),
    steps: [
      {
        say: T('Every device here reached you through a switch.', 'Yahan ka har device tum tak kisi switch se hi pahuncha hai.'),
        run: 'arp',
        after: T(
          'Your machine learned these the same way a switch does — by listening to who answered, and remembering.',
          'Tumhari machine ne inhe waise hi seekha jaise switch seekhta hai — kaun bola, wo sun ke yaad rakh liya.',
        ),
      },
    ],
    points: [
      T('A switch learns from the source address of every frame it forwards. Nobody configures the table; it fills itself.',
        'Switch har frame ke source address se seekhta hai. Table koi set nahi karta; wo khud bhar jaata hai.'),
      T('An unknown destination is flooded to every port, exactly like a hub — but only until the reply teaches it where that machine is.',
        'Anjaan destination har port pe bheja jaata hai, bilkul hub ki tarah — par sirf tab tak jab tak jawaab use na sikha de ki wo machine kahan hai.'),
      T('VLANs split one switch into several networks. Traffic between them has to go up to layer 3, which is where a router earns its place.',
        'VLAN ek switch ko kai networks me baant deta hai. Unke beech ka traffic layer 3 tak jaana padta hai, aur wahin router apni jagah banata hai.'),
      T('Switching is why a busy office network no longer collides. The collision domain shrank to one cable.',
        'Switching ki wajah se aaj bhare-poore office network me collision nahi hote. Collision domain sikud ke ek cable reh gaya.'),
    ],
    challenge: {
      ask: T('Two machines on the same switch but different VLANs want to talk. Which device has to get involved, and why?',
        'Ek hi switch pe do machines, par alag VLAN me, baat karna chahti hain. Kaunsa device beech me aana padega, aur kyun?'),
      run: 'arp',
    },
    terms: ['MAC address', 'frame', 'LAN', 'router', 'layer'],
  },
}
