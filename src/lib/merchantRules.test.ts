import { describe, expect, it } from 'vitest'
import { matchMerchantRule, toMerchantPattern } from './merchantRules'

describe('matchMerchantRule', () => {
  const rules = [
    { merchantPattern: toMerchantPattern('Trader Joes'), categoryId: 'groceries' },
    { merchantPattern: toMerchantPattern('Shell Oil'), categoryId: 'transport' },
  ]

  it('matches an exact normalized merchant', () => {
    expect(matchMerchantRule(rules, 'trader joes')).toBe('groceries')
  })

  it('matches when the description contains the pattern', () => {
    expect(matchMerchantRule(rules, 'TRADER JOES #456 SEATTLE WA')).toBe('groceries')
  })

  it('returns null when nothing matches', () => {
    expect(matchMerchantRule(rules, 'Netflix')).toBeNull()
  })
})
