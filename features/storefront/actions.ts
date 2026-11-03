'use server'

import { randomUUID } from 'node:crypto'
import { publicRequest } from './lib/graphql'

type Result<T = any> = { ok: true; data: T } | { ok: false; error: string }
async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try { return { ok: true, data: await fn() } } catch (e: any) { return { ok: false, error: e?.message || 'Request failed' } }
}

export async function submitInquiryAction(input: Record<string, unknown>) {
  return run(async () => (await publicRequest(`mutation($input: TravelJSON!) { submitInquiry(input: $input) }`, { input })).submitInquiry)
}
export async function acceptProposalAction(token: string, optionId: string, name: string) {
  return run(async () => (await publicRequest(`mutation($token: String!, $optionId: ID!, $name: String!, $key: String!) { acceptProposal(token: $token, optionId: $optionId, name: $name, idempotencyKey: $key) }`, { token, optionId, name, key: randomUUID() })).acceptProposal)
}
export async function startInvoicePayment(token: string) {
  return run(async () => (await publicRequest(`mutation($token: String!, $key: String!) { payInvoice(token: $token, idempotencyKey: $key) }`, { token, key: randomUUID() })).payInvoice)
}
export async function confirmInvoicePaymentAction(token: string, paymentIntentId: string) {
  return run(async () => (await publicRequest(`mutation($token: String!, $pi: String!) { confirmInvoicePayment(token: $token, paymentIntentId: $pi) }`, { token, pi: paymentIntentId })).confirmInvoicePayment)
}
export async function lookupBookingAction(email: string, code: string) {
  return run(async () => (await publicRequest(`query($email: String!, $code: String!) { lookupBooking(email: $email, code: $code) }`, { email, code })).lookupBooking)
}
export async function stripePublishableKey() {
  const key = process.env.NEXT_PUBLIC_STRIPE_KEY || process.env.STRIPE_PUBLISHABLE_KEY || ''
  return key.startsWith('pk_test_') ? key : ''
}
