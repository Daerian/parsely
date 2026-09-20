import { normalizeDescription } from './dedupe'

export interface MerchantRule {
  merchantPattern: string // already normalized
  categoryId: string
}

/**
 * Looks up a learned category for a merchant/description, so repeat
 * purchases from the same place get auto-categorized consistently even when
 * the AI's per-document guess varies.
 */
export function matchMerchantRule(rules: MerchantRule[], merchantOrDescription: string): string | null {
  const normalized = normalizeDescription(merchantOrDescription)
  const rule = rules.find((r) => normalized === r.merchantPattern || normalized.includes(r.merchantPattern))
  return rule?.categoryId ?? null
}

export function toMerchantPattern(merchantOrDescription: string): string {
  return normalizeDescription(merchantOrDescription)
}
