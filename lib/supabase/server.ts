import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database.types'
import { getSupabaseEnv } from '@/lib/supabase/env'

export async function createClient() {
  const cookieStore = await cookies()
  const { url, publishableKey } = getSupabaseEnv()

  if (!url || !publishableKey) {
    return null
  }

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // The `setAll` method can throw if called during a Server Component render.
        }
      },
    },
  })
}
