'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

const OPERATORS = new Set(['saveTripTraveler', 'buildProposal', 'addItineraryDay', 'addItineraryItem', 'updateTripPlanning', 'updateComponentTerms', 'sendProposal', 'generatePaymentSchedule', 'issueClientInvoice', 'recordClientPayment', 'transitionTrip', 'bookComponent', 'cancelComponent', 'recordSupplierPayment', 'recordCommissionReceipt', 'sweepTripDates', 'createTripFromInquiry', 'shareItinerary', 'refundClientPayment', 'writeOffCommission'])

/** Runs one custom operator mutation; each click carries its own idempotency key. */
export async function runOperator(name: string, input: Record<string, unknown>, revalidate?: string) {
  if (!OPERATORS.has(name)) return { success: false as const, error: 'Unknown action' }
  const res = await keystoneClient(`mutation Op($input: TravelJSON!) { ${name}(input: $input) }`, { input: { ...input, idempotencyKey: randomUUID() } })
  if (revalidate) revalidatePath(revalidate)
  return res.success ? { success: true as const, data: (res.data as any)[name] } : { success: false as const, error: res.error }
}
