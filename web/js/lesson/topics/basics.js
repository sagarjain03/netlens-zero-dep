/**
 * basics.js — the Computer Networks module.
 *
 * First in the rail and written last, on purpose. An introduction is much
 * easier to write once you know what it has to introduce, and these four
 * topics can now point forward at real things rather than at promises.
 *
 * The temptation in this module is to open with definitions. It does not:
 * every topic starts from something already true of the machine the learner
 * is sitting at, and the definition arrives afterwards as a name for it.
 */

const T = (en, hi) => ({ en, hi })

export default {
  // ── what a network is ──────────────────────────────────────────────────
  'what-is-a-network': {
    title: T('What a network is', 'Network hota kya hai'),
    question: T(
      'Before anything else: what has to be true before two machines can talk?',
      'Sabse pehle: do machines ke baat karne se pehle sach kya hona chahiye?',
    ),
    beats: [
      {
        text: T(
          'Three things, and nothing more. A way to carry a signal, an agreement\nabout what the signal means, and a name for each end.',
          'Teen cheezein, bas. Signal le jaane ka koi tareeka, us signal ka matlab kya hai iska\nsamjhauta, aur dono siron ke naam.',
        ),
        art: [
          '  something to carry it     cable, radio, fibre',
          '  something to mean it      a protocol both ends know',
          '  something to name it      an address at each end',
        ].join('\n'),
      },
      {
        text: T(
          'Two machines with a cable between them are a network. Everything after\nthat is the same idea repeated until it covers the planet.',
          'Do machines aur beech me ek cable — wo bhi network hai. Uske baad sab kuch wahi idea hai,\ndohraya jaata hua, jab tak wo poori duniya na dhak le.',
        ),
      },
      {
        text: T(
          'Which is why the hard problems are not about wires. They are about scale:\nfinding things, agreeing on meaning, and coping when a piece fails.',
          'Isiliye asli mushkilein taaron ki nahi hain. Wo naap ki hain: cheezein dhoondhna,\nmatlab pe raazi hona, aur koi hissa fail ho to sambhalna.',
        ),
      },
    ],
    hook: T(
      'You are already on one. Your machine knows its own name on it, and the names of the neighbours it has met.',
      'Tum pehle se ek network pe ho. Tumhari machine uspe apna naam jaanti hai, aur jin padosiyon se mili hai unke naam bhi.',
    ),
    steps: [
      {
        say: T('Ask your machine what its name is on this network.', 'Apni machine se poochho is network pe uska naam kya hai.'),
        run: 'ifconfig',
        after: T(
          'An address, a mask and a gateway. That is the whole of "you are on a network" as far as your computer is concerned.',
          'Ek address, ek mask aur ek gateway. Tumhare computer ke liye "tum network pe ho" ka poora matlab yahi hai.',
        ),
      },
      {
        say: T('Now ask which neighbours it has actually met.', 'Ab poochho ki asal me kaun se padosi mile hain.'),
        run: 'arp',
        after: T(
          'Every line is a machine that answered. Your computer did not have this list when it started — it built it by talking.',
          'Har line ek machine hai jisne jawaab diya. Shuru me tumhare computer ke paas ye list nahi thi — usne baat karke banayi.',
        ),
      },
    ],
    points: [
      T('LAN, MAN and WAN are names for size, not for different technology. The same ideas run at every scale; only the distances and the owners change.',
        'LAN, MAN aur WAN naap ke naam hain, alag technology ke nahi. Wahi ideas har naap pe chalte hain; sirf doori aur maalik badalte hain.'),
      T('A network is defined by reachability, not by geography. Two machines in one room on different networks are further apart than two continents on the same one.',
        'Network pahunch se banta hai, bhugol se nahi. Ek hi kamre ki do machines agar alag networks pe hain to wo ek hi network ke do mahadweep se zyada door hain.'),
      T('Nothing in a network is guaranteed by the wire. Every promise you rely on — order, delivery, secrecy — is made by software above it.',
        'Network me taar kisi cheez ki guarantee nahi deta. Jitne waade tum maante ho — kram, pahunchna, gopniyata — sab uske upar ke software karte hain.'),
    ],
    challenge: {
      ask: T('Your machine found its neighbours without being told about them. Describe what it must have sent, and why every machine on the network had to hear it.',
        'Tumhari machine ne bina bataye apne padosi dhoondh liye. Batao usne kya bheja hoga, aur network ki har machine ko wo sunna kyun zaroori tha.'),
      run: 'arp',
    },
    terms: ['LAN', 'IP address', 'MAC address', 'gateway', 'protocol', 'ARP'],
  },

  // ── the internet ───────────────────────────────────────────────────────
  internet: {
    title: T('The internet', 'Internet'),
    question: T(
      'Your network reaches your house. So what is the thing that reaches everywhere?',
      'Tumhara network ghar tak pahunchta hai. To wo cheez kya hai jo har jagah pahunchti hai?',
    ),
    beats: [
      {
        text: T(
          'The internet is not a network. It is an agreement between about a\nhundred thousand separate networks to carry each other’s traffic.',
          'Internet koi network nahi hai. Ye lagbhag ek laakh alag networks ke beech ka samjhauta hai\nki ek doosre ka traffic le jaayenge.',
        ),
        art: [
          '  your network -> your ISP -> a bigger ISP -> ... -> their network',
          '  each one is owned by someone different',
          '  none of them can see the whole thing',
        ].join('\n'),
      },
      {
        text: T(
          'Nobody runs it and nobody owns it. What holds it together is that every\none of those networks speaks IP, and agrees to pass on what is not theirs.',
          'Na koi ise chalata hai, na koi maalik hai. Ise jodne wali cheez ye hai ki un sab networks me\nse har ek IP bolta hai, aur jo uska nahi hai use aage bhejne pe raazi hai.',
        ),
      },
      {
        text: T(
          'Which is why it survives things breaking. There is no centre to fail —\nonly a lot of independent decisions that route around the damage.',
          'Isiliye ye tootne ke baad bhi chalta rehta hai. Fail hone ko koi kendra hai hi nahi —\nbas bahut saare alag faisle jo nuksaan ke around raasta nikaal lete hain.',
        ),
      },
    ],
    hook: T(
      'You can watch the ownership change hands. Every trace crosses from your ISP into somebody else’s network, and you can see where.',
      'Tum maalikana haq badalte dekh sakte ho. Har trace tumhare ISP se nikal kar kisi aur ke network me jaata hai, aur kahan jaata hai ye dikhta hai.',
    ),
    steps: [
      {
        say: T('Follow one packet out of your house and into other people’s networks.', 'Ek packet ko ghar se nikal kar doosron ke networks me jaate dekho.'),
        run: 'tracert 1.1.1.1',
        after: T(
          'The first hop is yours. The next few belong to your ISP. Somewhere after that you are in a network nobody you have ever met is responsible for.',
          'Pehla hop tumhara hai. Uske baad ke kuch tumhare ISP ke. Uske aage kahin tum us network me ho\njiski zimmedari tumse mile kisi bhi shakhs ki nahi hai.',
        ),
      },
      {
        say: T('Try a different destination and compare where the paths diverge.', 'Doosra destination try karo aur dekho raaste kahan alag hote hain.'),
        run: 'tracert example.com',
        after: T(
          'The early hops are usually the same and the later ones are not. That branch point is where your ISP stops knowing and hands the decision on.',
          'Shuru ke hops aksar wahi hote hain aur baad wale nahi. Wahi mod wo jagah hai jahan tumhara ISP\njaanna band karta hai aur faisla aage saunp deta hai.',
        ),
      },
    ],
    points: [
      T('An autonomous system is one of those independently run networks. BGP is how they tell each other what they can reach, and its choices are commercial as much as technical.',
        'Autonomous system unme se ek alag chalne wala network hai. BGP se wo ek doosre ko batate hain kahan tak pahunch sakte hain, aur uske faisle jitne technical hain utne hi vyaparik.'),
      T('The internet and the web are not the same thing. The web is one application running on it, and email, video calls and this app are others.',
        'Internet aur web ek cheez nahi hain. Web usme chalne wali ek application hai, aur email, video call aur ye app doosri.'),
      T('Its resilience is a side effect of having no centre. That same property is why nobody can switch it off, and why nobody can fix it centrally either.',
        'Iski mazbooti kendra na hone ka side effect hai. Isi wajah se ise koi band nahi kar sakta, aur isi wajah se koi kendra se theek bhi nahi kar sakta.'),
    ],
    challenge: {
      ask: T('Trace two destinations and find the last hop they share. What does that machine belong to, and why is it the same for both?',
        'Do destinations trace karo aur wo aakhri hop dhoondho jo dono me same hai. Wo machine kiski hai, aur dono ke liye same kyun hai?'),
      run: 'tracert 1.1.1.1',
    },
    terms: ['ISP', 'router', 'IP address', 'hop', 'IX', 'protocol'],
  },

  // ── devices ────────────────────────────────────────────────────────────
  devices: {
    title: T('Network devices', 'Network devices'),
    question: T(
      'A hub, a switch and a router all have cables going into them. What makes them different?',
      'Hub, switch aur router — teeno me cable lagte hain. Farak kya hai?',
    ),
    beats: [
      {
        text: T(
          'Which layer the box understands. That is the entire difference, and\neverything else about them follows from it.',
          'Ye ki dabba kaunsi layer samajhta hai. Poora farak yahi hai, aur unki baaki har baat\nisi se nikalti hai.',
        ),
        art: [
          '  hub      layer 1   understands nothing, repeats everything',
          '  switch   layer 2   understands MAC, sends to one port',
          '  router   layer 3   understands IP, joins networks',
        ].join('\n'),
      },
      {
        text: T(
          'A hub cannot read an address at all, so it shouts everything to everyone.\nA switch reads the MAC and sends the frame to exactly one port.',
          'Hub address padh hi nahi sakta, isliye wo sab kuch sabko chilla deta hai.\nSwitch MAC padhta hai aur frame theek ek port pe bhejta hai.',
        ),
      },
      {
        text: T(
          'Only the router understands addresses on a network that is not its own.\nThat is why it is the one thing that can get you off your own network.',
          'Sirf router hi us network ke address samajhta hai jo uska apna nahi hai.\nIsiliye tumhe apne network se bahar nikaalne wali ekmatra cheez wahi hai.',
        ),
      },
    ],
    hook: T(
      'Both of them are in the room with you. The switch taught itself where you are; the router is the address your machine calls the gateway.',
      'Dono tumhare kamre me hain. Switch ne khud seekh liya tum kahan ho; router wahi address hai jise tumhari machine gateway kehti hai.',
    ),
    lab: 'compare',
    labSay: T(
      'The three side by side, with the layer each one understands in the first row.',
      'Teeno saath-saath, aur pehli row me ye ki har ek kaunsi layer samajhta hai.',
    ),
    steps: [
      {
        say: T('Find the router, by the name your machine gives it.', 'Router dhoondho, usi naam se jo tumhari machine use deti hai.'),
        run: 'ifconfig',
        after: T(
          'The gateway address is your router. Everything your machine cannot reach directly is handed to that one address.',
          'Gateway address hi tumhara router hai. Jahan tumhari machine seedha nahi pahunch sakti, sab kuch usi ek address ko de diya jaata hai.',
        ),
      },
      {
        say: T('Now see what the switch let you talk to directly.', 'Ab dekho switch ne kis-kis se seedha baat karwayi.'),
        run: 'arp',
        after: T(
          'These needed no router. They are on your side of it, and the switch delivered each frame to one port rather than shouting it at everyone.',
          'Inke liye router ki zaroorat nahi padi. Ye router ke tumhari taraf wale hisse me hain, aur switch ne har frame ek port pe pahunchaya, sabko chillaya nahi.',
        ),
      },
    ],
    points: [
      T('A switch learns by listening. It reads the source address of every frame it forwards and remembers which port it came from — nobody configures the table.',
        'Switch sun kar seekhta hai. Jo bhi frame aage bhejta hai uska source address padh leta hai aur yaad rakhta hai wo kis port se aaya — table koi set nahi karta.'),
      T('Modern home equipment is all three boxes in one case. The parts are still separate inside, working at their separate layers.',
        'Aaj ke ghar ke equipment me teeno dabbe ek hi case me hote hain. Andar hisse ab bhi alag hain, apni-apni layer pe kaam karte hue.'),
      T('An access point is a switch whose cable is radio. Everything about layer 2 is the same; only the way the signal is carried changed.',
        'Access point ek aisa switch hai jiska cable radio hai. Layer 2 ki har baat wahi hai; sirf signal le jaane ka tareeka badla.'),
      T('Hubs are not sold any more. They wasted the wire and let anyone read anyone, and a switch fixed both by understanding one layer more.',
        'Hub ab bikte nahi. Wo taar bhi barbaad karte the aur kisi ko bhi kisi ka padhne dete the, aur switch ne ek layer zyada samajh kar dono theek kar diye.'),
    ],
    challenge: {
      ask: T('Your machine reaches a neighbour and a server abroad. Say which devices each packet passes through, and where the second one needs something the first does not.',
        'Tumhari machine ek padosi tak pahunchti hai aur ek videshi server tak. Batao har packet kin devices se guzarta hai, aur doosre ko wo kya chahiye jo pehle ko nahi.'),
      run: 'ifconfig',
    },
    terms: ['router', 'gateway', 'MAC address', 'LAN', 'frame', 'layer'],
  },

  // ── the models ─────────────────────────────────────────────────────────
  models: {
    title: T('OSI and TCP/IP', 'OSI aur TCP/IP'),
    question: T(
      'Everyone draws the same stack of boxes. What is the stack actually for?',
      'Sab wahi dabbon ka dher banate hain. Wo dher hai kis kaam ka?',
    ),
    beats: [
      {
        text: T(
          'A network has to do many jobs at once. The models split those jobs so\nthat each one can be solved, and replaced, without touching the others.',
          'Network ko ek saath kai kaam karne hote hain. Model un kaamon ko baant dete hain taaki\nhar ek alag se hal ho sake, aur badla ja sake, baaki ko chhue bina.',
        ),
        art: [
          '  swap Wi-Fi for a cable       layer 2 changes, nothing above notices',
          '  move the server abroad       layer 3 changes, nothing else does',
          '  swap HTTP for a chat app     layer 7 changes, nothing below does',
        ].join('\n'),
      },
      {
        text: T(
          'That substitution is the payoff, and it is not theoretical. It is the\nreason the internet survived the arrival of Wi-Fi, of fibre, and of HTTPS.',
          'Yahi badalne ki suvidha asli fayda hai, aur ye kitaabi baat nahi. Isi ki wajah se internet\nWi-Fi, fibre aur HTTPS ke aane ke baad bhi chalta raha.',
        ),
      },
      {
        text: T(
          'OSI has seven layers and TCP/IP has four. The internet runs on the four;\nthe seven are what you will be examined on.',
          'OSI me saat layers hain aur TCP/IP me chaar. Internet chaar pe chalta hai;\nexam saat pe hoga.',
        ),
      },
    ],
    hook: T(
      'The layers are not a diagram. They are bytes, and you can count them: each one wraps the last in a header of its own.',
      'Layers koi diagram nahi hain. Wo bytes hain, aur unhe gina ja sakta hai: har ek pichhli ko apne header me lapetti hai.',
    ),
    lab: 'layers',
    labSay: T(
      'Drag the payload size and watch the envelopes stay the same while their share of the total changes.',
      'Payload ka size ghumao aur dekho lifaafe wahi rehte hain jabki total me unka hissa badalta hai.',
    ),
    steps: [
      {
        say: T('Watch four layers fire in order for one page.', 'Ek page ke liye chaar layers ko kram se chalte dekho.'),
        run: 'journey https://example.com',
        after: T(
          'DNS, routing, TCP, TLS, HTTP — each one is a different layer doing its own job, and the timeline is them in order.',
          'DNS, routing, TCP, TLS, HTTP — har ek alag layer apna kaam karti hui, aur timeline unhe kram me dikhati hai.',
        ),
      },
    ],
    points: [
      T('OSI was designed by committee before the code; TCP/IP was described after the code already worked. Most of the difference between them is that.',
        'OSI code se pehle committee ne design kiya; TCP/IP tab likha gaya jab code chal chuka tha. Dono ka zyadatar farak yahi hai.'),
      T('Layers 5 and 6 exist in OSI and in almost no implementation. Nobody tells you that, and it is the most useful thing to know about the model.',
        'Layer 5 aur 6 OSI me hain aur lagbhag kisi implementation me nahi. Ye koi nahi batata, aur model ke baare me sabse kaam ki baat yahi hai.'),
      T('The model is a filing system for things you already understand. Presented before you understand them, it is seven meaningless words — which is why this app puts them in chapter 8, not chapter 1.',
        'Model un cheezon ka filing system hai jo tum pehle se samajhte ho. Samajhne se pehle dikha do to ye saat bemaani shabd hain — isiliye ye app unhe chapter 8 me rakhta hai, chapter 1 me nahi.'),
    ],
    challenge: {
      ask: T('Name the layer you would change to move a service to another country, and the one you would change to stop anyone on the path reading it.',
        'Wo layer batao jise badal kar service doosre desh le jaaoge, aur wo jise badal kar raaste me kisi ko padhne se rokoge.'),
      run: 'journey https://example.com',
    },
    terms: ['OSI model', 'TCP/IP model', 'layer', 'encapsulation', 'header', 'payload'],
  },
}
