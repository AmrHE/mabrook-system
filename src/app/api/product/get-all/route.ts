import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import { Product } from "@/models/Product";

export async function GET(req: NextRequest) {
  await initDb();
  /***************AUTH GAURD START****************/
  const authHeader = req.headers.get('authorization');
  const userToken = authHeader?.split(" ")[1];
  if (!userToken){
    return NextResponse.json({status: 401, message: "Session has timed out. Please log in to use Mabrook System"})
  }

  const userPayload = jwt.verify(userToken, process.env.AUTH_SECRET as string) as { _id: string; email: string; role: string }
  /***************AUTH GAURD END****************/

  if (!userPayload) {
    return NextResponse.json({status: 400, message: "Cannot identify the user Please re-login and try again"})
  }

  const products = await Product
  .find()
  .populate('createdBy', 'email firstName lastName')
  .sort({ totalQuantity: 1 });

  if(!products) {
    return NextResponse.json({status: 404, message: "No products found"})
  }

  return NextResponse.json({ message: "Products fetched successfully", products }, { status: 200 });
}
