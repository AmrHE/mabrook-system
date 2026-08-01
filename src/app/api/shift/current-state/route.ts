import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { getCurrentState } from "@/utils/shift/currentState";

export const dynamic = "force-dynamic";

/**
 * The dashboard's live state. The page renders from `getCurrentState` directly;
 * this endpoint exists so the client can resync after a mutation, on tab focus,
 * and when a phone wakes up — which is what makes the UI survive a browser
 * restart now that no cookie carries the shift/visit state.
 */
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth.error) return auth.error;

  const state = await getCurrentState(auth.payload._id);
  return NextResponse.json({ state }, { status: 200 });
}
