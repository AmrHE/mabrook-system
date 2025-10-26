import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import { Hospital } from "@/models/Hospital";
// import { Product } from "@/models/Product";

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

  const hospitals = await Hospital
  .find({ isActive: true })
  .populate({path: 'createdBy', model: 'User', select: 'email firstName lastName'})
  .sort({ createdAt: -1 });


  // ONE TIME SCRIPT TO SYNC HOSPITAL PRODUCTS WITH THE CURRENT PRODUCTS LIST IN THE DATABASE -- USE IF NEEDED

  // const allProducts = await Product.find({isActive: true});
  // for (const hospital of hospitals) {
  //     const existingProductIds = (hospital.productStocks || []).map(
  //       stock => stock.product.toString()
  //     );
  //     // Find products that are missing from this hospital
  //     const missingProducts = allProducts.filter(
  //       product => !existingProductIds.includes(product._id.toString())
  //     );
  //     if (missingProducts.length > 0) {
  //       console.log(`Hospital ${hospital.name}: Adding ${missingProducts.length} missing products`);
  //       // Add missing products
  //       await Hospital.updateOne(
  //         { _id: hospital._id },
  //         {
  //           $push: {
  //             productStocks: {
  //               $each: missingProducts.map(product => ({
  //                 product: product._id,
  //                 quantity: 0,
  //                 lastRestockedAt: null
  //               }))
  //             }
  //           }
  //         }
  //       );
  //     } else {
  //       console.log(`Hospital ${hospital.name}: Already in sync`);
  //     }
  //   }


  if(!hospitals) {
    return NextResponse.json({status: 404, message: "No hospitals found"})
  }

  return NextResponse.json({ message: "Hospitals fetched successfully", hospitals }, { status: 200 });
}
