import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

// Called by the bookmarklet after import to keep session cookies fresh server-side.
export async function POST(request: NextRequest) {
  let body: { ct0?: string; twid?: string; guestId?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { ct0, twid, guestId } = body
  if (!ct0?.trim()) {
    return NextResponse.json({ error: 'ct0 é obrigatório' }, { status: 400 })
  }

  // Only update if auth_token already exists (user is connected)
  const existing = await prisma.setting.findUnique({ where: { key: 'twitterAuthToken' } })
  if (!existing) {
    return NextResponse.json({ error: 'Não conectado' }, { status: 404 })
  }

  const upserts = [
    prisma.setting.upsert({
      where: { key: 'twitterCt0' },
      create: { key: 'twitterCt0', value: ct0.trim() },
      update: { value: ct0.trim() },
    }),
  ]

  if (twid?.trim()) {
    upserts.push(prisma.setting.upsert({
      where: { key: 'twitterTwid' },
      create: { key: 'twitterTwid', value: twid.trim() },
      update: { value: twid.trim() },
    }))
  }

  if (guestId?.trim()) {
    upserts.push(prisma.setting.upsert({
      where: { key: 'twitterGuestId' },
      create: { key: 'twitterGuestId', value: guestId.trim() },
      update: { value: guestId.trim() },
    }))
  }

  await Promise.all(upserts)
  return NextResponse.json({ success: true })
}
