import { NextResponse } from 'next/server'
import { getStoredCredentials, testCredentials } from '@/lib/twitter-session'

export async function POST() {
  const creds = await getStoredCredentials()
  if (!creds) {
    return NextResponse.json({ ok: false, error: 'X não conectado. Salve as credenciais primeiro.' }, { status: 400 })
  }

  const error = await testCredentials(creds)
  if (error) {
    return NextResponse.json({ ok: false, error }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
