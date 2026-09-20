import { describe, expect, it } from 'vitest'
import { findMatch } from './matching'

describe('findMatch', () => {
  const candidates = [
    { id: 'a', occurredOn: '2026-01-05', amount: -42.5 },
    { id: 'b', occurredOn: '2026-01-07', amount: -42.5 },
    { id: 'c', occurredOn: '2026-01-05', amount: -10 },
  ]

  it('matches exact amount within the day window, preferring the closest date', () => {
    const result = findMatch({ occurredOn: '2026-01-06', amount: -42.5 }, candidates)
    expect(result?.id).toBe('a') // 1 day away vs 1 day away from 'b' too (tie -> first found kept)
  })

  it('returns null when amount does not match', () => {
    expect(findMatch({ occurredOn: '2026-01-05', amount: -99 }, candidates)).toBeNull()
  })

  it('returns null when date gap exceeds the window', () => {
    expect(findMatch({ occurredOn: '2026-01-20', amount: -42.5 }, candidates)).toBeNull()
  })

  it('ignores sign mismatches (a refund should not match a charge)', () => {
    expect(findMatch({ occurredOn: '2026-01-05', amount: 42.5 }, candidates)).toBeNull()
  })

  it('tolerates floating point noise in amount', () => {
    const result = findMatch({ occurredOn: '2026-01-05', amount: -42.500000002 }, candidates)
    expect(result?.id).toBe('a')
  })
})
