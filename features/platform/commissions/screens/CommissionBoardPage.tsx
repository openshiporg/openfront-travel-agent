import { query, money, day, label } from '../../lib/data'
import { PlatformPage, Panel, Empty, RowList, Row } from '../../components/PlatformPage'
import { StatusLabel } from '../../components/StatusLabel'
import { StatusTabs } from '../../components/StatusTabs'
import { MoneyAction } from '../../components/MoneyAction'
import { joinParts } from '../../lib/text'
import { ReceiptForm } from '../components/ReceiptForm'

const TABS = ['expected', 'invoiced', 'received', 'short_paid', 'written_off']

export async function CommissionBoardPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = 'expected' } = await searchParams
  const active = TABS.includes(status) ? status : 'expected'
  const d = await query(`{
    components: tripComponents(where: { commissionStatus: { equals: ${active} }, commissionCents: { gt: 0 } }, orderBy: { endAt: asc }, take: 100) { id title commissionBps commissionCents currencyCode endAt supplier { name commissionPaymentTermsDays } trip { id title advisor { name } } allocations { amountCents } }
    ${TABS.map((t) => `${t}: tripComponentsCount(where: { commissionStatus: { equals: ${t} }, commissionCents: { gt: 0 } })`).join('\n')}
    open: tripComponents(where: { commissionStatus: { in: [expected, short_paid] }, commissionCents: { gt: 0 }, supplier: { id: { not: null } } }, orderBy: { endAt: asc }, take: 200) { id title currencyCode commissionCents supplier { id name } trip { title } allocations { amountCents } }
    commissionReceipts(orderBy: { receivedAt: desc }, take: 10) { id reference amountCents currencyCode receivedAt supplier { name } allocations { amountCents component { title } } }
    managerApprovals(where: { status: { equals: approved }, actionType: { equals: commission_writeoff } }, take: 100) { id targetId amountCents requestedBy { id } }
    me: authenticatedItem { ... on User { id } }
    advisorCommissionLedgers(take: 500) { amountCents advisor { id name } }
  }`)
  const payouts = new Map<string, { name: string; total: number }>()
  for (const e of d.advisorCommissionLedgers) { const p = payouts.get(e.advisor.id) || { name: e.advisor.name, total: 0 }; p.total += e.amountCents; payouts.set(e.advisor.id, p) }
  const openComponents = d.open.map((c: any) => ({ id: c.id, title: c.title, tripTitle: c.trip?.title || '', supplierId: c.supplier.id, supplierName: c.supplier.name, currencyCode: c.currencyCode, remainingCents: c.commissionCents - c.allocations.reduce((n: number, a: any) => n + a.amountCents, 0) })).filter((c: any) => c.remainingCents > 0)
  return (
    <PlatformPage title="Commissions" subtitle="Expected, received and short-paid supplier commissions" actions={<ReceiptForm components={openComponents} />}>
      <StatusTabs active={active} hrefFor={(k) => `/dashboard/platform/commissions?status=${k}`} tabs={TABS.map((k) => ({ key: k, label: label(k), count: d[k] }))} />
      <Panel>{d.components.length ? <RowList>{d.components.map((c: any) => {
        const got = c.allocations.reduce((n: number, a: any) => n + a.amountCents, 0)
        return <Row key={c.id}><div className="min-w-0"><p className="flex items-center gap-2 text-sm font-medium"><span className="truncate">{c.title}</span><StatusLabel status={active} /></p><p className="truncate text-xs text-muted-foreground">{c.supplier?.name} · <a className="underline" href={`/dashboard/platform/trips/${c.trip?.id}?tab=commissions`}>{c.trip?.title}</a> · {(c.commissionBps / 100).toFixed(2)}% · travel ends {day(c.endAt)}</p></div><div className="flex flex-wrap items-center gap-2"><span className="text-sm">{money(got, c.currencyCode)} of {money(c.commissionCents, c.currencyCode)}</span>{['expected', 'short_paid'].includes(active) && c.commissionCents - got > 0 ? <MoneyAction kind="writeoff" label="Write off" targetId={c.id} maxCents={c.commissionCents - got} approvedId={d.managerApprovals.find((a: any) => a.targetId === c.id && a.amountCents === c.commissionCents - got && a.requestedBy?.id === d.me?.id)?.id || null} /> : null}</div></Row>
      })}</RowList> : <Empty>Nothing in this status</Empty>}</Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Recent receipts">{d.commissionReceipts.length ? <RowList>{d.commissionReceipts.map((r: any) => <Row key={r.id}><div className="min-w-0"><p className="truncate text-sm font-medium">{r.supplier?.name}</p><p className="truncate text-xs text-muted-foreground">{joinParts([r.reference, r.receivedAt ? day(r.receivedAt) : '', r.allocations.map((a: any) => a.component?.title).filter(Boolean).join(', ')])}</p></div><span className="text-sm font-medium">{money(r.amountCents, r.currencyCode)}</span></Row>)}</RowList> : <Empty>No receipts</Empty>}</Panel>
        <Panel title="Advisor payouts">{payouts.size ? <RowList>{[...payouts.values()].map((p) => <Row key={p.name}><span className="text-sm font-medium">{p.name}</span><span className="text-sm">{money(p.total)}</span></Row>)}</RowList> : <Empty>No advisor ledger entries</Empty>}</Panel>
      </div>
    </PlatformPage>
  )
}
