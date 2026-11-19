import { notFound } from 'next/navigation'
import { publicRequest } from '../lib/graphql'
import { ProposalChoice } from '../components/ProposalChoice'

export async function ProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  let p: any = null
  try { p = (await publicRequest(`query($token: String!) { viewProposal(token: $token) }`, { token })).viewProposal } catch {}
  if (!p) notFound()
  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-slate-600">Trip proposal{p.version > 1 ? ` · version ${p.version}` : ''}</p>
        <h1 className="text-3xl font-bold tracking-tight">{p.trip.title}</h1>
        {p.introNote ? <p className="whitespace-pre-line text-base text-slate-700">{p.introNote}</p> : null}
      </div>
      <ProposalChoice token={token} options={p.options} currency={p.trip.currencyCode} status={p.status} depositBps={p.depositBps || 0} />
    </div>
  )
}
