/**
 * narrate.js — the plain-language line under each timeline step.
 *
 * This is the single highest-leverage beginner feature in netlens: someone who
 * never opens the hex view can still follow the entire story from these lines.
 * They are templates rather than fixed strings so they can name the real server,
 * the real IP and the real timing that just happened.
 */

const T = {
  'dns.query': {
    en: ({ domain, server }) =>
      `Your computer does not know ${domain}'s number. So it asked the internet's phonebook at ${server}.`,
    hi: ({ domain, server }) =>
      `Tumhare computer ko ${domain} ka number nahi pata. Isliye usne internet ki phonebook (${server}) se poocha.`,
  },
  'dns.response': {
    en: ({ answer, ms }) =>
      answer
        ? `The phonebook answered in ${ms} ms: ${answer}. Your computer can now open a connection to that address.`
        : `The phonebook replied in ${ms} ms, but had no address to give.`,
    hi: ({ answer, ms }) =>
      answer
        ? `Phonebook ne ${ms} ms me jawab diya: ${answer}. Ab tumhara computer us address se connection bana sakta hai.`
        : `Phonebook ne ${ms} ms me jawab to diya, par koi address nahi mila.`,
  },
  'dns.nxdomain': {
    en: ({ domain }) => `There is no such name. ${domain} does not exist — nobody on the internet owns it.`,
    hi: ({ domain }) => `Aisa koi naam hai hi nahi. ${domain} exist nahi karta — internet pe iska koi maalik nahi.`,
  },
  'dns.nodata': {
    en: ({ domain, type }) => `${domain} exists, but it has no ${type} record. The name is fine; you asked for the wrong kind of thing.`,
    hi: ({ domain, type }) => `${domain} exist karta hai, par uska ${type} record nahi hai. Naam theek hai, tumne galat type maanga.`,
  },
  'dns.idmismatch': {
    en: ({ sent, got }) =>
      `A reply arrived and was thrown away. We asked with id ${sent}; this answer carried ${got}. That mismatch is exactly how a forged DNS reply gets rejected.`,
    hi: ({ sent, got }) =>
      `Jawab aaya aur reject kar diya gaya. Humne id ${sent} se poocha tha, jawab me ${got} aayi. Yahi mismatch fake DNS reply ko rok deta hai.`,
  },
  'dns.norecursion': {
    en: () => `You asked the server not to do the work (RD = 0), so it did not chase the answer for you.`,
    hi: () => `Tumne server se kaha tha ki kaam mat karo (RD = 0), isliye usne tumhare liye jawab nahi dhoonda.`,
  },
}

/**
 * @param {string} key  e.g. 'dns.query'
 * @param {object} vars
 * @param {'en'|'hi'} lang
 */
export function narrate(key, vars = {}, lang = 'en') {
  const entry = T[key]
  if (!entry) return ''
  return (entry[lang] ?? entry.en)(vars)
}

export const narrationKeys = () => Object.keys(T)
