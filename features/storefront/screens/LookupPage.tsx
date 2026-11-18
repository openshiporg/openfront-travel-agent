import { LookupForm } from '../components/LookupForm'

export function LookupPage() {
  return (
    <div className="p-5 md:p-6 space-y-4">
      <h1 className="text-2xl font-bold">Find my booking</h1>
      <LookupForm />
    </div>
  )
}
