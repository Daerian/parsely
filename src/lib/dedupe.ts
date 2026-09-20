/**
 * Deterministic hash for a transaction, used to skip re-importing the same
 * line item when a statement's date range overlaps a previous upload.
 * Amount is rounded to cents and the description is normalized so that
 * whitespace/casing differences between re-exports don't create duplicates.
 *
 * Runs in the browser, so it uses a plain FNV-1a 64-bit hash (via BigInt)
 * rather than Node's crypto module or the async Web Crypto API — this only
 * needs to be a fast, deterministic, low-collision key, not a secure digest,
 * and the household-scoped unique index is the real duplicate guard.
 */
export function dedupeHash(input: {
  accountId: string | null
  occurredOn: string // YYYY-MM-DD
  amount: number
  description: string
}): string {
  const normalizedDescription = normalizeDescription(input.description)
  const amountCents = Math.round(input.amount * 100)
  const key = `${input.accountId ?? 'none'}|${input.occurredOn}|${amountCents}|${normalizedDescription}`
  return fnv1a64(key)
}

const FNV_OFFSET_BASIS = 0xcbf29ce484222325n
const FNV_PRIME = 0x100000001b3n
const MASK_64 = 0xffffffffffffffffn

function fnv1a64(input: string): string {
  let hash = FNV_OFFSET_BASIS
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i))
    hash = (hash * FNV_PRIME) & MASK_64
  }
  return hash.toString(16).padStart(16, '0')
}

export function normalizeDescription(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}
