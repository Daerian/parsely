import { ChevronLeft, ChevronRight } from 'lucide-react'
import { dateStringToMonth, monthToDateString, shiftMonth } from '../lib/budgets'
import { formatMonthLabel } from '../lib/format'

export default function MonthNav({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const key = dateStringToMonth(month)
  return (
    <div className="flex items-center justify-between">
      <button
        aria-label="Previous month"
        onClick={() => onChange(monthToDateString(shiftMonth(key, -1)))}
        className="rounded-full p-2 text-stone-500 hover:bg-stone-100 active:bg-stone-200"
      >
        <ChevronLeft size={20} />
      </button>
      <span className="text-base font-semibold text-stone-800">{formatMonthLabel(month)}</span>
      <button
        aria-label="Next month"
        onClick={() => onChange(monthToDateString(shiftMonth(key, 1)))}
        className="rounded-full p-2 text-stone-500 hover:bg-stone-100 active:bg-stone-200"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  )
}
