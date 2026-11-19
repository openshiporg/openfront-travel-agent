import { InquiryForm } from '../components/InquiryForm'

export async function InquiryPage({ searchParams }: { searchParams: Promise<{ destination?: string; travelers?: string }> }) {
  const { destination, travelers } = await searchParams
  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Plan a trip</h1>
        <p className="text-sm text-slate-700">Tell us about the trip. An advisor replies by email with options and prices. Sending this costs nothing.</p>
      </div>
      <InquiryForm destination={destination?.slice(0, 200)} travelers={Math.min(99, Math.max(1, Number(travelers) || 2))} />
    </div>
  )
}
