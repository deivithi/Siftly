import { NextResponse } from 'next/server'
import { getCliAuthStatus } from '@/lib/claude-cli-auth'

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(await getCliAuthStatus())
}
