/**
 * api/decode.js — decode bytes without sending them.
 *
 * This is what makes the byte editor feel immediate. As a learner edits a byte
 * the page asks for a fresh parse, so `QTYPE 1 (A)` becomes `QTYPE 28 (AAAA)`
 * on screen *before* anything leaves the machine. Only then do they press
 * re-send and watch the real answer come back.
 *
 * It also keeps the codec in one place: the browser never needs a second copy
 * of the parser, so there is no chance of the two disagreeing.
 */
import { decode as decodeDns } from '../proto/dns.js'
import { packet, sendJson } from '../server/respond.js'
import { hexToBytes } from '../shared/bytes.js'

const DECODERS = {
  dns: { decode: decodeDns, label: 'DNS/UDP', min: 12 },
}

export async function handleDecode({ res, body }) {
  const proto = String(body.proto ?? 'dns').toLowerCase()
  const decoder = DECODERS[proto]
  if (!decoder) throw new Error(`no decoder for "${proto}"`)

  if (!body.hex) throw new Error('hex is required')
  const bytes = hexToBytes(body.hex)
  if (bytes.length < decoder.min) {
    throw new Error(`${proto.toUpperCase()} needs at least ${decoder.min} bytes, got ${bytes.length}`)
  }
  if (bytes.length > 4096) throw new Error(`${bytes.length} bytes is too large to decode`)

  const lang = body.lang === 'hi' ? 'hi' : 'en'
  const msg = decoder.decode(bytes, { lang })

  sendJson(res, {
    ok: true,
    packet: packet({
      id: body.id ?? 'draft',
      dir: body.dir ?? 'out',
      proto: decoder.label,
      bytes,
      tree: msg.tree,
      editable: true,
      note: msg.truncatedParse ?? '',
    }),
    // A summary the editor can show inline without walking the tree itself.
    summary: summarise(proto, msg),
  })
}

function summarise(proto, msg) {
  if (proto !== 'dns') return {}
  return {
    id: msg.header?.id ?? null,
    question: msg.question ? `${msg.question.name} ${msg.question.typeName}` : null,
    rcode: msg.header?.rcode ?? null,
    answers: msg.answers?.length ?? 0,
    parseError: msg.truncatedParse ?? null,
  }
}
