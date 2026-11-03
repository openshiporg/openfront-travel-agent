import { query, money, day } from '../../lib/data'
import { PlatformPage, Panel, Empty, RowList, Row } from '../../components/PlatformPage'

export async function ClientListPage() {
  const d = await query(`{ clients(orderBy: { name: asc }, take: 200) { id name email phone source preferences lifetimeValueCents travelers { id firstName lastName passportOnFile passportExpiresAt } trips { id } } }`)
  return (
    <PlatformPage title="Clients & Travelers" subtitle={`${d.clients.length} client households`}>
      <Panel>{d.clients.length ? <RowList>{d.clients.map((c: any) => (
        <Row key={c.id}>
          <div className="min-w-0"><p className="truncate text-sm font-medium">{c.name}</p><p className="truncate text-xs text-muted-foreground">{c.email} · {c.phone || 'No phone'} · {c.source || 'No source'}</p>{c.preferences ? <p className="truncate text-xs text-muted-foreground">{c.preferences}</p> : null}</div>
          <div className="text-xs sm:text-right"><p className="text-sm font-medium">{money(c.lifetimeValueCents)}</p><p className="text-muted-foreground">{c.trips.length} trips · {c.travelers.length} travelers</p></div>
        </Row>))}</RowList> : <Empty>No clients</Empty>}</Panel>
    </PlatformPage>
  )
}
