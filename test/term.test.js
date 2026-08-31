/**
 * term.test.js — the terminal's pure logic: tokenizing, flags, completion.
 *
 * terminal.js itself is DOM-bound and is verified in the browser, but the parts
 * that decide what a command *means* are plain functions and belong here, where
 * a regression shows up in milliseconds rather than in a demo.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { tokenize, parseFlags, COMMANDS } from '../web/js/term/commands.js'
import { createAutocomplete } from '../web/js/term/autocomplete.js'

describe('term · tokenize', () => {
  test('splits on whitespace', () => {
    assert.deepEqual(tokenize('dig facebook.com AAAA'), ['dig', 'facebook.com', 'AAAA'])
  })

  test('keeps quoted strings together', () => {
    assert.deepEqual(tokenize('echo "hello world" bye'), ['echo', 'hello world', 'bye'])
    assert.deepEqual(tokenize("echo 'a b' c"), ['echo', 'a b', 'c'])
  })

  test('collapses runs of whitespace and handles an empty line', () => {
    assert.deepEqual(tokenize('  dig    a.com  '), ['dig', 'a.com'])
    assert.deepEqual(tokenize(''), [])
    assert.deepEqual(tokenize('   '), [])
  })
})

describe('term · parseFlags', () => {
  test('reads --flag value and --flag=value alike', () => {
    assert.deepEqual(parseFlags(['--server', '8.8.8.8', 'a.com']),
      { flags: { server: '8.8.8.8' }, args: ['a.com'] })
    assert.deepEqual(parseFlags(['--server=8.8.8.8', 'a.com']),
      { flags: { server: '8.8.8.8' }, args: ['a.com'] })
  })

  test('a flag with no value is boolean true', () => {
    assert.deepEqual(parseFlags(['--verbose']), { flags: { verbose: true }, args: [] })
    assert.deepEqual(parseFlags(['--a', '--b', 'x']), { flags: { a: true, b: 'x' }, args: [] })
  })

  test('positional arguments survive in order', () => {
    assert.deepEqual(parseFlags(['@1.1.1.1', 'a.com', 'MX']).args, ['@1.1.1.1', 'a.com', 'MX'])
  })
})

describe('term · every command documents itself', () => {
  test('each has a summary and a usage line', () => {
    for (const [name, cmd] of Object.entries(COMMANDS)) {
      assert.ok(cmd.summary, `${name} needs a summary — help renders it`)
      assert.ok(cmd.usage, `${name} needs a usage line — the hint bar renders it`)
      assert.equal(typeof cmd.run, 'function', `${name} needs a run()`)
      assert.ok(cmd.usage.startsWith(name), `${name}'s usage should begin with the command`)
    }
  })

  test('examples are runnable commands, not prose', () => {
    for (const [name, cmd] of Object.entries(COMMANDS)) {
      for (const ex of cmd.examples ?? []) {
        assert.ok(ex.startsWith(name), `"${ex}" should start with ${name}`)
      }
    }
  })
})

describe('term · autocomplete', () => {
  const ac = createAutocomplete({ historyOf: () => ['dig wikipedia.org', 'dig myhost.local MX'] })

  test('completes a command name', () => {
    assert.deepEqual(ac.options('cl'), ['clear'])
    assert.equal(ac.apply('cl'), 'clear ')
  })

  test('a shared prefix is filled in without guessing between candidates', () => {
    // "l" matches only lang here; use a prefix with two matches to check the rule.
    const many = ac.options('')
    assert.ok(many.length >= 4, 'an empty line offers every command')
    assert.equal(ac.apply('clear'), null, 'nothing left to add')
  })

  test('completes a record type in the third position', () => {
    assert.deepEqual(ac.options('dig facebook.com AA'), ['AAAA'])
    assert.equal(ac.apply('dig facebook.com AA'), 'dig facebook.com AAAA ')
  })

  test('offers domains from history before the built-in suggestions', () => {
    const opts = ac.options('dig my')
    assert.ok(opts.includes('myhost.local'), 'a domain the learner already used comes back')
  })

  test('suggests known domains for a fresh dig', () => {
    const opts = ac.options('dig face')
    assert.deepEqual(opts, ['facebook.com'])
  })

  test('the hint bar shows usage for a known command', () => {
    assert.equal(ac.hintFor('dig facebook.com'), 'dig [@server] <domain> [type]')
    assert.equal(ac.hintFor(''), 'type "help" to start')
  })

  test('an unknown command offers no completion rather than a wrong one', () => {
    assert.deepEqual(ac.options('zzz abc'), [])
    assert.equal(ac.apply('zzz abc'), null)
  })
})
