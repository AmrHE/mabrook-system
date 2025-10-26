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

  const { name, description, imageUrl, warehouseQuantity, size } = await req.json();

  if (!name || !description || !imageUrl || !warehouseQuantity) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    const newProduct = await Product.create({
      name,
      description,
      imageUrl,//TODO: ADD IMAGE UPLOAD FUNCTIONALITY
      totalQuantity: warehouseQuantity,
      warehouseQuantity,
      hospitalsQuantity: 0,
      size: size || "N/A",
      isActive: true,
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
