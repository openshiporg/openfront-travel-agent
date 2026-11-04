import { notFound } from 'next/navigation'
import { query, money, day, label } from '../../lib/data'
import { PlatformPage, Panel, Empty, RowList, Row } from '../../components/PlatformPage'
import { StatusLabel } from '../../components/StatusLabel'
import { joinParts, dateRange } from '../../lib/text'
import { StatusTabs } from '../../components/StatusTabs'
import { ActionButton } from '../../components/ActionButton'
import { MoneyAction } from '../../components/MoneyAction'
import { PlanningEditor } from '../components/PlanningEditor'
import { TravelerEditor } from '../components/TravelerEditor'
import { EntryDialog } from '../../components/EntryDialog'
import { ProposalBuilder } from '../components/ProposalBuilder'
import { AddDay, AddItem } from '../components/ItineraryEditor'

const TABS = ['overview', 'travelers', 'proposals', 'components', 'itinerary', 'payments', 'funds', 'commissions', 'documents', 'tasks']
const NAMES: Record<string, string> = { funds: 'Client funds', proposals: 'Proposals' }
const NEXT: Record<string, string> = { planning: 'proposal_sent', proposal_sent: 'accepted', accepted: 'booked', booked: 'final_payment_due', final_payment_due: 'paid_in_full' }

export async function TripWorkspacePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, { tab = 'overview' }] = await Promise.all([params, searchParams])
  const active = TABS.includes(tab) ? tab : 'overview'
  const d = await query(`query Trip($id: ID!) { trip(where: { id: $id }) {
    id tripNumber title status startDate endDate planningFeeCents currencyCode totalSellCents totalCollectedCents balanceDueCents expectedCommissionCents
    client { id name email phone } advisor { name } destinations { name }
    travelers { id firstName lastName passportOnFile nationality }
    proposals(orderBy: { version: desc }) { id version status sentAt acceptedAt acceptedByName options(orderBy: { sort: asc }) { id title items(orderBy: { sort: asc }) { id kind title sellCents supplier { name } } } }
    components(orderBy: { startAt: asc }) { id kind title startAt endAt confirmationNumber bookingStatus paymentModel sellCents netCostCents commissionBps commissionCents commissionStatus depositCents depositDueAt finalDueAt supplier { name } allocations { amountCents } supplierPayments { amountCents } }
    days(orderBy: { date: asc }) { id date title items(orderBy: { sort: asc }) { id time title location } }
    invoices(orderBy: { createdAt: asc }) { id number status totalCents collectedCents currencyCode dueAt lines { id kind description amountCents } payments(orderBy: { createdAt: asc }) { id amount refundedAmount status providerPaymentId paymentMethod processedAt } }
    schedule(orderBy: { dueAt: asc }) { id kind amountCents dueAt status }
    funds(orderBy: { occurredAt: asc }) { id entryType amountCents reference occurredAt }
    tasks(orderBy: { dueAt: asc }) { id title type status dueAt }
    documents { id kind title }
  }
    agencySettingsRecords(take: 1) { refundApprovalThresholdCents }
    managerApprovals(where: { status: { equals: approved } }, take: 100) { id actionType targetId amountCents reason status expiresAt requestedBy { id } approvedBy { id } }
    me: authenticatedItem { ... on User { id } }
  }`, { id })
  const t = d.trip
  if (!t) notFound()
  const href = (k: string) => `/dashboard/platform/trips/${id}?tab=${k}`
  const cur = t.currencyCode
  const balance = t.funds.reduce((n: number, f: any) => n + (f.entryType === 'receipt' ? f.amountCents : f.entryType === 'reversal' ? f.amountCents : -f.amountCents), 0)
  const next = NEXT[t.status]
  const threshold = d.agencySettingsRecords[0]?.refundApprovalThresholdCents ?? 50000
  const approvalFor = (actionType: string, targetId: string, amountCents: number) => d.managerApprovals.find((a: any) => a.actionType === actionType && a.targetId === targetId && a.amountCents === amountCents && a.requestedBy?.id === d.me?.id)?.id || null
  const receivedCommission = t.components.reduce((n: number, c: any) => n + c.allocations.reduce((m: number, a: any) => m + a.amountCents, 0), 0)
  const shortCommission = Math.max(t.expectedCommissionCents - receivedCommission, 0)
  const commissionCard = t.status === 'completed'
    ? ['Commission received', `${money(receivedCommission, cur)} of ${money(t.expectedCommissionCents, cur)}`, shortCommission ? `${money(shortCommission, cur)} short-paid or outstanding` : 'Settled']
    : ['Commission expected', money(t.expectedCommissionCents, cur), '']

  return (
    <PlatformPage title={t.title} subtitle={joinParts([t.tripNumber, t.client?.name, dateRange(t.startDate, t.endDate)])}
      crumbs={[{ label: 'Trips', href: '/dashboard/platform/trips' }, { label: t.title }]}
      actions={<div className="flex flex-wrap items-center gap-2"><StatusLabel status={t.status} />{next ? <ActionButton operator="transitionTrip" input={{ tripId: id, status: next }}>{`Mark ${label(next)}`}</ActionButton> : null}</div>}>
      <StatusTabs active={active} hrefFor={href} tabs={TABS.map((k) => ({ key: k, label: NAMES[k] || label(k).replace(/^./, (c) => c.toUpperCase()) }))} />

      {active === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid grid-cols-2 gap-3 lg:col-span-2 lg:grid-cols-4">
            {[['Total sell', money(t.totalSellCents, cur), ''], ['Collected', money(t.totalCollectedCents, cur), ''], ['Balance due', money(t.balanceDueCents, cur), ''], commissionCard].map(([l, v, sub]: any) => (
              <div key={l} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 text-lg font-semibold">{v}</p>{sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}</div>))}
          </div>
          <Panel title="Trip" action={<PlanningEditor tripId={id} feeCents={t.planningFeeCents} currencyCode={cur} />}><dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Advisor</dt><dd>{t.advisor?.name || '—'}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Destinations</dt><dd className="text-right">{t.destinations.map((x: any) => x.name).join(', ') || '—'}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Planning fee</dt><dd>{money(t.planningFeeCents, cur)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Client</dt><dd className="text-right">{t.client?.name || 'No client'}{t.client?.email ? <><br /><span className="text-xs text-muted-foreground">{t.client.email}</span></> : null}</dd></div>
          </dl></Panel>
          <Panel title="Next payments">{t.schedule.filter((s: any) => s.status === 'due').length ? <RowList>{t.schedule.filter((s: any) => s.status === 'due').slice(0, 5).map((s: any) => (
            <Row key={s.id}><span className="font-mono text-xs uppercase tracking-wide">{label(s.kind)} · {day(s.dueAt)}</span><span className="text-sm font-medium">{money(s.amountCents, cur)}</span></Row>))}</RowList> : <Empty>Nothing scheduled</Empty>}</Panel>
        </div>
      )}

      {active === 'travelers' && <Panel title="Travelers" action={<TravelerEditor tripId={id} />}>{t.travelers.length ? <RowList>{t.travelers.map((x: any) => (
        <Row key={x.id}><span className="text-sm font-medium">{x.firstName} {x.lastName}</span><span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{x.nationality} · passport {x.passportOnFile ? 'on file' : 'missing'}</span><TravelerEditor tripId={id} traveler={x} /></Row>))}</RowList> : <Empty>No travelers</Empty>}</Panel>}

      {active === 'proposals' && <div className="flex justify-end"><ProposalBuilder tripId={id} currencyCode={cur} /></div>}
      {active === 'proposals' && (t.proposals.length ? t.proposals.map((p: any) => (
        <Panel key={p.id} title={`Version ${p.version}`} action={<div className="flex items-center gap-2"><StatusLabel status={p.status} />{p.status === 'draft' ? <ActionButton operator="sendProposal" input={{ proposalId: p.id }} linkPrefix="/proposal/">Send</ActionButton> : null}</div>}>
          <div className="grid gap-3 md:grid-cols-3">{p.options.map((o: any) => (
            <div key={o.id} className="rounded-lg border p-3">
              <p className="text-sm font-medium">{o.title} · {money(o.items.reduce((n: number, i: any) => n + i.sellCents, 0), cur)}</p>
              <ul className="mt-2 space-y-1">{o.items.map((i: any) => <li key={i.id} className="text-xs text-muted-foreground"><span className="font-mono uppercase tracking-wide">{i.kind}</span> · {i.title} · {money(i.sellCents, cur)}</li>)}</ul>
            </div>))}</div>
          {p.acceptedAt ? <p className="mt-3 text-xs text-muted-foreground">Accepted by {p.acceptedByName} on {day(p.acceptedAt)}</p> : null}
        </Panel>)) : <Panel><Empty>No proposals yet</Empty></Panel>)}

      {active === 'components' && <Panel>{t.components.length ? <RowList>{t.components.map((c: any) => (
        <Row key={c.id}>
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium"><span className="truncate">{c.title}</span><StatusLabel status={c.bookingStatus} /></p>
            <p className="truncate text-xs text-muted-foreground">{joinParts([c.supplier?.name, label(c.paymentModel), c.confirmationNumber || 'No confirmation', c.startAt ? day(c.startAt) : ''])}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{money(c.sellCents, cur)}</span><PlanningEditor tripId={id} feeCents={t.planningFeeCents} currencyCode={cur} component={c} />{c.paymentModel === 'agency_collects' && c.bookingStatus !== 'cancelled' && c.netCostCents - c.supplierPayments.reduce((n: number, p: any) => n + p.amountCents, 0) > 0 ? <EntryDialog title={`Pay supplier · ${money(c.netCostCents - c.supplierPayments.reduce((n: number, p: any) => n + p.amountCents, 0), cur)} remaining`} trigger="Pay supplier" operator="recordSupplierPayment" base={{ componentId: c.id }} fields={[{ name: 'amountCents', label: `Amount (${cur})`, kind: 'money' }, { name: 'method', label: 'Method', kind: 'select', options: [{ value: 'wire', label: 'Wire' }, { value: 'check', label: 'Check' }, { value: 'card', label: 'Card' }] }, { name: 'reference', label: 'Reference' }]} /> : null}{c.bookingStatus !== 'cancelled' ? <ActionButton operator="cancelComponent" input={{ componentId: c.id }} confirm="Cancel this component?">Cancel</ActionButton> : null}</div>
        </Row>))}</RowList> : <Empty>No components</Empty>}</Panel>}

      {active === 'itinerary' && <div className="flex flex-wrap justify-end gap-2"><AddDay tripId={id} /><ActionButton operator="shareItinerary" input={{ tripId: id }} linkPrefix="/itinerary/">Share itinerary</ActionButton></div>}
      {active === 'itinerary' && (t.days.length ? t.days.map((dd: any) => (
        <Panel key={dd.id} title={`${day(dd.date)} · ${dd.title}`} action={<AddItem tripId={id} dayId={dd.id} />}>{dd.items.length ? <RowList>{dd.items.map((i: any) => <Row key={i.id}><span className="text-sm">{joinParts([i.time, i.title], ' ')}</span>{i.location ? <span className="text-xs text-muted-foreground">{i.location}</span> : null}</Row>)}</RowList> : <p className="text-sm text-muted-foreground">No items yet</p>}</Panel>)) : <Panel><Empty>No itinerary days</Empty></Panel>)}

      {active === 'payments' && (
        <div className="space-y-4">
          <Panel title="Invoices" action={<span className="flex flex-wrap gap-2"><EntryDialog title="Issue invoice" trigger="Issue invoice" operator="issueClientInvoice" base={{ tripId: id }} fields={[{ name: 'description', label: 'Description' }, { name: 'kind', label: 'Kind', kind: 'select', options: [{ value: 'planning_fee', label: 'Planning fee' }, { value: 'component_deposit', label: 'Component deposit' }, { value: 'component_final', label: 'Component final' }, { value: 'insurance', label: 'Insurance' }] }, { name: 'amountCents', label: `Amount (${cur})`, kind: 'money' }, { name: 'dueAt', label: 'Due date', kind: 'date', optional: true }]} lineFields={['description', 'kind', 'amountCents']} /><ActionButton operator="generatePaymentSchedule" input={{ tripId: id }}>Generate schedule</ActionButton></span>}>{t.invoices.length ? <ul className="divide-y">{t.invoices.map((i: any) => (
            <li key={i.id} className="space-y-2 py-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4"><div className="min-w-0"><p className="flex items-center gap-2 text-sm font-medium">{i.number}<StatusLabel status={i.status} /></p><p className="text-xs text-muted-foreground">{i.lines.map((l: any) => l.description).join(' · ')}</p></div><span className="flex flex-wrap items-center gap-2 text-sm">{money(i.collectedCents, cur)} of {money(i.totalCents, cur)}{i.status !== 'void' && i.totalCents - i.collectedCents > 0 ? <EntryDialog title={`Record payment on ${i.number}`} trigger="Record payment" operator="recordClientPayment" base={{ invoiceId: i.id }} fields={[{ name: 'amountCents', label: `Amount (${cur}, up to ${money(i.totalCents - i.collectedCents, cur)})`, kind: 'money' }, { name: 'method', label: 'Method', kind: 'select', options: [{ value: 'check', label: 'Check' }, { value: 'wire', label: 'Wire' }, { value: 'cash', label: 'Cash' }] }, { name: 'reference', label: 'Reference (check or wire number)' }]} /> : null}</span></div>
              {i.payments.map((p: any) => { const left = p.amount - p.refundedAmount; return (
                <div key={p.id} className="flex flex-col gap-1 pl-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{p.providerPaymentId ? 'card' : 'manual'} · {label(p.status)} · {money(p.amount, cur)}{p.refundedAmount ? ` · ${money(p.refundedAmount, cur)} refunded` : ''}</p>
                  {p.providerPaymentId && left > 0 ? <MoneyAction kind="refund" label="Refund" targetId={p.id} maxCents={left} thresholdCents={threshold} approvals={d.managerApprovals} actorId={d.me?.id || ''} /> : null}
                </div>) })}
            </li>))}</ul> : <Empty>No invoices</Empty>}</Panel>
          <Panel title="Schedule">{t.schedule.length ? <RowList>{t.schedule.map((s: any) => <Row key={s.id}><span className="font-mono text-xs uppercase tracking-wide">{label(s.kind)} · {day(s.dueAt)}</span><span className="flex items-center gap-3 text-sm">{money(s.amountCents, cur)}<StatusLabel status={s.status} /></span></Row>)}</RowList> : <Empty>No schedule rows</Empty>}</Panel>
        </div>)}

      {active === 'funds' && <Panel title={`Balance held ${money(balance, cur)}`}>{t.funds.length ? <RowList>{t.funds.map((f: any) => <Row key={f.id}><span className="font-mono text-xs uppercase tracking-wide">{label(f.entryType)} · {day(f.occurredAt)}</span><span className="text-sm font-medium">{money(f.amountCents, cur)}</span></Row>)}</RowList> : <Empty>No client funds entries</Empty>}</Panel>}

      {active === 'commissions' && <Panel>{t.components.some((c: any) => c.commissionCents) ? <RowList>{t.components.filter((c: any) => c.commissionCents).map((c: any) => {
        const got = c.allocations.reduce((n: number, a: any) => n + a.amountCents, 0)
        return <Row key={c.id}><div className="min-w-0"><p className="flex items-center gap-2 text-sm font-medium"><span className="truncate">{c.title}</span><StatusLabel status={c.commissionStatus} /></p><p className="text-xs text-muted-foreground">{c.supplier?.name} · {(c.commissionBps / 100).toFixed(2)}%</p></div><span className="text-sm">{money(got, cur)} of {money(c.commissionCents, cur)}</span></Row>
      })}</RowList> : <Empty>No commissions</Empty>}</Panel>}

      {active === 'documents' && <Panel>{t.documents.length ? <RowList>{t.documents.map((x: any) => <Row key={x.id}><span className="text-sm">{x.title}</span><span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{label(x.kind)}</span></Row>)}</RowList> : <Empty>No documents</Empty>}</Panel>}

      {active === 'tasks' && <Panel>{t.tasks.length ? <RowList>{t.tasks.map((x: any) => <Row key={x.id}><div className="min-w-0"><p className="truncate text-sm font-medium">{x.title}</p><p className="text-xs text-muted-foreground">{label(x.type)} · {day(x.dueAt)}</p></div><StatusLabel status={x.status} /></Row>)}</RowList> : <Empty>No tasks</Empty>}</Panel>}
    </PlatformPage>
  )
}
