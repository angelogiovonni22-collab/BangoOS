import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { EmailOtpType } from '@supabase/supabase-js'

function safeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = safeNext(searchParams.get('next'))

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL('/login?error=missing-confirmation-data', request.url))
  }

  const supabase = await createClient()

  if (!supabase) {
    return NextResponse.redirect(new URL('/login?error=supabase-not-configured', request.url))
  }

  const { error } = await supabase.auth.verifyOtp({
    type: type as EmailOtpType,
    token_hash: tokenHash,
  })

  if (error) {
    return NextResponse.redirect(new URL('/login?error=confirmation-failed', request.url))
  }

  return NextResponse.redirect(new URL(next, request.url))
}
