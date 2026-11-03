import { query } from '../../lib/data'
import { PlatformPage, Panel, Empty, RowList, Row } from '../../components/PlatformPage'

function configured(code: string) {
  if (code.startsWith('pp_stripe')) return Boolean(process.env.STRIPE_SECRET_KEY && (process.env.NEXT_PUBLIC_STRIPE_KEY || process.env.STRIPE_PUBLISHABLE_KEY))
  return code.startsWith('pp_manual')
}

export async function PaymentProviderListPage() {
  const d = await query(`{ paymentProviders(orderBy: { name: asc }) { id name code isInstalled createPaymentFunction } }`)
  return (
    <PlatformPage title="Payment Providers" subtitle="Gateways used for client invoices">
      <Panel>{d.paymentProviders.length ? <RowList>{d.paymentProviders.map((p: any) => (
        <Row key={p.id}>
          <div className="min-w-0"><p className="truncate text-sm font-medium">{p.name}</p><p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{p.code} · adapter {p.createPaymentFunction}</p></div>
          <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide text-muted-foreground"><span className={`size-2 rounded-full ${p.isInstalled && configured(p.code) ? 'bg-emerald-500' : 'bg-amber-500'}`} />{p.isInstalled ? (configured(p.code) ? 'configured' : 'missing keys') : 'disabled'}</span>
        </Row>))}</RowList> : <Empty>No payment providers</Empty>}</Panel>
    </PlatformPage>
  )
}
