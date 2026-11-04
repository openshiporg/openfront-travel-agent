/** Deletes only fixtures whose trip title starts with "Depth " (and their children). Safe to call repeatedly. */
export async function cleanupDepthFixtures(p: any, dryRun = false) {
  const trips = await p.trip.findMany({ where: { title: { startsWith: 'Depth ' } }, select: { id: true, clientId: true } })
  const tripIds: string[] = trips.map((t: any) => t.id)
  if (!tripIds.length) return { trips: 0 }
  const comps = await p.tripComponent.findMany({ where: { tripId: { in: tripIds } }, select: { id: true } })
  const compIds: string[] = comps.map((c: any) => c.id)
  const invoices = await p.clientInvoice.findMany({ where: { tripId: { in: tripIds } }, select: { id: true, paymentCollectionId: true } })
  const invoiceIds = invoices.map((i: any) => i.id), collectionIds = invoices.map((i: any) => i.paymentCollectionId).filter(Boolean)
  const payments = await p.payment.findMany({ where: { OR: [{ orderId: { in: invoiceIds } }, { paymentCollectionId: { in: collectionIds } }] }, select: { id: true } })
  const paymentIds = payments.map((x: any) => x.id)
  const allocs = await p.commissionAllocation.findMany({ where: { componentId: { in: compIds } }, select: { receiptId: true, approvalId: true } })
  const receiptIds = [...new Set(allocs.map((a: any) => a.receiptId).filter(Boolean))] as string[]
  const proposals = await p.proposal.findMany({ where: { tripId: { in: tripIds } }, select: { id: true } })
  const options = await p.proposalOption.findMany({ where: { proposalId: { in: proposals.map((x: any) => x.id) } }, select: { id: true } })
  const days = await p.itineraryDay.findMany({ where: { tripId: { in: tripIds } }, select: { id: true } })
  const travelers = await p.traveler.findMany({ where: { trips: { some: { id: { in: tripIds } } } }, select: { id: true, trips: { select: { id: true } } } })
  const ownTravelers = travelers.filter((t: any) => t.trips.every((x: any) => tripIds.includes(x.id))).map((t: any) => t.id)
  const plan = { trips: tripIds.length, components: compIds.length, invoices: invoiceIds.length, payments: paymentIds.length, receipts: receiptIds.length, proposals: proposals.length, days: days.length, travelers: ownTravelers.length }
  if (dryRun) return plan
  await p.$transaction(async (tx: any) => {
    await tx.paymentWebhookEvent.deleteMany({ where: { paymentId: { in: paymentIds } } })
    await tx.refund.deleteMany({ where: { OR: [{ paymentId: { in: paymentIds } }, { orderId: { in: invoiceIds } }] } })
    await tx.payment.deleteMany({ where: { id: { in: paymentIds } } })
    await tx.paymentSession.deleteMany({ where: { paymentCollectionId: { in: collectionIds } } })
    await tx.clientInvoiceLine.deleteMany({ where: { invoiceId: { in: invoiceIds } } })
    await tx.clientInvoice.deleteMany({ where: { id: { in: invoiceIds } } })
    await tx.tripRoom.deleteMany({ where: { tripId: { in: tripIds } } })
    await tx.tripParty.deleteMany({ where: { tripId: { in: tripIds } } })
    await tx.paymentCollection.deleteMany({ where: { id: { in: collectionIds } } })
    await tx.commissionAllocation.deleteMany({ where: { componentId: { in: compIds } } })
    for (const id of receiptIds) if ((await tx.commissionAllocation.count({ where: { receiptId: id } })) === 0) await tx.commissionReceipt.delete({ where: { id } })
    await tx.advisorCommissionLedger.deleteMany({ where: { componentId: { in: compIds } } })
    await tx.supplierPayment.deleteMany({ where: { componentId: { in: compIds } } })
    await tx.clientFundsEntry.deleteMany({ where: { tripId: { in: tripIds } } })
    await tx.paymentSchedule.deleteMany({ where: { tripId: { in: tripIds } } })
    await tx.task.deleteMany({ where: { tripId: { in: tripIds } } })
    await tx.document.deleteMany({ where: { tripId: { in: tripIds } } })
    await tx.itineraryItem.deleteMany({ where: { OR: [{ dayId: { in: days.map((d: any) => d.id) } }, { componentId: { in: compIds } }] } })
    await tx.itineraryDay.deleteMany({ where: { tripId: { in: tripIds } } })
    await tx.proposalItem.deleteMany({ where: { optionId: { in: options.map((o: any) => o.id) } } })
    await tx.proposalOption.deleteMany({ where: { proposalId: { in: proposals.map((x: any) => x.id) } } })
    await tx.proposal.deleteMany({ where: { tripId: { in: tripIds } } })
    await tx.tripComponent.deleteMany({ where: { tripId: { in: tripIds } } })
    await tx.trip.deleteMany({ where: { id: { in: tripIds } } })
    if (ownTravelers.length) await tx.traveler.deleteMany({ where: { id: { in: ownTravelers } } })
  }, { timeout: 60000 })
  return plan
}
