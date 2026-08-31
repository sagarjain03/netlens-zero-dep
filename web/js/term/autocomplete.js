/**
 * autocomplete.js — Tab completion and the inline usage hint.
 *
 * Both read the same COMMANDS declarations the help text does, so a command can
 * never drift out of sync with its own completion.
 */
import { COMMANDS, tokenize } from './commands.js'

const DOMAIN_SUGGESTIONS = [
  'facebook.com', 'cloudflare.com', 'google.com', 'wikipedia.org',
  'github.com', 'example.com', 'youtube.com', 'gmail.com',
]

export function createAutocomplete({ historyOf }) {
  /** Candidate completions for the token under the caret. */
  function options(input) {
    const tokens = tokenize(input)
    const trailingSpace = /\s$/.test(input)
    const index = trailingSpace ? tokens.length : tokens.length - 1
    const partial = trailingSpace ? '' : (tokens[tokens.length - 1] ?? '')

    // first token → command name
    if (index <= 0) {
      return Object.entries(COMMANDS)
        .filter(([name, c]) => !c.hidden && name.startsWith(partial.toLowerCase()))
        .map(([name]) => name)
    }

    const cmd = COMMANDS[tokens[0]?.toLowerCase()]
    if (!cmd) return []

    // command-specific arguments (record types, and so on)
    const own = cmd.completeArg?.(index, partial) ?? []
    if (own.length) return own

    // first argument of a network command → a domain worth trying
    if (index === 1 && cmd.usage.includes('<domain>')) {
      const fromHistory = historyOf()
        .flatMap((line) => tokenize(line).slice(1))
        .filter((t) => t.includes('.') && !t.startsWith('@'))
      const pool = [...new Set([...fromHistory, ...DOMAIN_SUGGESTIONS])]
      return pool.filter((d) => d.startsWith(partial))
    }

    return []
  }

  /**
   * Complete the current token.
   * @returns {string|null} the new line, or null when there is nothing unambiguous to add
   */
  function apply(input) {
    const matches = options(input)
    if (!matches.length) return null

    const shared = commonPrefix(matches)
    const tokens = tokenize(input)
    const trailingSpace = /\s$/.test(input)
    const partial = trailingSpace ? '' : (tokens[tokens.length - 1] ?? '')
    if (shared.length <= partial.length) return null

    const head = trailingSpace ? input : input.slice(0, input.length - partial.length)
    // A single match is finished, so add the space that starts the next argument.
    return head + shared + (matches.length === 1 ? ' ' : '')
  }

  /** The greyed-out usage text beside the prompt. */
  function hintFor(input) {
    const tokens = tokenize(input)
    if (!tokens.length) return 'type "help" to start'

    const name = tokens[0].toLowerCase()
    const cmd = COMMANDS[name]
    if (!cmd) {
      const partials = Object.keys(COMMANDS).filter((c) => c.startsWith(name))
      return partials.length ? partials.join(' ') : ''
    }
    return cmd.usage
  }

  return { options, apply, hintFor }
}

function commonPrefix(list) {
  if (!list.length) return ''
  let prefix = list[0]
  for (const s of list.slice(1)) {
    let i = 0
    while (i < prefix.length && i < s.length && prefix[i] === s[i]) i++
    prefix = prefix.slice(0, i)
  }
  return prefix
}
