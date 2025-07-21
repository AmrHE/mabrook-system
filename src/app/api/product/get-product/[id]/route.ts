import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import { userRoles } from "@/models/enum.constants";
import { Product } from "@/models/Product";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }>}) {

  const { id } = await params;

  
  await initDb();
  /***************AUTH GAURD START****************/
  const authHeader = req.headers.get('authorization');
  const userToken = authHeader?.split(" ")[1];
  if (!userToken){
    return NextResponse.json({status: 401, message: "Session has timed out. Please log in to use Mabrook System"})
  }

  const userPayload = jwt.verify(userToken, process.env.AUTH_SECRET as string) as { _id: string; email: string; role: string }
  /***************AUTH GAURD END****************/

  // console.log("User Payload:", userPayload);

  if (!userPayload) {
    return NextResponse.json({status: 400, message: "Cannot identify the user Please re-login and try again"})
  }

  if(userPayload.role === userRoles.EMPLOYEE) {
    return NextResponse.json({status: 403, message: "You are not authorized to view this product"}, { status: 403 });
  }

  const product = await Product.findById(id) //TODO: ADD THE populate functionality FOR THE PRODUCT CREATOR HERE
  // .populate('createdBy', 'email firstName lastName');

  if(!product) {
    return NextResponse.json({status: 404, message: "No product found with the provided ID"})
  }

  return NextResponse.json({ message: "Product fetched successfully", product }, { status: 200 });
}
