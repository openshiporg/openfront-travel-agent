import { query, label } from '../../lib/data'
import { PlatformPage, Panel, Empty, RowList, Row } from '../../components/PlatformPage'

export async function SupplierListPage() {
  const d = await query(`{ suppliers(orderBy: { name: asc }, take: 200) { id name kind defaultCommissionBps commissionPaymentTermsDays iataCliaNotes contacts { id name email } components { id } } }`)
  return (
    <PlatformPage title="Suppliers" subtitle={`${d.suppliers.length} suppliers`}>
      <Panel>{d.suppliers.length ? <RowList>{d.suppliers.map((s: any) => (
        <Row key={s.id}>
          <div className="min-w-0"><p className="truncate text-sm font-medium">{s.name}</p><p className="truncate font-mono text-xs uppercase tracking-wide text-muted-foreground">{label(s.kind)}{s.iataCliaNotes ? ` · ${s.iataCliaNotes}` : ''}</p><p className="truncate text-xs text-muted-foreground">{s.contacts.map((c: any) => c.email).join(', ')}</p></div>
          <div className="text-xs sm:text-right"><p className="text-sm font-medium">{(s.defaultCommissionBps / 100).toFixed(2)}% commission</p><p className="text-muted-foreground">Paid within {s.commissionPaymentTermsDays} days · {s.components.length} components</p></div>
        </Row>))}</RowList> : <Empty>No suppliers</Empty>}</Panel>
    </PlatformPage>
  )
}
