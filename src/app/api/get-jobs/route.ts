import { NextResponse } from "next/server";
import { runStatus, startRun, stopRun } from "@/lib/runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Where the current or last "Get jobs" run is. */
export function GET() {
  return NextResponse.json(runStatus());
}

// Only the app's own button sends this header. A browser won't let another
// website add a custom header to a cross-site request, so this blocks pages
// you visit from starting searches or stopping them.
function fromApp(req: Request): boolean {
  return req.headers.get("x-link-agent") === "1";
}

/** Start a run (or return the one already running). */
export function POST(req: Request) {
  if (!fromApp(req)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  try {
    return NextResponse.json(startRun());
  } catch (err) {
    return NextResponse.json({ state: "failed", message: (err as Error).message }, { status: 500 });
  }
}

/** Stop the running search. */
export function DELETE(req: Request) {
  if (!fromApp(req)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  return NextResponse.json(stopRun());
}
