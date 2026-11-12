import { notFound } from 'next/navigation'
import { query, money, day, label } from '../../lib/data'
import { PlatformPage, Panel, Empty, RowList, Row } from '../../components/PlatformPage'
import { StatusLabel } from '../../components/StatusLabel'
import { joinParts, dateRange } from '../../lib/text'
import { StatusTabs } from '../../components/StatusTabs'
import { DocumentUploader } from '../components/DocumentUploader'
import { DocumentDownload } from '../components/DocumentDownload'
import { isObjectStorageConfigured } from '../../../integrations/storage'
import { TaskActions } from '../../tasks/components/TaskActions'
import { daysOverdue, isOverdue, taskStatus } from '../../lib/task-state'
import { ActionButton } from '../../components/ActionButton'
import { MoneyAction } from '../../components/MoneyAction'
import { PlanningEditor } from '../components/PlanningEditor'
import { TravelerEditor } from '../components/TravelerEditor'
import { EntryDialog } from '../../components/EntryDialog'
import { ProposalBuilder } from '../components/ProposalBuilder'
import { passportNeedsAction, PASSPORT_TEXT, type PassportStatus } from '@/features/keystone/lib/passport-check'
import { ProfileEditor } from '../components/ProfileEditor'
import { readProfile } from '@/features/keystone/lib/client-profile'
import { PartyEditor, RoomEditor } from '../components/GroupEditors'
import { InsuranceEditor } from '../components/InsuranceEditor'
import { INSURANCE_TEXT, insuranceNeedsAction, type InsuranceStatus } from '@/features/keystone/lib/insurance-offer'
import { allBalances, roomingProblems } from '@/features/keystone/lib/party-balance'
import { supplierDue } from '../../lib/supplier-due'
import { holdLapsed, needsConfirmation, startsPhrase } from '../../lib/confirmation-state'
import { AddDay, AddItem } from '../components/ItineraryEditor'
import { ComponentEntry } from '../components/ComponentEntry'

const TABS = ['overview', 'travelers', 'group', 'proposals', 'components', 'itinerary', 'payments', 'funds', 'commissions', 'documents', 'tasks']
function ClientPreferences({ client }: { client: any }) {
  const p = readProfile(client.travelProfile), programs: string[] = JSON.parse(client.loyaltyPrograms || '[]')
  const lines = [['Seat', p.seat], ['Room', p.room], ['Dietary', p.dietary], ['Notes', p.notes], ['Celebrating', p.celebrations.map((c) => joinParts([c.label, c.date ? day(c.date) : ''], ' ')).join(', ')], ['Loyalty', programs.length ? `${programs.join(', ')} (numbers on file)` : '']].filter(([, v]) => v)
  return (
    <Panel title={`Preferences · ${client.name}`} action={<div className="flex flex-wrap items-center gap-2"><ProfileEditor clientId={client.id} clientName={client.name} profile={p} /><EntryDialog title={`Loyalty number · ${client.name}`} trigger="Add loyalty" operator="saveClientLoyalty" base={{ clientId: client.id }} fields={[{ name: 'program', label: 'Program (reuse a name to update or clear it)', kind: 'text' }, { name: 'number', label: 'Number (write-only, blank removes the program)', kind: 'text', optional: true, sendEmpty: true }]} /></div>}>
      {lines.length ? <dl className="space-y-1 text-sm">{lines.map(([k, v]) => <div key={k} className="flex justify-between gap-4"><dt className="shrink-0 text-muted-foreground">{k}</dt><dd className="min-w-0 break-words text-right">{v}</dd></div>)}</dl> : <p className="text-sm text-muted-foreground">No preferences recorded yet.</p>}
    </Panel>
  )
}
/** Pre-departure readiness: passport validity and travel insurance, per traveler. Only open items and recorded waivers are listed. */
function PreDeparture({ t }: { t: any }) {
  const name = (x: any) => joinParts([x.firstName, x.lastName], ' ')
  const ins = JSON.parse(t.insuranceChecks || '[]'), pass = JSON.parse(t.passportChecks || '[]')
  const items = t.travelers.flatMap((x: any) => {
    const i = ins.find((c: any) => c.id === x.id), p = pass.find((c: any) => c.id === x.id)
    const out: { key: string; who: string; text: string; bad: boolean }[] = []
    const is = (i?.status || 'not_offered') as InsuranceStatus, ps = (p?.status || 'missing') as PassportStatus
    if (insuranceNeedsAction(is)) out.push({ key: x.id + 'i', who: name(x), text: INSURANCE_TEXT[is], bad: true })
    if (is === 'declined') out.push({ key: x.id + 'w', who: name(x), text: `Insurance declined ${i?.recordedAt ? day(i.recordedAt) : ''}`.trim(), bad: false })
    if (passportNeedsAction(ps)) out.push({ key: x.id + 'p', who: name(x), text: PASSPORT_TEXT[ps], bad: true })
    return out
  })
  const open = items.filter((x: any) => x.bad).length
  return <Panel title="Pre-departure checks">
    {items.length ? <ul className="divide-y">{items.map((x: any) => <li key={x.key} className="flex flex-col gap-0.5 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="min-w-0 truncate font-medium">{x.who}</span><span className={`font-mono text-xs uppercase tracking-wide ${x.bad ? 'text-red-600' : 'text-muted-foreground'}`}>{x.text}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">Passports and insurance are settled for every traveler.</p>}
    {open ? <p className="mt-2 text-xs text-muted-foreground">{open} open item{open === 1 ? '' : 's'}. Use the Travelers tab to resolve them.</p> : null}
  </Panel>
}
function GroupTab({ tripId, t, cur }: { tripId: string; t: any; cur: string }) {
  const people = t.travelers.map((x: any) => ({ id: x.id, name: joinParts([x.firstName, x.lastName], ' ') }))
  const parties = t.parties.map((p: any) => ({ id: p.id, name: p.name, travelerIds: p.travelers.map((x: any) => x.id) }))
  const taken = new Set(parties.flatMap((p: any) => p.travelerIds))
  const invs = t.invoices.map((i: any) => ({ id: i.id, number: i.number, status: i.status, totalCents: i.totalCents || 0, collectedCents: i.collectedCents || 0, dueAt: i.dueAt, currencyCode: i.currencyCode, partyId: i.party?.id || null }))
  const rows = allBalances(invs, parties.map((p: any) => p.id))
  const problems = roomingProblems(t.rooms.map((r: any) => ({ id: r.id, label: r.label, partyId: r.party?.id || null, guestIds: r.guests.map((g: any) => g.id) })), Object.fromEntries(parties.map((p: any) => [p.id, p.travelerIds])))
  const unroomed = people.filter((p: any) => !t.rooms.some((r: any) => r.guests.some((g: any) => g.id === p.id)))
  return <div className="space-y-4">
    <Panel title="Paying parties" action={<PartyEditor tripId={tripId} available={people.filter((p: any) => !taken.has(p.id))} />}>
      {parties.length ? <RowList>{parties.map((p: any) => { const b = rows.find((r) => r.partyId === p.id)!; return (
        <Row key={p.id}><div className="min-w-0"><p className="truncate text-sm font-medium">{p.name}</p><p className="truncate text-xs text-muted-foreground">{joinParts([`${p.travelerIds.length} traveler${p.travelerIds.length === 1 ? '' : 's'}`, `${money(b.paidCents, cur)} paid of ${money(b.billedCents, cur)}`, b.nextDueAt ? `next due ${day(b.nextDueAt)}` : ''])}</p></div>
          <div className="flex flex-wrap items-center gap-2"><span className={`text-sm font-medium ${b.overdue ? 'text-red-600' : ''}`}>{b.overdue ? <span className="font-mono text-xs uppercase tracking-wide">Overdue · </span> : null}{money(b.balanceCents, cur)} due</span><PartyEditor tripId={tripId} party={p} available={people.filter((x: any) => !taken.has(x.id) || p.travelerIds.includes(x.id))} /><ActionButton operator="shareTripParty" input={{ partyId: p.id }} linkPrefix="/trip/">Party link</ActionButton></div></Row>) })}
        {rows.find((r) => r.partyId === null) ? <Row><div className="min-w-0"><p className="text-sm font-medium">Whole trip (no party)</p><p className="text-xs text-muted-foreground">Invoices not assigned to a party</p></div><span className="text-sm font-medium">{money(rows.find((r) => r.partyId === null)!.balanceCents, cur)} due</span></Row> : null}</RowList> : <Empty>No parties yet. Add one to invoice and share by family or couple.</Empty>}
    </Panel>
    <Panel title="Rooming list" action={<RoomEditor tripId={tripId} parties={parties} travelers={people} />}>
      {problems.length ? <p role="status" className="mb-2 text-sm text-red-600"><span className="font-mono text-xs uppercase tracking-wide">Check · </span>{problems.join('; ')}</p> : null}
      {t.rooms.length ? <RowList>{t.rooms.map((r: any) => (
        <Row key={r.id}><div className="min-w-0"><p className="truncate text-sm font-medium">{joinParts([r.label, r.roomType])}</p><p className="truncate text-xs text-muted-foreground">{joinParts([r.party ? parties.find((p: any) => p.id === r.party.id)?.name : 'Any party', r.guests.map((g: any) => people.find((p: any) => p.id === g.id)?.name).filter(Boolean).join(', ') || 'No guests'])}</p></div>
          <div className="flex gap-2"><RoomEditor tripId={tripId} parties={parties} travelers={people} room={{ id: r.id, label: r.label, roomType: r.roomType || '', partyId: r.party?.id || '', guestIds: r.guests.map((g: any) => g.id) }} /><ActionButton operator="removeTripRoom" input={{ roomId: r.id }} confirm={`Remove ${r.label}?`}>Remove</ActionButton></div></Row>))}</RowList> : <Empty>No rooms yet</Empty>}
      {t.rooms.length && unroomed.length ? <p className="mt-2 text-xs text-muted-foreground">Not roomed yet: {unroomed.map((p: any) => p.name).join(', ')}</p> : null}
    </Panel>
  </div>
}
const NAMES: Record<string, string> = { funds: 'Client funds', proposals: 'Proposals' }
const CANCELLABLE = ['planning', 'proposal_sent', 'accepted', 'booked', 'final_payment_due', 'paid_in_full', 'traveling']
const NEXT: Record<string, string> = { planning: 'proposal_sent', proposal_sent: 'accepted', accepted: 'booked', booked: 'final_payment_due', final_payment_due: 'paid_in_full' }

export async function TripWorkspacePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, { tab = 'overview' }] = await Promise.all([params, searchParams])
  const active = TABS.includes(tab) ? tab : 'overview'
  const d = await query(`query Trip($id: ID!) { trip(where: { id: $id }) {
    id tripNumber title status cancelReason cancelledAt startDate endDate planningFeeCents currencyCode totalSellCents totalCollectedCents balanceDueCents expectedCommissionCents
    client { id name email phone travelProfile loyaltyPrograms } advisor { name } destinations { name }
    passportChecks
    insuranceChecks
    parties(orderBy: { createdAt: asc }) { id name travelers { id } }
    rooms(orderBy: { label: asc }) { id label roomType party { id } guests { id } }
    travelers { id firstName lastName passportOnFile nationality }
    proposals(orderBy: { version: desc }) { id version status introNote depositBps sentAt acceptedAt acceptedByName options(orderBy: { sort: asc }) { id title items(orderBy: { sort: asc }) { id kind title details sellCents estimatedCommissionBps supplier { id name } } } }
    components(orderBy: { startAt: asc }) { id kind title startAt endAt confirmationNumber confirmedAt confirmedBy { name } holdUntil supplierDueAt cancelPenaltySchedule bookingStatus paymentModel sellCents netCostCents commissionBps commissionCents commissionStatus depositCents depositDueAt finalDueAt supplier { name } allocations { amountCents } supplierPayments { amountCents } }
    days(orderBy: { date: asc }) { id date title items(orderBy: { sort: asc }) { id time title location } }
    invoices(orderBy: { createdAt: asc }) { id number party { id name } status totalCents collectedCents currencyCode dueAt lines { id kind description amountCents } payments(orderBy: { createdAt: asc }) { id amount refundedAmount status providerPaymentId paymentMethod processedAt } }
    schedule(orderBy: { dueAt: asc }) { id kind amountCents dueAt status }
    funds(orderBy: { occurredAt: asc }) { id entryType amountCents reference occurredAt }
    tasks(orderBy: { dueAt: asc }) { id title type status dueAt completedAt completionNote completedBy { name } }
    documents(orderBy: { createdAt: desc }) { id kind title mimeType byteSize verifiedAt traveler { firstName lastName } }
  }
    agencySettingsRecords(take: 1) { refundApprovalThresholdCents }
    managerApprovals(where: { status: { equals: approved } }, take: 100) { id actionType targetId amountCents reason status expiresAt requestedBy { id } approvedBy { id } }
    me: authenticatedItem { ... on User { id } }
    suppliers(orderBy: { name: asc }, take: 500) { id name defaultCommissionBps }
  }`, { id })
  const t = d.trip
  if (!t) notFound()
  const overdueCount = t.tasks.filter((x: any) => isOverdue(x)).length
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
      actions={<div className="flex flex-wrap items-center gap-2"><StatusLabel status={t.status} /><EntryDialog title="Copy this trip" trigger="Copy trip" operator="duplicateTrip" base={{ tripId: id }} redirectTo="/dashboard/platform/trips/{id}" fields={[{ name: 'title', label: 'Title for the copy', initial: `${t.title} (copy)` }, { name: 'startDate', label: 'New start date (dates shift to match)', kind: 'date', optional: true, initial: t.startDate ? String(t.startDate).slice(0, 10) : '' }]} />{next ? <ActionButton operator="transitionTrip" input={{ tripId: id, status: next }}>{`Mark ${label(next)}`}</ActionButton> : null}{CANCELLABLE.includes(t.status) ? <EntryDialog title={`Cancel ${t.title}`} trigger="Cancel trip" operator="cancelTrip" base={{ tripId: id }} fields={[{ name: 'reason', label: 'Why is the trip cancelled' }]} /> : null}</div>}>
      {t.status === 'cancelled' && t.cancelReason ? <p className="text-sm text-muted-foreground">Cancelled {day(t.cancelledAt)}: {t.cancelReason}</p> : null}
      <StatusTabs active={active} hrefFor={href} tabs={TABS.map((k) => ({ key: k, label: NAMES[k] || label(k).replace(/^./, (c) => c.toUpperCase()) }))} />

      {t.client ? <ClientPreferences client={t.client} /> : null}
      {active === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid grid-cols-2 gap-3 lg:col-span-2 lg:grid-cols-4">
            {[['Total sell', money(t.totalSellCents, cur), ''], ['Collected', money(t.totalCollectedCents, cur), ''], ['Balance due', money(t.balanceDueCents, cur), ''], commissionCard].map(([l, v, sub]: any) => (
              <div key={l} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 text-lg font-semibold">{v}</p>{sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}</div>))}
          </div>
          {t.travelers.length ? <PreDeparture t={t} /> : null}
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
        <Row key={x.id}><div className="min-w-0"><p className="text-sm font-medium">{x.firstName} {x.lastName}</p><p className="text-xs text-muted-foreground">{joinParts([x.nationality, `passport ${x.passportOnFile ? 'on file' : 'missing'}`])}</p>{(() => { const c = JSON.parse(t.insuranceChecks || '[]').find((p: any) => p.id === x.id); const s = (c?.status || 'not_offered') as InsuranceStatus; return <p className={`font-mono text-xs uppercase tracking-wide ${insuranceNeedsAction(s) ? 'text-red-600' : 'text-muted-foreground'}`}>{INSURANCE_TEXT[s]}{c?.recordedAt && s !== 'not_offered' ? ` · ${day(c.recordedAt)}` : ''}</p> })()}{(() => { const c = JSON.parse(t.insuranceChecks || '[]').find((p: any) => p.id === x.id); return c?.waiverNote ? <p className="text-xs text-muted-foreground">Waiver: {c.waiverNote}</p> : null })()}{(() => { const s = (JSON.parse(t.passportChecks || '[]').find((p: any) => p.id === x.id)?.status || 'missing') as PassportStatus; return <p className={`font-mono text-xs uppercase tracking-wide ${passportNeedsAction(s) ? 'text-red-600' : 'text-muted-foreground'}`}>{PASSPORT_TEXT[s]}</p> })()}</div><div className="flex flex-wrap gap-2"><InsuranceEditor tripId={id} travelerId={x.id} name={joinParts([x.firstName, x.lastName], ' ')} current={(JSON.parse(t.insuranceChecks || '[]').find((p: any) => p.id === x.id)?.status || 'not_offered')} /><TravelerEditor tripId={id} traveler={x} /></div></Row>))}</RowList> : <Empty>No travelers</Empty>}</Panel>}

      {active === 'group' && <GroupTab tripId={id} t={t} cur={cur} />}

      {active === 'proposals' && <div className="flex justify-end"><ProposalBuilder tripId={id} currencyCode={cur} /></div>}
      {active === 'proposals' && (t.proposals.length ? t.proposals.map((p: any) => (
        <Panel key={p.id} title={`Version ${p.version}`} action={<div className="flex items-center gap-2"><StatusLabel status={p.status} />{p.status === 'draft' ? <ProposalBuilder tripId={id} currencyCode={cur} draft={{ id: p.id, version: p.version, introNote: p.introNote || '', depositBps: p.depositBps || 0, options: p.options.map((o: any) => ({ ...o, items: o.items.map((i: any) => ({ ...i, supplierId: i.supplier?.id || null })) })) }} /> : null}{p.status === 'draft' ? <ActionButton operator="sendProposal" input={{ proposalId: p.id }} linkPrefix="/proposal/">Send</ActionButton> : null}</div>}>
          <div className="grid gap-3 md:grid-cols-3">{p.options.map((o: any) => (
            <div key={o.id} className="rounded-lg border p-3">
              <p className="text-sm font-medium">{o.title} · {money(o.items.reduce((n: number, i: any) => n + i.sellCents, 0), cur)}</p>
              <ul className="mt-2 space-y-1">{o.items.map((i: any) => <li key={i.id} className="text-xs text-muted-foreground"><span className="font-mono uppercase tracking-wide">{i.kind}</span> · {i.title} · {money(i.sellCents, cur)}</li>)}</ul>
            </div>))}</div>
          {p.depositBps ? <p className="mt-3 text-xs text-muted-foreground">Deposit {p.depositBps / 100}% invoiced on acceptance</p> : null}
          {p.acceptedAt ? <p className="mt-3 text-xs text-muted-foreground">Accepted by {p.acceptedByName} on {day(p.acceptedAt)}</p> : null}
        </Panel>)) : <Panel><Empty>No proposals yet</Empty></Panel>)}

      {active === 'components' && !['completed', 'cancelled'].includes(t.status) && <div className="flex justify-end"><ComponentEntry tripId={id} suppliers={d.suppliers} /></div>}
      {active === 'components' && <Panel>{t.components.length ? <RowList>{t.components.map((c: any) => (
        <Row key={c.id}>
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium"><span className="truncate">{c.title}</span><StatusLabel status={c.bookingStatus} /></p>
            <p className="truncate text-xs text-muted-foreground">{joinParts([c.supplier?.name, label(c.paymentModel), c.confirmationNumber || (needsConfirmation(c) ? `No confirmation · ${startsPhrase(c)}` : 'No confirmation'), c.confirmedAt ? joinParts([`Confirmed ${day(c.confirmedAt)}`, c.confirmedBy?.name ? `by ${c.confirmedBy.name}` : ''], ' ') : '', c.bookingStatus === 'held' && c.holdUntil ? `${holdLapsed(c.holdUntil) ? 'Hold lapsed' : 'Held until'} ${day(c.holdUntil)}` : '', c.startAt ? day(c.startAt) : ''])}</p>
            {(() => { const s = supplierDue(c); return s.remainingCents ? <p className={`truncate text-xs ${s.overdue ? 'text-red-600' : 'text-muted-foreground'}`}>{s.overdue ? <span className="font-mono uppercase tracking-wide">Overdue · </span> : null}{joinParts([`Supplier owed ${money(s.remainingCents, cur)}`, s.dueAt ? `${s.overdue ? `${s.daysLate}d late, was due` : 'due'} ${day(s.dueAt)}${s.source === 'cancellation' ? ' (cancellation terms)' : ''}` : 'no due date set'])}</p> : null })()}
          </div>
          <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{money(c.sellCents, cur)}</span>{c.paymentModel === 'agency_collects' && ['booked', 'ticketed'].includes(c.bookingStatus) ? <EntryDialog title={`Supplier due date · ${c.title}`} trigger={c.supplierDueAt ? 'Change supplier due' : 'Set supplier due'} operator="setSupplierDue" base={{ componentId: c.id }} fields={[{ name: 'supplierDueAt', label: 'Pay the supplier by (blank uses cancellation terms)', kind: 'date', optional: true, sendEmpty: true, initial: c.supplierDueAt ? String(c.supplierDueAt).slice(0, 10) : '' }]} /> : null}<PlanningEditor tripId={id} feeCents={t.planningFeeCents} currencyCode={cur} component={c} />{['quoted', 'held'].includes(c.bookingStatus) ? <><EntryDialog title={`Hold ${c.title}`} trigger={c.bookingStatus === 'held' ? 'Extend hold' : 'Hold'} operator="holdComponent" base={{ componentId: c.id }} fields={[{ name: 'holdUntil', label: 'Supplier holds until', kind: 'date', initial: c.holdUntil ? String(c.holdUntil).slice(0, 10) : '' }]} /><EntryDialog title={`Supplier confirmation · ${c.title}`} trigger="Confirm" operator="bookComponent" base={{ componentId: c.id }} fields={[{ name: 'confirmationNumber', label: 'Supplier confirmation number' }, { name: 'netCostCents', label: `Net cost (${cur})`, kind: 'money', initial: c.netCostCents ? (c.netCostCents / 100).toFixed(2) : '' }, { name: 'paymentModel', label: 'Who collects payment', kind: 'select', optional: true, initial: c.paymentModel, options: [{ value: 'client_pays_supplier', label: 'Client pays supplier' }, { value: 'agency_collects', label: 'Agency collects' }] }]} /></> : null}{c.paymentModel === 'agency_collects' && c.bookingStatus !== 'cancelled' && c.netCostCents - c.supplierPayments.reduce((n: number, p: any) => n + p.amountCents, 0) > 0 ? <EntryDialog title={`Pay supplier · ${money(c.netCostCents - c.supplierPayments.reduce((n: number, p: any) => n + p.amountCents, 0), cur)} remaining`} trigger="Pay supplier" operator="recordSupplierPayment" base={{ componentId: c.id }} fields={[{ name: 'amountCents', label: `Amount (${cur})`, kind: 'money' }, { name: 'method', label: 'Method', kind: 'select', options: [{ value: 'wire', label: 'Wire' }, { value: 'check', label: 'Check' }, { value: 'card', label: 'Card' }] }, { name: 'reference', label: 'Reference' }]} /> : null}{c.bookingStatus !== 'cancelled' ? <ActionButton operator="cancelComponent" input={{ componentId: c.id }} confirm="Cancel this component?">Cancel</ActionButton> : null}</div>
        </Row>))}</RowList> : <Empty>No components</Empty>}</Panel>}

      {active === 'itinerary' && <div className="flex flex-wrap justify-end gap-2"><AddDay tripId={id} /><ActionButton operator="shareItinerary" input={{ tripId: id }} linkPrefix="/trip/">Share client portal</ActionButton><ActionButton operator="shareItinerary" input={{ tripId: id }} linkPrefix="/itinerary/">Share itinerary only</ActionButton></div>}
      {active === 'itinerary' && (t.days.length ? t.days.map((dd: any) => (
        <Panel key={dd.id} title={`${day(dd.date)} · ${dd.title}`} action={<AddItem tripId={id} dayId={dd.id} />}>{dd.items.length ? <RowList>{dd.items.map((i: any) => <Row key={i.id}><span className="text-sm">{joinParts([i.time, i.title], ' ')}</span>{i.location ? <span className="text-xs text-muted-foreground">{i.location}</span> : null}</Row>)}</RowList> : <p className="text-sm text-muted-foreground">No items yet</p>}</Panel>)) : <Panel><Empty>No itinerary days</Empty></Panel>)}

      {active === 'payments' && (
        <div className="space-y-4">
          <Panel title="Invoices" action={<span className="flex flex-wrap gap-2"><EntryDialog title="Issue invoice" trigger="Issue invoice" operator="issueClientInvoice" base={{ tripId: id }} fields={[{ name: 'description', label: 'Description' }, { name: 'kind', label: 'Kind', kind: 'select', options: [{ value: 'planning_fee', label: 'Planning fee' }, { value: 'component_deposit', label: 'Component deposit' }, { value: 'component_final', label: 'Component final' }, { value: 'insurance', label: 'Insurance' }] }, { name: 'amountCents', label: `Amount (${cur})`, kind: 'money' }, { name: 'dueAt', label: 'Due date', kind: 'date', optional: true }, ...(t.parties.length ? [{ name: 'partyId', label: 'Bill to', kind: 'select' as const, optional: true, options: [{ value: '', label: 'Whole trip' }, ...t.parties.map((p: any) => ({ value: p.id, label: p.name }))] }] : [])]} lineFields={['description', 'kind', 'amountCents']} /><ActionButton operator="generatePaymentSchedule" input={{ tripId: id }}>Generate schedule</ActionButton></span>}>{t.invoices.length ? <ul className="divide-y">{t.invoices.map((i: any) => (
            <li key={i.id} className="space-y-2 py-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4"><div className="min-w-0"><p className="flex items-center gap-2 text-sm font-medium">{i.number}<StatusLabel status={i.status} /></p><p className="text-xs text-muted-foreground">{joinParts([i.party?.name ? `Bill to ${i.party.name}` : '', ...i.lines.map((l: any) => l.description)])}</p></div><span className="flex flex-wrap items-center gap-2 text-sm">{money(i.collectedCents, cur)} of {money(i.totalCents, cur)}{i.status !== 'void' && i.totalCents - i.collectedCents > 0 ? <EntryDialog title={`Record payment on ${i.number}`} trigger="Record payment" operator="recordClientPayment" base={{ invoiceId: i.id }} fields={[{ name: 'amountCents', label: `Amount (${cur}, up to ${money(i.totalCents - i.collectedCents, cur)})`, kind: 'money' }, { name: 'method', label: 'Method', kind: 'select', options: [{ value: 'check', label: 'Check' }, { value: 'wire', label: 'Wire' }, { value: 'cash', label: 'Cash' }] }, { name: 'reference', label: 'Reference (check or wire number)' }]} /> : null}</span></div>
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

      {active === 'documents' && <Panel title="Documents" action={<DocumentUploader tripId={id} travelers={t.travelers.map((x: any) => ({ id: x.id, name: joinParts([x.firstName, x.lastName]) }))} storageConfigured={isObjectStorageConfigured()} />}>{t.documents.length ? <RowList>{t.documents.map((x: any) => <Row key={x.id}><div className="min-w-0"><p className="truncate text-sm font-medium">{x.title}</p><p className="truncate text-xs text-muted-foreground">{joinParts([label(x.kind), x.traveler ? joinParts([x.traveler.firstName, x.traveler.lastName], ' ') : null, `${Math.max(1, Math.round(x.byteSize / 1024))} KB`])}</p></div><span className="flex items-center gap-3">{x.verifiedAt ? <DocumentDownload documentId={x.id} /> : <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Upload unverified</span>}</span></Row>)}</RowList> : <Empty>No documents</Empty>}</Panel>}

      {active === 'tasks' && <Panel title="Tasks" action={overdueCount ? <span className="font-mono text-xs uppercase tracking-wide text-red-600">{overdueCount} overdue</span> : undefined}>{t.tasks.length ? <RowList>{t.tasks.map((x: any) => <Row key={x.id}><div className="min-w-0"><p className="truncate text-sm font-medium">{x.title}</p><p className="text-xs text-muted-foreground">{joinParts([label(x.type), x.status === 'completed' && x.completedAt ? `Done ${day(x.completedAt)}${x.completedBy?.name ? ` by ${x.completedBy.name}` : ''}` : `Due ${day(x.dueAt)}${daysOverdue(x) ? `, ${daysOverdue(x)} ${daysOverdue(x) === 1 ? 'day' : 'days'} late` : ''}`])}</p>{x.completionNote ? <p className="text-xs text-muted-foreground">Note: {x.completionNote}</p> : null}</div><span className="flex items-center gap-3"><StatusLabel status={taskStatus(x)} /><TaskActions taskId={x.id} title={x.title} status={x.status} /></span></Row>)}</RowList> : <Empty>No tasks</Empty>}</Panel>}
    </PlatformPage>
  )
}
