import { InquiryForm } from '../components/InquiryForm'

export async function InquiryPage({ searchParams }: { searchParams: Promise<{ destination?: string }> }) {
  const { destination } = await searchParams
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Plan a trip</h1>
      <InquiryForm destination={destination?.slice(0, 200)} />
    </div>
  )
}
