import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { userRoles } from "@/models/enum.constants";
import { Product } from "@/models/Product";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }>}) {

  const { id } = await params;
  
  const reqBody = await req.json()
  const { questions } = reqBody;

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

  const product = await Product.findOne({_id: id, isActive: true})

  if(!product) {
    return NextResponse.json({status: 404, message: "No product found"})
  }

  if (questions) product.questions = questions;

  product.updatedAt = new Date();
  await product.save();

  return NextResponse.json({ message: "Product updated successfully", product }, { status: 200 });
}
