import { NextRequest, NextResponse } from 'next/server'
import { supabase, type AnnouncementRow } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/announcements
 * Active announcements for the in-app banner (newest first, max 3).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(3)

  if (error) {
    console.error('[announcements] GET error:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  return NextResponse.json({ announcements: (data ?? []) as AnnouncementRow[] })
}
