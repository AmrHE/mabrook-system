/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { Hospital } from "@/models/Hospital";
import { User } from "@/models/User";
import { userRoles } from "@/models/enum.constants";
// import { Product } from "@/models/Product";

export async function GET(req: NextRequest) {
  await initDb();
  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const userPayload = auth.payload;


  if (!userPayload) {
    return NextResponse.json({status: 400, message: "Cannot identify the user Please re-login and try again"})
  }

  // Admins and warehouse users see every hospital. Employees see only the ones
  // they are assigned to (mirrors update-products-quantity). Scoping here rather
  // than in the page means the restriction holds for every caller of this
  // endpoint, not just the one UI that happens to render it.
  let filter: Record<string, unknown> = { isActive: true };
  if (userPayload.role === userRoles.EMPLOYEE) {
    const me = await User.findById(userPayload._id).select("assignedHospitals").lean();
    const assigned = ((me as any)?.assignedHospitals || []).map((h: any) => h.toString());
    // `$in: []` already yields an empty list, so no zero-assignment special case.
    filter = { isActive: true, _id: { $in: assigned } };
  }

  const hospitals = await Hospital
  .find(filter)
  .populate({path: 'createdBy', model: 'User', select: 'email firstName lastName'})
  .sort({ createdAt: -1 })
  .lean();

  // Attach the employees assigned to each hospital (reverse of User.assignedHospitals).
  const employees = await User
    .find({ assignedHospitals: { $in: hospitals.map((h: any) => h._id) }, isActive: true })
    .select('firstName lastName email assignedHospitals')
    .lean();

  const byHospital = new Map<string, any[]>();
  for (const e of employees as any[]) {
    for (const hid of e.assignedHospitals || []) {
      const key = String(hid);
      if (!byHospital.has(key)) byHospital.set(key, []);
      byHospital.get(key)!.push({ _id: e._id, firstName: e.firstName, lastName: e.lastName, email: e.email });
    }
  }
  for (const h of hospitals as any[]) {
    h.assignedEmployees = byHospital.get(String(h._id)) || [];
  }


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
