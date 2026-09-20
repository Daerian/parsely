const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatMoney(amount: number): string {
  return currencyFormatter.format(amount)
}

export function formatMonthLabel(monthDate: string): string {
  const [year, month] = monthDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function currentMonthStart(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

export function daysInMonth(monthDate: string): number {
  const [year, month] = monthDate.split('-').map(Number)
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}
