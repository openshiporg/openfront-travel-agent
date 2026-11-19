import { cache } from 'react'
import { publicRequest } from './graphql'

export type Agency = { name: string; address: string; email: string; phone: string }
/** The agency's own name and contact details from its settings. */
export const getAgency = cache(async (): Promise<Agency> => {
  try { return (await publicRequest<{ publicAgency: Agency }>(`{ publicAgency }`)).publicAgency } catch { return { name: '', address: '', email: '', phone: '' } }
})
