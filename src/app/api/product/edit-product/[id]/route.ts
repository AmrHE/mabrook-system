import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import { userRoles } from "@/models/enum.constants";
import { Product } from "@/models/Product";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }>}) {

  const { id } = await params;
  
  const reqBody = await req.json()
  const { name, description, size, totalQuantity, warehouseQuantity, hospitalsQuantity } = reqBody;

  await initDb();
  /***************ADMIN GAURD START****************/
  const authHeader = req.headers.get('authorization');
  const userToken = authHeader?.split(" ")[1];
  if (!userToken){
    return NextResponse.json({status: 401, message: "Session has timed out. Please log in to use Mabrook System"})
  }

  const userPayload = jwt.verify(userToken, process.env.AUTH_SECRET as string) as { _id: string; email: string; role: string }

  if (userPayload.role === userRoles.EMPLOYEE){
    return NextResponse.json({status: 403, message: "This Action is not allowed for you"})
  }
  /***************ADMIN GAURD END****************/

  if (!userPayload) {
    return NextResponse.json({status: 400, message: "Cannot identify the user Please re-login and try again"})
  }

  const product = await Product.findById(id)

  if(!product) {
    return NextResponse.json({status: 404, message: "No product found"})
  }

    if(totalQuantity < warehouseQuantity + hospitalsQuantity) {
    return NextResponse.json({ error: "Total quantity must be greater than or equal to the sum of warehouse and hospitals quantities" }, { status: 400 });
  }

  if(totalQuantity < warehouseQuantity) {
    return NextResponse.json({ error: "Total quantity must be greater than or equal to the warehouse quantity" }, { status: 400 });
  }

  if (name) product.name = name;
  if (description) product.description = description;
  if (size) product.size = size;
  if (totalQuantity) product.totalQuantity = totalQuantity;
  if (warehouseQuantity) product.warehouseQuantity = warehouseQuantity;
  if (hospitalsQuantity) product.hospitalsQuantity = hospitalsQuantity;
  

  product.updatedAt = new Date();
  await product.save();

  return NextResponse.json({ message: "Product updated successfully", product }, { status: 200 });
}
