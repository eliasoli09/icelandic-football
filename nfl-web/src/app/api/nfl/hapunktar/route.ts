import { NextResponse } from 'next/server'
import { FEED_URL, parseFeed } from '@/lib/nfl/highlights'

export const revalidate = 600

/** The newest videos on the NFL's YouTube channel; the dashboard filters them by club. */
export async function GET() {
  try {
    const res = await fetch(FEED_URL, { next: { revalidate: 600 } })
    if (!res.ok) throw new Error(`YouTube svaraði ${res.status}`)
    return NextResponse.json({ videos: parseFeed(await res.text()) })
  } catch (e) {
    return NextResponse.json({ videos: [], error: e instanceof Error ? e.message : String(e) })
  }
}
