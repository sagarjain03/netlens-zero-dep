/**
 * The chapter registry. The only place that knows how many chapters exist.
 *
 * Everything else — the rail, the progress dots, the breadcrumb, the lesson
 * panel — reads this list. Adding chapter 9 means writing ch09.js and adding
 * one line here; no view changes at all.
 */
import ch01 from './ch01.js'
import ch02 from './ch02.js'
import ch03 from './ch03.js'
import ch04 from './ch04.js'
import ch05 from './ch05.js'
import ch06 from './ch06.js'
import ch07 from './ch07.js'
import ch08 from './ch08.js'

export const CHAPTERS = [ch01, ch02, ch03, ch04, ch05, ch06, ch07, ch08]

export const COUNT = CHAPTERS.length

/** Chapters are 1-indexed everywhere the learner can see them. */
export const chapter = (id) => CHAPTERS[id - 1] ?? CHAPTERS[0]
