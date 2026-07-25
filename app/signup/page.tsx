'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setMessage(null)
    setError(null)

    const supabase = createClient()

    if (!supabase) {
      setError('Supabase is not configured. Check your environment variables.')
      setLoading(false)
      return
    }

    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/confirm` : undefined

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.user && !data.session) {
      setMessage('Check your inbox to confirm your email before signing in.')
    } else {
      setMessage('Account created successfully.')
    }

    setLoading(false)
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '3rem 1.5rem' }}>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 16, padding: '2rem', background: '#fff' }}>
        <h1 style={{ margin: '0 0 0.5rem', fontSize: '2rem', color: '#111827' }}>Create account</h1>
        <p style={{ margin: '0 0 1.5rem', color: '#6b7280' }}>
          Create a new Supabase account for this app.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <label style={{ display: 'grid', gap: '0.35rem', color: '#374151', fontWeight: 600 }}>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              style={{ padding: '0.75rem 0.9rem', borderRadius: 10, border: '1px solid #d1d5db' }}
            />
          </label>

          <label style={{ display: 'grid', gap: '0.35rem', color: '#374151', fontWeight: 600 }}>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              style={{ padding: '0.75rem 0.9rem', borderRadius: 10, border: '1px solid #d1d5db' }}
            />
          </label>

          {error ? (
            <div style={{ padding: '0.75rem', borderRadius: 10, background: '#fef2f2', color: '#991b1b' }}>
              {error}
            </div>
          ) : null}

          {message ? (
            <div style={{ padding: '0.75rem', borderRadius: 10, background: '#ecfdf3', color: '#065f46' }}>
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.8rem 1rem',
              borderRadius: 10,
              border: 'none',
              background: '#111827',
              color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 700,
            }}
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p style={{ marginTop: '1rem', color: '#6b7280' }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: '#2563eb', fontWeight: 600 }}>
            Sign in
          </a>
        </p>
      </div>
    </main>
  )
}
