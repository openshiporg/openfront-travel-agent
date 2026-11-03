import { getServerGraphQLTarget } from '@/features/dashboard/lib/getBaseUrl'
import { GraphQLClient } from 'graphql-request'
import { publicGraphQLErrorMessage } from '@/features/dashboard/lib/security'

/** Server-side call to the custom public operations only; no session is forwarded. */
export async function publicRequest<T = any>(document: string, variables: Record<string, unknown> = {}): Promise<T> {
  const { endpoint, fetch: internalFetch } = await getServerGraphQLTarget()
  const client = new GraphQLClient(endpoint, { redirect: 'error', ...(internalFetch ? { fetch: internalFetch } : {}) })
  try {
    return await client.request<T>(document, variables)
  } catch (error) {
    const messages = (error as any)?.response?.errors?.map((e: any) => e?.message).filter(Boolean)
    const known = /not found|not payable|no longer available|required|valid email/i
    throw new Error(messages?.find((m: string) => known.test(m)) || publicGraphQLErrorMessage(error))
  }
}
