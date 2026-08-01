import mongoose from "mongoose";
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { userRoles } from "@/models/enum.constants";
import { Mom } from "@/models/Mom";
import { Visit } from "@/models/Visit";
import { adjustHospitalStock } from "@/utils/stock/recompute";
// import bcrypt from "bcrypt";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }>}) {

  const { id } = await params;
  

  await initDb();
  /***************ADMIN GAURD START****************/
  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const userPayload = auth.payload;

  if (userPayload.role !== userRoles.ADMIN){
    return NextResponse.json({status: 403, message: "This Action is only allowed for Admins"})
  }
  /***************ADMIN GAURD END****************/

  if (!userPayload) {
    return NextResponse.json({status: 400, message: "Cannot identify the user Please re-login and try again"})
  }

  const mom = await Mom.findById(id)

  if(!mom) {
    return NextResponse.json({status: 404, message: "No mom found"})
  }

  const session = await mongoose.startSession();
  let txError: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any

  try {
    await session.withTransaction(async () => {
      // Restore the given box(es) to the hospital's stock — but only on the first
      // deletion (guard against a re-delete double-crediting stock).
      if (mom.isActive && mom.visitId && Array.isArray(mom.survey) && mom.survey.length) {
        const visit = await Visit.findById(mom.visitId).session(session);
        if (visit?.hospitalId) {
          for (const s of mom.survey) {
            if (s?.product) await adjustHospitalStock(visit.hospitalId, s.product, +1, session);
          }
        }
      }

      mom.isActive = false;
      mom.deletedAt = new Date();
      await mom.save({ session });
    });
  } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    txError = err;
  } finally {
    await session.endSession();
  }

  if (txError) {
    return NextResponse.json({ status: 500, message: txError.message || "Failed to delete mom" }, { status: 500 });
  }

  return NextResponse.json({ message: "Mom updated successfully", mom }, { status: 200 });
}
