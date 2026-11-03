import { query, money, day, label } from '../../lib/data'
import { PlatformPage, Panel, Empty, RowList, Row } from '../../components/PlatformPage'
import { StatusLabel } from '../../components/StatusLabel'
import { StatusTabs } from '../../components/StatusTabs'

const TABS = ['all', 'planning', 'proposal_sent', 'accepted', 'booked', 'final_payment_due', 'paid_in_full', 'traveling', 'completed', 'cancelled']

export async function TripListPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = 'all' } = await searchParams
  const active = TABS.includes(status) ? status : 'all'
  const where = active === 'all' ? '{}' : `{ status: { equals: ${active} } }`
  const d = await query(`{ trips(where: ${where}, orderBy: { startDate: asc }, take: 100) { id tripNumber title status startDate endDate client { name } advisor { name } totalSellCents balanceDueCents currencyCode } all: tripsCount }`)
  return (
    <PlatformPage title="Trips" subtitle={`${d.all} trips`}>
      <StatusTabs active={active} hrefFor={(k) => `/dashboard/platform/trips?status=${k}`} tabs={TABS.map((k) => ({ key: k, label: label(k) }))} />
      <Panel>
        {d.trips.length ? <RowList>{d.trips.map((t: any) => (
          <Row key={t.id} href={`/dashboard/platform/trips/${t.id}`}>
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium"><span className="truncate">{t.title}</span><StatusLabel status={t.status} /></p>
              <p className="truncate text-xs text-muted-foreground">{t.tripNumber} · {t.client?.name} · {t.advisor?.name} · {day(t.startDate)} to {day(t.endDate)}</p>
            </div>
            <div className="text-xs sm:text-right"><p className="text-sm font-medium">{money(t.totalSellCents, t.currencyCode)}</p><p className="text-muted-foreground">{money(t.balanceDueCents, t.currencyCode)} due</p></div>
          </Row>))}</RowList> : <Empty>No trips in this status</Empty>}
      </Panel>
    </PlatformPage>
  )
}
