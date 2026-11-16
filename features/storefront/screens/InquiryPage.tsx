import { InquiryForm } from '../components/InquiryForm'

export async function InquiryPage({ searchParams }: { searchParams: Promise<{ destination?: string; travelers?: string }> }) {
  const { destination, travelers } = await searchParams
  return (
    <div className="rounded-3xl bg-slate-50 p-5 shadow-sm ring-1 ring-slate-200/60 md:p-6 space-y-4">
      <h1 className="text-2xl font-bold">Plan a trip</h1>
      <InquiryForm destination={destination?.slice(0, 200)} travelers={Math.min(99, Math.max(1, Number(travelers) || 2))} />
    </div>
  )
}
