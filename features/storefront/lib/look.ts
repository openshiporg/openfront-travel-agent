const GRADS = [
  'from-teal-700 via-cyan-500 to-emerald-300',
  'from-orange-400 via-rose-400 to-indigo-700',
  'from-sky-800 via-sky-500 to-emerald-700',
  'from-blue-700 via-sky-400 to-amber-200',
  'from-emerald-800 via-teal-500 to-sky-300',
  'from-fuchsia-600 via-rose-400 to-amber-300',
]
export const gradientFor = (s: string) => GRADS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % GRADS.length]
