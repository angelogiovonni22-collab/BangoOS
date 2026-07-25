import { createClient } from '@/lib/supabase/server'

export default async function SupabaseTestPage() {
  let supabaseClient = null
  let status: 'success' | 'error' = 'error'
  let message = 'Supabase configuration failed.'

  try {
    supabaseClient = await createClient()

    if (supabaseClient) {
      status = 'success'
      message = 'Supabase configuration successful'
    } else {
      message = 'Supabase environment variables are missing. Check your .env.local file.'
    }
  } catch (error) {
    message = error instanceof Error ? error.message : 'Unknown Supabase configuration error.'
  }

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '3rem 1.5rem' }}>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 16, padding: '2rem', background: '#fff' }}>
        <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2563eb' }}>
          Supabase connection check
        </p>
        <h1 style={{ margin: '0.5rem 0 1rem', fontSize: '2rem', color: '#111827' }}>
          Supabase integration test
        </h1>
        <p style={{ margin: 0, color: '#4b5563', lineHeight: 1.6 }}>
          This page confirms that the Supabase client can be created in this Next.js app without touching the existing dashboard or CRM routes.
        </p>

        <div
          style={{
            marginTop: '1.5rem',
            padding: '1rem 1.25rem',
            borderRadius: 12,
            background: status === 'success' ? '#ecfdf3' : '#fef2f2',
            border: `1px solid ${status === 'success' ? '#a7f3d0' : '#fecaca'}`,
            color: status === 'success' ? '#065f46' : '#991b1b',
          }}
        >
          <strong>{message}</strong>
        </div>

        <div style={{ marginTop: '1.25rem', color: '#6b7280' }}>
          <p style={{ margin: '0 0 0.5rem' }}>
            Status: <strong>{status === 'success' ? 'Ready' : 'Needs configuration'}</strong>
          </p>
          <p style={{ margin: 0 }}>
            Client initialized: <strong>{supabaseClient ? 'Yes' : 'No'}</strong>
          </p>
        </div>
      </div>
    </main>
  )
}
