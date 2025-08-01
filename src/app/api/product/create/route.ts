import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import { userRoles } from "@/models/enum.constants";
import { initDb } from "../../../../lib/mongoose";
import { Product } from "@/models/Product";



export async function POST(req: NextRequest) {

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

  const { name, description, imageUrl, totalQuantity, warehouseQuantity, hospitalsQuantity, size } = await req.json();

  if (!name || !description || !imageUrl || !totalQuantity ) {
    if(totalQuantity === 0 || totalQuantity < 0) {
      return NextResponse.json({ error: "Total quantity must be greater than 0" }, { status: 400 });
    }
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if(totalQuantity < warehouseQuantity + hospitalsQuantity) {
    return NextResponse.json({ error: "Total quantity must be greater than or equal to the sum of warehouse and hospitals quantities" }, { status: 400 });
  }

  if(totalQuantity < warehouseQuantity) {
    return NextResponse.json({ error: "Total quantity must be greater than or equal to the warehouse quantity" }, { status: 400 });
  }

  try {
    await initDb();
    const newProduct = await Product.create({
      name,
      description,
      imageUrl,//TODO: ADD IMAGE UPLOAD FUNCTIONALITY
      totalQuantity,
      warehouseQuantity: warehouseQuantity || totalQuantity || 0,
      hospitalsQuantity: hospitalsQuantity || 0,
      size: size || "N/A",
    });

    return NextResponse.json({ message: "Product created", product: newProduct }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Server error", details: err }, { status: 500 });
  }
}
