/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { Hospital } from "@/models/Hospital";

export const dynamic = "force-dynamic";

/**
 * Remaining on-hand stock per hospital × box (current snapshot — not date
 * ranged). Long form (one row per hospital/box) plus the distinct axes, so the
 * client can pivot into a heat table and see where to restock.
 */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const cells = await Hospital.aggregate([
      { $match: { isActive: true } },
      { $unwind: "$productStocks" },
      { $lookup: { from: "products", localField: "productStocks.product", foreignField: "_id", as: "p" } },
      { $unwind: { path: "$p", preserveNullAndEmptyArrays: true } },
      // Skip stock rows whose box was deleted / deactivated.
      { $match: { "p.isActive": true } },
      {
        $project: {
          _id: 0,
          hospitalId: "$_id",
          hospitalName: { $ifNull: ["$name", "غير محدد"] },
          boxId: "$productStocks.product",
          boxName: { $ifNull: ["$p.name", "غير محدد"] },
          quantity: { $ifNull: ["$productStocks.quantity", 0] },
        },
      },
    ]);

    const hospTotals = new Map<string, { id: string; name: string; total: number }>();
    const boxTotals = new Map<string, { id: string; name: string; total: number }>();
    for (const c of cells as any[]) {
      const h = hospTotals.get(String(c.hospitalId)) || { id: String(c.hospitalId), name: c.hospitalName, total: 0 };
      h.total += c.quantity;
      hospTotals.set(String(c.hospitalId), h);
      const b = boxTotals.get(String(c.boxId)) || { id: String(c.boxId), name: c.boxName, total: 0 };
      b.total += c.quantity;
      boxTotals.set(String(c.boxId), b);
    }
    const hospitals = [...hospTotals.values()].sort((a, b) => a.total - b.total); // lowest stock first
    const boxes = [...boxTotals.values()].sort((a, b) => b.total - a.total);

    return NextResponse.json({ cells, hospitals, boxes }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute stock matrix" }, { status: 500 });
  }
}
