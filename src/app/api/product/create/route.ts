import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import { userRoles } from "@/models/enum.constants";
import { initDb } from "../../../../lib/mongoose";
import { Product } from "@/models/Product";
import { Hospital } from "@/models/Hospital";



export async function POST(req: NextRequest) {
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

  const { name } = await req.json();

  // Boxes are created by name only (from the Settings page). Stock is filled in
  // per hospital afterwards; the warehouse counter is paused (kept at 0).
  if (!name) {
    return NextResponse.json({ error: "Missing fields", message: "الرجاء إدخال اسم الصندوق" }, { status: 400 });
  }

  try {
    const newProduct = await Product.create({
      name,
      totalQuantity: 0,
      warehouseQuantity: 0, // dormant — kept for a possible future re-enable
      hospitalsQuantity: 0,
      isActive: true,
      createdBy: userPayload._id,
    });

    if (!newProduct) {
      return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
    }

    await Hospital.updateMany(
      {},
      {
        $push: {
          productStocks: {
            product: newProduct._id,
            quantity: 0,
            lastRestockedAt: null,
          },
        },
      }
    );
    return NextResponse.json({ message: "Product created", product: newProduct }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Server error", details: err }, { status: 500 });
  }
}
