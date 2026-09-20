/**
 * Matches a newly parsed receipt against existing statement transactions (or
 * vice versa) so the review screen can offer "attach line items to this
 * existing transaction" instead of creating a duplicate. A match requires an
 * exact amount (same sign) and a date within `maxDayGap` days — receipts are
 * often dated the day of purchase while the statement posts a day or two
 * later.
 */

const DEFAULT_MAX_DAY_GAP = 3

export interface MatchCandidate {
  id: string
  occurredOn: string // YYYY-MM-DD
  amount: number
}

export function findMatch<T extends MatchCandidate>(
  target: { occurredOn: string; amount: number },
  candidates: T[],
  maxDayGap = DEFAULT_MAX_DAY_GAP,
): T | null {
  const targetCents = Math.round(target.amount * 100)
  const targetDay = daysSinceEpoch(target.occurredOn)

  let best: T | null = null
  let bestGap = Infinity

  for (const candidate of candidates) {
    if (Math.round(candidate.amount * 100) !== targetCents) continue
    const gap = Math.abs(daysSinceEpoch(candidate.occurredOn) - targetDay)
    if (gap <= maxDayGap && gap < bestGap) {
      best = candidate
      bestGap = gap
    }
  }

  return best
}

function daysSinceEpoch(isoDate: string): number {
  return Math.floor(new Date(`${isoDate}T00:00:00Z`).getTime() / 86_400_000)
}
