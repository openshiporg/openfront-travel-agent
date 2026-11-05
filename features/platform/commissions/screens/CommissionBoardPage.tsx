import { query, money, day, label } from '../../lib/data'
import { PlatformPage, Panel, Empty, RowList, Row } from '../../components/PlatformPage'
import { StatusLabel } from '../../components/StatusLabel'
import { StatusTabs } from '../../components/StatusTabs'
import { MoneyAction } from '../../components/MoneyAction'
import { EntryDialog } from '../../components/EntryDialog'
import { joinParts } from '../../lib/text'
import { ReceiptForm } from '../components/ReceiptForm'
import { ForecastExport } from '../components/ForecastExport'
import { commissionForecast } from '@/features/keystone/lib/commission-forecast'

const TABS = ['expected', 'invoiced', 'received', 'short_paid', 'written_off']

export async function CommissionBoardPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = 'expected' } = await searchParams
  const active = TABS.includes(status) ? status : 'expected'
  const d = await query(`{
    components: tripComponents(where: { commissionStatus: { equals: ${active} }, commissionCents: { gt: 0 } }, orderBy: { endAt: asc }, take: 100) { id title bookingStatus commissionClaimedAt commissionClaimReference commissionBps commissionCents currencyCode endAt supplier { name commissionPaymentTermsDays } trip { id title advisor { name } } allocations { amountCents } }
    ${TABS.map((t) => `${t}: tripComponentsCount(where: { commissionStatus: { equals: ${t} }, commissionCents: { gt: 0 } })`).join('\n')}
    open: tripComponents(where: { commissionStatus: { in: [expected, invoiced, short_paid] }, commissionCents: { gt: 0 }, supplier: { id: { not: null } } }, orderBy: { endAt: asc }, take: 200) { id title currencyCode commissionCents supplier { id name } trip { title } allocations { amountCents } }
    commissionReceipts(orderBy: { receivedAt: desc }, take: 10) { id reference amountCents currencyCode receivedAt supplier { name } allocations { amountCents component { title } } }
    overpaymentApprovals: managerApprovals(where: { status: { in: [requested, approved] }, actionType: { equals: commission_overpayment } }, orderBy: { requestedAt: desc }, take: 100) { id actionType targetId amountCents reason status expiresAt requestedBy { id } approvedBy { id } }
    managerApprovals(where: { status: { equals: approved }, actionType: { equals: commission_writeoff } }, take: 100) { id targetId amountCents requestedBy { id } }
    me: authenticatedItem { ... on User { id } }
    forecast: tripComponents(where: { bookingStatus: { in: [booked, ticketed] }, commissionCents: { gt: 0 } }, take: 5000) { id title bookingStatus commissionStatus commissionCents currencyCode startAt endAt supplier { id name commissionPaymentTermsDays } trip { title } allocations { amountCents } }
    advisorCommissionLedgers(take: 500) { amountCents advisor { id name } }
  }`)
  const payouts = new Map<string, { name: string; total: number }>()
  for (const e of d.advisorCommissionLedgers) { const p = payouts.get(e.advisor.id) || { name: e.advisor.name, total: 0 }; p.total += e.amountCents; payouts.set(e.advisor.id, p) }
  const openComponents = d.open.map((c: any) => ({ id: c.id, title: c.title, tripTitle: c.trip?.title || '', supplierId: c.supplier.id, supplierName: c.supplier.name, currencyCode: c.currencyCode, remainingCents: c.commissionCents - c.allocations.reduce((n: number, a: any) => n + a.amountCents, 0) })).filter((c: any) => c.remainingCents > 0)
  const fc = commissionForecast(d.forecast)
  const cur = (r: { currencyCode: string }) => r.currencyCode
  return (
    <PlatformPage title="Commissions" subtitle="Expected, received and short-paid supplier commissions" actions={<><ForecastExport /><ReceiptForm components={openComponents} approvals={d.overpaymentApprovals} actorId={d.me?.id || ''} /></>}>
      <Panel title="Forecast: expected vs received">
        {fc.overdue.length ? <div role="status" className="border-b px-4 py-3 text-sm text-red-600"><span className="font-mono text-xs uppercase tracking-wide">Overdue · </span>{fc.overdue.length} receivable{fc.overdue.length === 1 ? '' : 's'} past the supplier's payment terms</div> : null}
        {fc.bySupplier.length ? <>
          <p className="px-4 pt-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">By supplier</p>
          <RowList>{fc.bySupplier.map((r) => <Row key={`${r.key}${r.currencyCode}`}><div className="min-w-0"><p className="truncate text-sm font-medium">{r.label}</p><p className="truncate text-xs text-muted-foreground">{joinParts([`${r.count} component${r.count === 1 ? '' : 's'}`, `${money(r.receivedCents, cur(r))} received of ${money(r.expectedCents, cur(r))}`])}</p></div><span className={`text-sm ${r.overdueCents ? 'text-red-600' : ''}`}>{money(r.outstandingCents, cur(r))} due{r.overdueCents ? <span className="block font-mono text-xs uppercase tracking-wide">{money(r.overdueCents, cur(r))} overdue</span> : null}</span></Row>)}</RowList>
          <p className="px-4 pt-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">By month due</p>
          <RowList>{fc.byMonth.map((r) => <Row key={`${r.key}${r.currencyCode}`}><div className="min-w-0"><p className="truncate text-sm font-medium">{r.key === 'none' ? 'No date yet' : new Date(`${r.key}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</p><p className="truncate text-xs text-muted-foreground">{money(r.receivedCents, cur(r))} received of {money(r.expectedCents, cur(r))}</p></div><span className={`text-sm ${r.overdueCents ? 'text-red-600' : ''}`}>{money(r.outstandingCents, cur(r))} due</span></Row>)}</RowList>
          {fc.overdue.length ? <><p className="px-4 pt-3 font-mono text-xs uppercase tracking-wide text-red-600">Overdue receivables</p><RowList>{fc.overdue.map((r) => <Row key={r.id}><div className="min-w-0"><p className="truncate text-sm font-medium">{r.title}</p><p className="truncate text-xs text-muted-foreground">{joinParts([r.supplier, r.trip, `due ${day(r.dueAt)}`])}</p></div><span className="text-sm text-red-600">{money(r.outstandingCents, r.currencyCode)}<span className="block text-xs">{r.daysLate}d late</span></span></Row>)}</RowList></> : null}
        </> : <Empty>No confirmed bookings with commission yet</Empty>}
      </Panel>
      <StatusTabs active={active} hrefFor={(k) => `/dashboard/platform/commissions?status=${k}`} tabs={TABS.map((k) => ({ key: k, label: label(k), count: d[k] }))} />
      <Panel>{d.components.length ? <RowList>{d.components.map((c: any) => {
        const got = c.allocations.reduce((n: number, a: any) => n + a.amountCents, 0)
        return <Row key={c.id}><div className="min-w-0"><p className="flex items-center gap-2 text-sm font-medium"><span className="truncate">{c.title}</span><StatusLabel status={active} /></p><p className="truncate text-xs text-muted-foreground">{c.supplier?.name} · {c.commissionClaimReference ? `claimed ${day(c.commissionClaimedAt)} (${c.commissionClaimReference}) · ` : ''}<a className="underline" href={`/dashboard/platform/trips/${c.trip?.id}?tab=commissions`}>{c.trip?.title}</a> · {(c.commissionBps / 100).toFixed(2)}% · travel ends {day(c.endAt)}</p></div><div className="flex flex-wrap items-center gap-2"><span className="text-sm">{money(got, c.currencyCode)} of {money(c.commissionCents, c.currencyCode)}</span>{active === 'expected' && ['booked', 'ticketed'].includes(c.bookingStatus) ? <EntryDialog title={`Claim commission · ${c.title}`} trigger="Claim" operator="claimCommission" base={{ componentIds: [c.id] }} fields={[{ name: 'reference', label: `Claim reference sent to ${c.supplier?.name || 'the supplier'}` }]} /> : null}{['expected', 'invoiced', 'short_paid'].includes(active) && c.commissionCents - got > 0 ? <MoneyAction kind="writeoff" label="Write off" targetId={c.id} maxCents={c.commissionCents - got} approvedId={d.managerApprovals.find((a: any) => a.targetId === c.id && a.amountCents === c.commissionCents - got && a.requestedBy?.id === d.me?.id)?.id || null} /> : null}</div></Row>
      })}</RowList> : <Empty>Nothing in this status</Empty>}</Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Recent receipts">{d.commissionReceipts.length ? <RowList>{d.commissionReceipts.map((r: any) => <Row key={r.id}><div className="min-w-0"><p className="truncate text-sm font-medium">{r.supplier?.name}</p><p className="truncate text-xs text-muted-foreground">{joinParts([r.reference, r.receivedAt ? day(r.receivedAt) : '', r.allocations.map((a: any) => a.component?.title).filter(Boolean).join(', ')])}</p></div><span className="text-sm font-medium">{money(r.amountCents, r.currencyCode)}</span></Row>)}</RowList> : <Empty>No receipts</Empty>}</Panel>
        <Panel title="Advisor payouts">{payouts.size ? <RowList>{[...payouts.values()].map((p) => <Row key={p.name}><span className="text-sm font-medium">{p.name}</span><span className="text-sm">{money(p.total)}</span></Row>)}</RowList> : <Empty>No advisor ledger entries</Empty>}</Panel>
      </div>
    </PlatformPage>
  )
}
