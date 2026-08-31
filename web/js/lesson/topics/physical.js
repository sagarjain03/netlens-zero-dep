/**
 * physical.js — the Physical Layer module.
 *
 * The one module where a program can observe almost nothing directly. No
 * process gets to see a voltage, a wavelength or a modulation scheme.
 *
 * But the physical layer leaves one mark that is measurable from anywhere,
 * and it is the most important one: time. Light in fibre covers about 200 km
 * per millisecond and nothing changes that. So these topics measure delay,
 * and let the numbers say what the medium is doing — rather than describing
 * cables the learner cannot look at.
 */

const T = (en, hi) => ({ en, hi })

export default {
  // ── the layer ──────────────────────────────────────────────────────────
  'physical-layer': {
    title: T('The physical layer', 'Physical layer'),
    question: T(
      'Every layer above this one moves bits. Who turns a bit into something real?',
      'Iske upar ki har layer bits hilati hai. Bit ko asli cheez kaun banata hai?',
    ),
    beats: [
      {
        text: T(
          'Layer 1 is where a number stops being a number. A one becomes a voltage,\na pulse of light, or a change in a radio wave.',
          'Layer 1 wahan hai jahan number number rehna band karta hai. Ek one voltage ban jaata hai,\nroshni ki ek chamak, ya radio wave me ek badlaav.',
        ),
        art: [
          '  layer 2   here is a frame of bits',
          '  layer 1   here is 3.3 volts for 8 nanoseconds',
          '  the wire  does not know either of those words',
        ].join('\n'),
      },
      {
        text: T(
          'It has no idea what it is carrying. It cannot tell a frame from noise,\nwhich is exactly why layer 2 has to check whether what arrived is intact.',
          'Use pata hi nahi hota ki wo kya le jaa raha hai. Wo frame aur shor me farak nahi kar sakta,\naur isiliye layer 2 ko jaanchna padta hai ki jo aaya wo saabut hai ya nahi.',
        ),
      },
      {
        text: T(
          'No program can watch this layer. But it leaves one mark you can measure\nfrom anywhere, and it is the one that matters: time.',
          'Koi program is layer ko nahi dekh sakta. Par ye ek nishaan chhodti hai jise kahin se bhi\nnaapa ja sakta hai, aur wahi sabse zaroori hai: waqt.',
        ),
      },
    ],
    hook: T(
      'Light in fibre covers about 200 km every millisecond. That number is not negotiable, and you can measure it from here.',
      'Fibre me roshni har millisecond me lagbhag 200 km chalti hai. Ye number badla nahi ja sakta, aur ise yahin se naapa ja sakta hai.',
    ),
    steps: [
      {
        say: T('Measure something in the same building as you.', 'Kisi aisi cheez ko naapo jo tumhari hi building me hai.'),
        run: 'ping 1.1.1.1',
        after: T(
          'Whatever number came back, most of it is not processing. It is the time light took to get there and back.',
          'Jo bhi number aaya, uska zyadatar hissa processing nahi hai. Wo waqt hai jo roshni ko wahan jaane aur wapas aane me laga.',
        ),
      },
      {
        say: T('Now watch that time accumulate hop by hop.', 'Ab dekho wo waqt hop-dar-hop kaise jamta hai.'),
        run: 'tracert example.com',
        after: T(
          'Latency climbs as you go. Look for a step where it jumps far more than the others — that step is a long cable, and no equipment can shorten it.',
          'Aage badhne ke saath latency chadhti hai. Wo step dhoondho jahan wo baakiyon se kaafi zyada chhalaang lagati hai — wahi ek lamba cable hai, aur koi machine use chhota nahi kar sakti.',
        ),
      },
    ],
    points: [
      T('Bandwidth and latency are unrelated. A wider pipe carries more at once; it does not make anything arrive sooner, and only one of the two can be bought.',
        'Bandwidth aur latency ka aapas me koi rishta nahi. Chaudi pipe ek saath zyada le jaati hai; kuch jaldi nahi pahunchati, aur dono me se sirf ek khareedi ja sakti hai.'),
      T('Layer 1 defines connectors and voltages too, not just the medium. That is why a cable that fits may still not work — fitting is not the same as agreeing.',
        'Layer 1 connectors aur voltage bhi tay karti hai, sirf medium nahi. Isiliye jo cable fit ho jaaye wo bhi chal nahi sakta — fit hona raazi hona nahi hai.'),
      T('Everything above assumes this layer is unreliable, and every reliability mechanism in the stack exists because of that assumption.',
        'Upar ki har cheez maanti hai ki ye layer bharose ke laayak nahi, aur stack ka har bharosemandi wala tareeka isi maanyata ki wajah se hai.'),
    ],
    challenge: {
      ask: T('A server 2000 km away cannot answer faster than a certain time, no matter how fast its hardware. Work out roughly what that time is and why.',
        'Do hazaar km door ka server ek tay waqt se tez jawaab nahi de sakta, chahe uska hardware kitna bhi tez ho. Lagbhag wo waqt nikalo aur kaaran batao.'),
      run: 'ping 1.1.1.1',
    },
    terms: ['bit', 'latency', 'hop', 'frame', 'layer'],
  },

  // ── topology ───────────────────────────────────────────────────────────
  topology: {
    title: T('Network topology', 'Network topology'),
    question: T(
      'You have cable and machines. Does it matter how you connect them up?',
      'Tumhare paas cable hai aur machines. Kaise jodte ho isse farak padta hai?',
    ),
    beats: [
      {
        text: T(
          'It decides three things: how much cable you buy, who can overhear whom,\nand what happens when one of those cables is cut.',
          'Isse teen cheezein tay hoti hain: kitna cable khareedna padega, kaun kiski sun sakta hai,\naur un cables me se ek kat jaaye to hota kya hai.',
        ),
        art: [
          '  bus     one shared cable, everyone hears everything',
          '  star    one cable each, all to the middle',
          '  ring    a loop, so there are always two ways round',
          '  mesh    every pair joined, and the bill grows as the square',
        ].join('\n'),
      },
      {
        text: T(
          'Textbooks answer this with adjectives — reliable, expensive, easy to\nextend. None of those can be checked, and all of them can be computed.',
          'Kitaabein iska jawaab visheshanon se deti hain — bharosemand, mehnga, badhane me aasan.\nInme se koi jaanchne laayak nahi, aur sab ginne laayak hain.',
        ),
      },
      {
        text: T(
          'So compute them. Count the cables, cut one, and see who can still hear\nyou. The adjectives fall out of the graph on their own.',
          'To gino. Cables gino, ek kaato, aur dekho ab bhi kaun sun sakta hai.\nVisheshan graph se khud nikal aayenge.',
        ),
      },
    ],
    hook: T(
      'Cut a cable in a ring and everyone still hears you — the long way round. Cut one in a bus and it becomes two networks.',
      'Ring me ek cable kaato aur sab phir bhi sunte hain — lambe raaste se. Bus me kaato aur wo do networks ban jaata hai.',
    ),
    lab: 'topology',
    labSay: T(
      'Click a machine to send from it, then cut a cable and send again.',
      'Kisi machine pe click karke usse bhejo, phir ek cable kaat kar dobara bhejo.',
    ),
    points: [
      T('A mesh needs n(n-1)/2 cables. Six machines need fifteen; fifty need 1,225. That is why nobody wires a campus as a mesh.',
        'Mesh ko n(n-1)/2 cables chahiye. Chhe machines ko pandrah; pachaas ko 1,225. Isiliye koi campus ko mesh nahi banata.'),
      T('A ring costs exactly one cable more than a bus, and that one cable is what lets it survive a cut. Redundancy has a price and it is often small.',
        'Ring me bus se theek ek cable zyada lagta hai, aur wahi ek cable use katne ke baad bhi zinda rakhta hai. Redundancy ki keemat hoti hai, aur aksar chhoti hoti hai.'),
      T('Almost every real network today is a star, because a star fails the way people can tolerate: one broken cable is one broken machine.',
        'Aaj ka lagbhag har asli network star hai, kyunki star aise fail hota hai jo log jhel sakte hain: ek toota cable matlab ek machine gayi.'),
      T('Physical and logical topology are not the same. Wi-Fi is physically a shared medium like a bus, and is arranged logically as a star around the access point.',
        'Physical aur logical topology alag hain. Wi-Fi physically bus jaisa shared medium hai, aur logically access point ke around star ki tarah laga hota hai.'),
    ],
    challenge: {
      ask: T('In the lab, find the topology where cutting any single cable still leaves everyone connected, and the one where it never does. Explain the cable count difference.',
        'Lab me wo topology dhoondho jahan koi bhi ek cable katne ke baad bhi sab jude rehte hain, aur wo jahan kabhi nahi. Cables ki ginti ka farak samjhao.'),
    },
    terms: ['LAN', 'frame', 'router', 'MAC address'],
  },

  // ── transmission ───────────────────────────────────────────────────────
  transmission: {
    title: T('Transmission modes and media', 'Transmission modes aur media'),
    question: T(
      'Copper, glass and radio all carry the same bits. So why pick one over another?',
      'Taamba, kaanch aur radio — teeno wahi bits le jaate hain. To ek ko doosre pe kyun chunna?',
    ),
    beats: [
      {
        text: T(
          'Direction first. Simplex goes one way only, half duplex takes turns, and\nfull duplex sends and receives at the same time.',
          'Pehle disha. Simplex sirf ek taraf jaata hai, half duplex bari-bari se, aur\nfull duplex ek hi waqt me bhejta aur leta hai.',
        ),
        art: [
          '  simplex       ---------->            a broadcast',
          '  half duplex   ----> then <----       a walkie-talkie',
          '  full duplex   <---------->           a phone call',
        ].join('\n'),
      },
      {
        text: T(
          'Then the medium, and each is a trade. Copper is cheap and picks up\ninterference. Glass is fast and far and will not bend. Radio needs no cable\nand is shared with everybody near you.',
          'Phir medium, aur har ek ek sauda hai. Taamba sasta hai aur interference pakadta hai.\nKaanch tez hai, door tak jaata hai aur mudta nahi. Radio ko cable nahi chahiye\naur wo aas-paas ke sabke saath baanta jaata hai.',
        ),
      },
      {
        text: T(
          'None of them beats the speed of light, and none of them beats distance.\nThat limit is the same for all three, and it is the one you can measure.',
          'Inme se koi roshni ki raftaar nahi haraata, aur koi doori nahi haraata.\nYe seema teeno ke liye ek hai, aur yahi wo hai jise tum naap sakte ho.',
        ),
      },
    ],
    hook: T(
      'Wi-Fi is half duplex and shares the air with your neighbours. A cable is full duplex and shares with nobody. That difference is measurable from here.',
      'Wi-Fi half duplex hai aur hawa padosiyon ke saath baantta hai. Cable full duplex hai aur kisi ke saath nahi baantta. Ye farak yahin se naapa ja sakta hai.',
    ),
    steps: [
      {
        say: T('Measure the first link — the one between you and your router.', 'Pehla link naapo — tumhare aur router ke beech wala.'),
        run: 'ifconfig',
        after: T(
          'Note whether your interface is wireless or wired. That first hop is the only part of the path whose medium you actually control.',
          'Dekho tumhara interface wireless hai ya wired. Poore raaste me sirf usi pehle hop ka medium tumhare haath me hai.',
        ),
      },
      {
        say: T('Now measure it, several times over.', 'Ab use naapo, kai baar.'),
        run: 'ping 1.1.1.1',
        after: T(
          'Watch how much the numbers vary between one reply and the next. On radio they usually wander more than on a cable, because the air is shared and a cable is not.',
          'Dekho ek jawaab se doosre me number kitna oopar-neeche hota hai. Radio pe wo aksar cable se zyada bhatakta hai, kyunki hawa baanti jaati hai aur cable nahi.',
        ),
      },
      {
        say: T('Now go far enough that the medium stops being the story.', 'Ab itna door jao ki medium ki baat hi na rahe.'),
        run: 'tracert example.com',
        after: T(
          'Past a few hops, the delay is distance and nothing else. Whatever the first link was made of stops mattering very quickly.',
          'Kuch hops ke baad deri sirf doori hai, aur kuch nahi. Pehla link kis cheez ka tha, ye bahut jaldi bemaani ho jaata hai.',
        ),
      },
    ],
    points: [
      T('Fibre wins on distance because light in glass loses very little. Copper needs a repeater every hundred metres or so; fibre can run for tens of kilometres.',
        'Fibre doori pe jeetta hai kyunki kaanch me roshni bahut kam khoti hai. Taambe ko har sau meter pe repeater chahiye; fibre dason kilometre chal sakta hai.'),
      T('Twisting a pair of copper wires cancels most of the interference they pick up. That trick is the entire reason the cable is called twisted pair.',
        'Taambe ke do taaron ko aapas me maroda jaaye to unpe aane wala zyadatar interference kat jaata hai. Isi jugaad ki wajah se cable ka naam twisted pair hai.'),
      T('Radio is a shared medium, so two devices transmitting at once collide. Wi-Fi spends real time avoiding that, which is part of why it is slower than its rated speed.',
        'Radio shared medium hai, isliye do device ek saath bhejein to takraav hota hai. Wi-Fi usse bachne me asli waqt lagata hai, aur isi wajah se wo apni likhi hui speed se dheema hota hai.'),
      T('Bandwidth is what you buy; latency is what you are given. Doubling the first changes how much fits at once, and never how soon anything arrives.',
        'Bandwidth khareedi jaati hai; latency mil jaati hai. Pehli ko dugna karo to ek saath zyada samaata hai, par kuch bhi jaldi nahi pahunchta.'),
    ],
    challenge: {
      ask: T('Run the ping several times on Wi-Fi and note how much the numbers move. Say which part of that variation is the medium and which part is distance.',
        'Wi-Fi pe ping kai baar chalao aur dekho number kitna hilte hain. Batao us hilne ka kaunsa hissa medium hai aur kaunsa doori.'),
      run: 'ping 1.1.1.1',
    },
    terms: ['latency', 'bit', 'LAN', 'hop'],
  },
}
