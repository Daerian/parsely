import { describe, expect, it } from 'vitest'
import { dedupeHash, normalizeDescription } from './dedupe'

describe('normalizeDescription', () => {
  it('lowercases and strips punctuation/whitespace variance', () => {
    expect(normalizeDescription('  TRADER JOE\'S #123  ')).toBe('trader joe s 123')
    expect(normalizeDescription('Trader Joes   #123')).toBe('trader joes 123')
  })
})

describe('dedupeHash', () => {
  const base = { accountId: 'acct-1', occurredOn: '2026-01-05', amount: -42.5, description: 'Trader Joe\'s #123' }

  it('is stable for identical input', () => {
    expect(dedupeHash(base)).toBe(dedupeHash({ ...base }))
  })

  it('is stable across whitespace/casing differences in description', () => {
    expect(dedupeHash(base)).toBe(dedupeHash({ ...base, description: "  TRADER JOE'S   #123  " }))
  })

  it('is stable across floating point rounding of amount', () => {
    expect(dedupeHash({ ...base, amount: -42.5 })).toBe(dedupeHash({ ...base, amount: -42.500000001 }))
  })

  it('differs when account differs', () => {
    expect(dedupeHash(base)).not.toBe(dedupeHash({ ...base, accountId: 'acct-2' }))
  })

  it('differs when date differs', () => {
    expect(dedupeHash(base)).not.toBe(dedupeHash({ ...base, occurredOn: '2026-01-06' }))
  })

  it('differs when amount differs', () => {
    expect(dedupeHash(base)).not.toBe(dedupeHash({ ...base, amount: -42.51 }))
  })

  it('differs when description differs meaningfully', () => {
    expect(dedupeHash(base)).not.toBe(dedupeHash({ ...base, description: 'Whole Foods' }))
  })
})
