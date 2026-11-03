import { query, money } from '../../lib/data'
import { PlatformPage, Panel, Empty } from '../../components/PlatformPage'

export async function SettingsPage() {
  const d = await query(`{ agencySettingsRecords(take: 1) { id name address email phone defaultPlanningFeeCents refundApprovalThresholdCents hostAgencySplitBps currencyCode } }`)
  const s = d.agencySettingsRecords[0]
  return (
    <PlatformPage title="Settings" subtitle="Agency details and money defaults">
      <Panel>{s ? (
        <dl className="space-y-2 text-sm">
          {[['Agency', s.name], ['Address', s.address], ['Email', s.email], ['Phone', s.phone], ['Default planning fee', money(s.defaultPlanningFeeCents, s.currencyCode)], ['Refund approval above', money(s.refundApprovalThresholdCents, s.currencyCode)], ['Host agency split', `${(s.hostAgencySplitBps / 100).toFixed(2)}%`], ['Currency', s.currencyCode]].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4"><dt className="text-muted-foreground">{k}</dt><dd className="text-right">{v}</dd></div>))}
        </dl>) : <Empty>Agency details are not set up yet</Empty>}</Panel>
    </PlatformPage>
  )
}
