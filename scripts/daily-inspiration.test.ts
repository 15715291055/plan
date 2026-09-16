import test from 'node:test'
import assert from 'node:assert/strict'
import { greetingFor, quoteFor } from '../src/lib/daily-inspiration'

test('greeting follows local time at every period boundary', () => {
  for (const [hour, minute, expected] of [
    [0, 0, '晚上好'], [4, 59, '晚上好'], [5, 0, '早上好'],
    [10, 59, '早上好'], [11, 0, '中午好'], [13, 59, '中午好'],
    [14, 0, '下午好'], [17, 59, '下午好'], [18, 0, '晚上好'], [23, 59, '晚上好'],
  ] as const) {
    assert.equal(greetingFor(new Date(2026, 8, 16, hour, minute)), expected)
  }
})

test('all 31 dates have distinct quotes that stay the same throughout the day', () => {
  const quotes = Array.from({ length: 31 }, (_, day) => {
    const morning = quoteFor(new Date(2026, 0, day + 1, 0, 0))
    assert.ok(morning.text && morning.author)
    assert.deepEqual(morning, quoteFor(new Date(2026, 0, day + 1, 23, 59)))
    return morning.text
  })
  assert.equal(new Set(quotes).size, 31)
})

test('quote cycle resets at each calendar month, including leap years and year end', () => {
  const first = quoteFor(new Date(2026, 0, 1))
  for (const lastDay of [new Date(2026, 1, 28), new Date(2028, 1, 29), new Date(2026, 3, 30), new Date(2026, 11, 31)]) {
    assert.ok(quoteFor(lastDay).text)
    const nextDay = new Date(lastDay)
    nextDay.setDate(nextDay.getDate() + 1)
    assert.deepEqual(quoteFor(nextDay), first)
    assert.notDeepEqual(quoteFor(lastDay), first)
  }
})
