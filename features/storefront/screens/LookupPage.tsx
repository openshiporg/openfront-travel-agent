import { LookupForm } from '../components/LookupForm'

export function LookupPage() {
  return (
    <div className="rounded-3xl bg-slate-50 p-5 shadow-sm ring-1 ring-slate-200/60 md:p-6 space-y-4">
      <h1 className="text-2xl font-bold">Find my booking</h1>
      <LookupForm />
    </div>
  )
}
