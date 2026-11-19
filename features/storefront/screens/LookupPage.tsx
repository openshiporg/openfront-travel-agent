import { LookupForm } from '../components/LookupForm'

export function LookupPage() {
  return (
    <div className="max-w-xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Find my booking</h1>
        <p className="text-sm text-slate-700">Enter the email your advisor has on file and the trip or invoice code from your invoice.</p>
      </div>
      <LookupForm />
    </div>
  )
}
