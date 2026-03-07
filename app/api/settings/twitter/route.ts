import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET() {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['twitterAuthToken', 'twitterCt0', 'twitterTwid', 'twitterGuestId', 'twitterLastSync'] } },
  })
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))

  const token = map.twitterAuthToken ?? ''
  const hasToken = !!token
  const hasCt0 = !!map.twitterCt0

  return NextResponse.json({
    connected: hasToken && hasCt0,
    hasToken,
    hasCt0,
    hasTwid: !!map.twitterTwid,
    maskedToken: hasToken ? token.slice(0, 6) + '••••••••' + token.slice(-4) : null,
    lastSync: map.twitterLastSync ?? null,
  })
}

export async function POST(request: NextRequest) {
  let body: { authToken?: string; ct0?: string; twid?: string; guestId?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { authToken, ct0, twid, guestId } = body
  if (!authToken?.trim() || !ct0?.trim()) {
    return NextResponse.json({ error: 'authToken e ct0 são obrigatórios' }, { status: 400 })
  }

  const upserts = [
    prisma.setting.upsert({
      where: { key: 'twitterAuthToken' },
      create: { key: 'twitterAuthToken', value: authToken.trim() },
      update: { value: authToken.trim() },
    }),
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

export async function DELETE() {
  await prisma.setting.deleteMany({
    where: {
      key: { in: ['twitterAuthToken', 'twitterCt0', 'twitterTwid', 'twitterGuestId', 'twitterLastSync'] },
    },
  })
  return NextResponse.json({ success: true })
}
