import { NextResponse } from "next/server";
import { z } from "zod";
import { rewriteEmail } from "@/lib/assistant";
import { getJob } from "@/lib/jobs";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  jobId: z.number().int(),
  subject: z.string(),
  body: z.string(),
  instruction: z.string().trim().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(40).default([]),
});

/** Ask the email assistant to rewrite the email or answer a question about it. */
export async function POST(req: Request) {
  // Only the app's own page sends this header (see /api/get-jobs).
  if (req.headers.get("x-link-agent") !== "1") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { jobId, subject, body, instruction, history } = parsed.data;

  const job = getJob(jobId);
  if (!job) return NextResponse.json({ error: "This opening no longer exists." }, { status: 404 });

  try {
    return NextResponse.json(await rewriteEmail(job, getSettings(), { subject, body }, history, instruction));
  } catch (err) {
    return NextResponse.json(
      { error: `The assistant couldn't answer: ${(err as Error).message}. Check that Claude Code is installed and logged in.` },
      { status: 502 },
    );
  }
}
