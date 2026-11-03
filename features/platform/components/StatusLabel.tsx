const DOT: Record<string, string> = {
  planning: 'bg-slate-400', proposal_sent: 'bg-blue-500', accepted: 'bg-indigo-500', booked: 'bg-teal-500', final_payment_due: 'bg-amber-500',
  paid_in_full: 'bg-emerald-500', traveling: 'bg-cyan-500', completed: 'bg-green-600', cancelled: 'bg-red-500',
  new: 'bg-blue-500', qualifying: 'bg-amber-500', proposal: 'bg-indigo-500', won: 'bg-emerald-500', lost: 'bg-red-500',
  draft: 'bg-slate-400', sent: 'bg-blue-500', viewed: 'bg-cyan-500', superseded: 'bg-slate-400', declined: 'bg-red-500',
  partially_paid: 'bg-amber-500', paid: 'bg-emerald-500', void: 'bg-red-500', open: 'bg-amber-500',
  expected: 'bg-slate-400', invoiced: 'bg-blue-500', received: 'bg-emerald-500', short_paid: 'bg-red-500', written_off: 'bg-slate-500',
  quoted: 'bg-slate-400', held: 'bg-amber-500', ticketed: 'bg-green-600', due: 'bg-amber-500',
}

/** Status is a mono uppercase label with a dot, never a badge. */
export function StatusLabel({ status }: { status?: string | null }) {
  if (!status) return null
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide text-muted-foreground">
      <span className={`size-2 shrink-0 rounded-full ${DOT[status] || 'bg-slate-400'}`} />
      {status.replace(/_/g, ' ')}
    </span>
  )
}
