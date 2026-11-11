import { notFound } from 'next/navigation'
import { publicRequest } from '../lib/graphql'
import { ProposalChoice } from '../components/ProposalChoice'

export async function ProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  let p: any = null
  try { p = (await publicRequest(`query($token: String!) { viewProposal(token: $token) }`, { token })).viewProposal } catch {}
  if (!p) notFound()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{p.trip.title}</h1>
      {p.introNote ? <p className="text-sm text-muted-foreground">{p.introNote}</p> : null}
      <ProposalChoice token={token} options={p.options} currency={p.trip.currencyCode} status={p.status} depositBps={p.depositBps || 0} />
    </div>
  )
}
