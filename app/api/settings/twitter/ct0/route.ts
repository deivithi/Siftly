import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

// Called by the bookmarklet after a successful import to keep ct0 fresh server-side.
export async function POST(request: NextRequest) {
  let body: { ct0?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { ct0 } = body
  if (!ct0?.trim()) {
    return NextResponse.json({ error: 'ct0 é obrigatório' }, { status: 400 })
  }

  // Only update ct0 if auth_token already exists (user is connected)
  const existing = await prisma.setting.findUnique({ where: { key: 'twitterAuthToken' } })
  if (!existing) {
    return NextResponse.json({ error: 'Não conectado' }, { status: 404 })
  }

  await prisma.setting.upsert({
    where: { key: 'twitterCt0' },
    create: { key: 'twitterCt0', value: ct0.trim() },
    update: { value: ct0.trim() },
  })

  return NextResponse.json({ success: true })
}
