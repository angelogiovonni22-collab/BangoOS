import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'
import { getSupabaseEnv } from '@/lib/supabase/env'

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
  const {
    url,
    publishableKey,
  } = getSupabaseEnv()

  if (!url || !publishableKey) {
    return null
  }

  if (browserClient) {
    return browserClient
  }

  try {
    browserClient = createBrowserClient<Database>(url, publishableKey)
  } catch {
    return null
  }

  return browserClient
}