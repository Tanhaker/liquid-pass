import { NextResponse } from "next/server";
import { activityToJson } from "@/lib/activity";
import { loadActivity } from "@/lib/activityServer";

/**
 * The activity feed for the explorer and the pass pages.
 *
 * One server-side read shared by every visitor, instead of each browser
 * scanning the chain for itself -- see lib/activityServer.ts for why.
 *
 * Cacheable for a few seconds at the CDN: long enough that a busy page costs
 * one read, short enough that a purchase shows up in the feed almost at once.
 */

export const maxDuration = 30;

const MAX_LIMIT = 500;

export async function GET(req: Request) {
  const asked = Number(new URL(req.url).searchParams.get("limit") ?? 25);
  const limit = Number.isFinite(asked) ? Math.min(Math.max(Math.trunc(asked), 1), MAX_LIMIT) : 25;

  try {
    const { activity, scannedTo } = await loadActivity(limit);
    return NextResponse.json(
      { scannedTo, activity: activity.map(activityToJson) },
      {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=3, stale-while-revalidate=10",
        },
      },
    );
  } catch (e) {
    return NextResponse.json(
      { error: `Could not read contract events: ${(e as Error).message}` },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
