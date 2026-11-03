import { query, money, day } from '../../lib/data'
import { PlatformPage, Panel, Empty, RowList, Row } from '../../components/PlatformPage'
import { StatusLabel } from '../../components/StatusLabel'

export async function OverviewPage() {
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString()
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString()
  const d = await query(`query Overview($in30: DateTime!) {
    due: paymentSchedules(where: { status: { equals: due }, dueAt: { lte: $in30 } }, orderBy: { dueAt: asc }, take: 50) { id kind amountCents currencyCode dueAt trip { id tripNumber title } }
    components: tripComponents(where: { bookingStatus: { not: { equals: cancelled } } }, take: 500) { commissionCents commissionStatus allocations { amountCents } }
    traveling: trips(where: { status: { equals: traveling } }, take: 20) { id tripNumber title endDate client { name } }
    inquiries(where: { status: { in: [new, qualifying, proposal] } }, orderBy: { createdAt: desc }, take: 10) { id name tripType destinations status }
  }`, { in30 })
  const sum = (rows: any[]) => rows.reduce((n, r) => n + r.amountCents, 0)
  const due7 = d.due.filter((r: any) => r.dueAt <= in7)
  const expected = d.components.reduce((n: number, c: any) => n + c.commissionCents, 0)
  const received = d.components.reduce((n: number, c: any) => n + c.allocations.reduce((m: number, a: any) => m + a.amountCents, 0), 0)
  const stats = [
    { label: 'Due in 7 days', value: money(sum(due7)), sub: `${due7.length} payments` },
    { label: 'Due in 30 days', value: money(sum(d.due)), sub: `${d.due.length} payments` },
    { label: 'Commission expected', value: money(expected), sub: 'all open components' },
    { label: 'Commission received', value: money(received), sub: `${money(Math.max(expected - received, 0))} outstanding` },
  ]
  return (
    <PlatformPage title="Dashboard" subtitle="Payments, commissions and trips in progress">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-lg font-semibold md:text-xl">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Payments due">
          {d.due.length ? <RowList>{d.due.slice(0, 8).map((r: any) => (
            <Row key={r.id} href={`/dashboard/platform/trips/${r.trip?.id}`}>
              <div className="min-w-0"><p className="truncate text-sm font-medium">{r.trip?.title}</p><p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{r.kind.replace(/_/g, ' ')} · {day(r.dueAt)}</p></div>
              <span className="text-sm font-medium">{money(r.amountCents, r.currencyCode)}</span>
            </Row>))}</RowList> : <Empty>No payments due in the next 30 days</Empty>}
        </Panel>
        <Panel title="Traveling now">
          {d.traveling.length ? <RowList>{d.traveling.map((t: any) => (
            <Row key={t.id} href={`/dashboard/platform/trips/${t.id}`}><div className="min-w-0"><p className="truncate text-sm font-medium">{t.title}</p><p className="text-xs text-muted-foreground">{t.client?.name} · returns {day(t.endDate)}</p></div></Row>))}</RowList> : <Empty>Nobody is traveling</Empty>}
        </Panel>
        <Panel title="Open inquiries">
          {d.inquiries.length ? <RowList>{d.inquiries.map((i: any) => (
            <Row key={i.id} href="/dashboard/platform/inquiries"><div className="min-w-0"><p className="truncate text-sm font-medium">{i.name}</p><p className="truncate text-xs text-muted-foreground">{i.destinations || i.tripType}</p></div><StatusLabel status={i.status} /></Row>))}</RowList> : <Empty>No open inquiries</Empty>}
        </Panel>
      </div>
    </PlatformPage>
  )
}
