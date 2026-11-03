'use server'

import { revalidatePath } from 'next/cache'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

type Out = { success: true; data?: any } | { success: false; error: string }

export async function requestApproval(input: { actionType: string; targetId: string; amountCents?: number; reason: string }): Promise<Out> {
  const res = await keystoneClient(
    `mutation($a: String!, $t: String!, $m: Int, $r: String!) { requestManagerApproval(actionType: $a, targetId: $t, amountCents: $m, reason: $r) }`,
    { a: input.actionType, t: input.targetId, m: input.amountCents ?? null, r: input.reason }
  )
  revalidatePath('/dashboard/platform/approvals')
  return res.success ? { success: true, data: (res.data as any).requestManagerApproval } : { success: false, error: res.error }
}

export async function decideApproval(approvalId: string, decision: 'approved' | 'rejected'): Promise<Out> {
  const res = await keystoneClient(`mutation($id: ID!, $d: String!) { decideManagerApproval(approvalId: $id, decision: $d) }`, { id: approvalId, d: decision })
  revalidatePath('/dashboard/platform/approvals')
  return res.success ? { success: true } : { success: false, error: res.error }
}
