'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    if (!supabase) {
      setError('Supabase is not configured. Check your environment variables.')
      setLoading(false)
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    router.push('/')
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '3rem 1.5rem' }}>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 16, padding: '2rem', background: '#fff' }}>
        <h1 style={{ margin: '0 0 0.5rem', fontSize: '2rem', color: '#111827' }}>Sign in</h1>
        <p style={{ margin: '0 0 1.5rem', color: '#6b7280' }}>
          Access your account with Supabase authentication.
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

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.8rem 1rem',
              borderRadius: 10,
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 700,
            }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p style={{ marginTop: '1rem', color: '#6b7280' }}>
          Need an account?{' '}
          <a href="/signup" style={{ color: '#2563eb', fontWeight: 600 }}>
            Create one
          </a>
        </p>
      </div>
    </main>
  )
}
