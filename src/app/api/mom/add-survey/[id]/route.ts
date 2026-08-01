import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { Mom } from "@/models/Mom";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }>}) {

  const { id } = await params;
  
  const reqBody = await req.json()
  const { survey } = reqBody;

  await initDb();
  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const userPayload = auth.payload;

  if (!userPayload) {
    return NextResponse.json({status: 400, message: "Cannot identify the user Please re-login and try again"})
  }

  const mom = await Mom.findById(id)

  if(!mom) {
    return NextResponse.json({status: 404, message: "No mom found"})
  }

  // The box is locked at mom creation (it drives the stock decrement). Here we
  // only update the survey answers for the already-assigned box; we never change
  // which box was given, so stock never desyncs.
  if (Array.isArray(survey)) {
    for (const incoming of survey) {
      const existing = mom.survey?.find(
        (s: { product?: unknown }) => String(s.product) === String(incoming.product),
      );
      if (existing) existing.QA = incoming.QA;
    }
    mom.markModified("survey");
  }

  mom.updatedAt = new Date();
  await mom.save();

  return NextResponse.json({ message: "Mom updated successfully", mom }, { status: 200 });
}
