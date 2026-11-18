import { InquiryForm } from '../components/InquiryForm'

export async function InquiryPage({ searchParams }: { searchParams: Promise<{ destination?: string; travelers?: string }> }) {
  const { destination, travelers } = await searchParams
  return (
    <div className="p-5 md:p-6 space-y-4">
      <h1 className="text-2xl font-bold">Plan a trip</h1>
      <InquiryForm destination={destination?.slice(0, 200)} travelers={Math.min(99, Math.max(1, Number(travelers) || 2))} />
    </div>
  )
}
