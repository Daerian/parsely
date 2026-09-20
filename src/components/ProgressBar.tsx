import type { BudgetStatus } from '../lib/budgets'

const STATUS_COLOR: Record<BudgetStatus, string> = {
  under: 'bg-brand-500',
  near: 'bg-amber-500',
  over: 'bg-red-500',
}

export default function ProgressBar({ percent, status }: { percent: number; status: BudgetStatus }) {
  const width = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 100))
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
      <div className={`h-full rounded-full ${STATUS_COLOR[status]}`} style={{ width: `${width}%` }} />
    </div>
  )
}
