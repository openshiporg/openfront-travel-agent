import { date } from '../lib/format'

// Day-by-day plan, shared by the trip page and the printable itinerary.
export function Days({ days }: { days: any[] }) {
  if (!days.length) return <p className="text-sm text-slate-700">Your advisor has not added the day-by-day plan yet.</p>
  return (
    <ol className="divide-y divide-slate-200 border-y border-slate-200">
      {days.map((d: any, n: number) => (
        <li key={n} className="grid gap-x-6 gap-y-2 py-4 sm:grid-cols-[9rem_1fr]">
          <p className="text-sm font-medium text-slate-600">{d.date ? date(d.date) : `Day ${n + 1}`}</p>
          <div className="space-y-2">
            <h3 className="text-base font-semibold">{d.title || `Day ${n + 1}`}</h3>
            {d.items.length ? (
              <ul className="space-y-2 text-sm">
                {d.items.map((it: any, j: number) => (
                  <li key={j} className="grid grid-cols-[4.5rem_1fr] gap-x-3">
                    <span className="text-slate-600">{it.time || ''}</span>
                    <span>{it.title}{it.location ? <span className="text-slate-600"> · {it.location}</span> : null}{it.notes ? <span className="block text-slate-600">{it.notes}</span> : null}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-600">Nothing planned yet.</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}
