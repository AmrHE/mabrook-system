import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { Mom } from "@/models/Mom";
import { resolveNationality } from "@/utils/nationality/nationalities.server";

export const dynamic = "force-dynamic";

/**
 * POST /api/nationalities/cleanup            (admin only) — DRY RUN (reports only)
 * POST /api/nationalities/cleanup?apply=true (admin only) — writes canonical values
 *
 * One-time normalization of existing free-text `Mom.nationality` values to their
 * canonical feminine spelling (folding يمني/اليمن/yemeni → يمنية, etc.). Values
 * that can't be confidently resolved are returned in `unmatched` (raw value →
 * count) so the dataset/aliases can be extended and the cleanup re-run.
 */
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  const apply = req.nextUrl.searchParams.get("apply") === "true";

  try {
    // Group by raw value so we resolve each distinct spelling once, then bulk-update.
    const groups = (await Mom.aggregate([
      { $group: { _id: "$nationality", count: { $sum: 1 } } },
    ])) as Array<{ _id: string | null; count: number }>;

    const changes: Array<{ from: string; to: string; count: number }> = [];
    const unmatched: Record<string, number> = {};
    let momsUpdated = 0;

    for (const g of groups) {
      const raw = (g._id ?? "").trim();
      if (!raw) continue; // leave empty/null as-is
      const canonical = await resolveNationality(raw);
      if (!canonical) {
        unmatched[raw] = (unmatched[raw] ?? 0) + g.count;
        continue;
      }
      if (canonical !== g._id) {
        changes.push({ from: g._id as string, to: canonical, count: g.count });
        if (apply) {
          const res = await Mom.updateMany({ nationality: g._id }, { $set: { nationality: canonical } });
          momsUpdated += res.modifiedCount ?? 0;
        }
      }
    }

    return NextResponse.json({
      dryRun: !apply,
      distinctValuesScanned: groups.length,
      distinctValuesChanged: changes.length,
      momsUpdated: apply ? momsUpdated : undefined,
      changes: changes.sort((a, b) => b.count - a.count),
      unmatched,
      hint: apply
        ? "تم تطبيق التعديلات. راجع القيم غير المطابقة وأضف مرادفاتها إلى قائمة الجنسيات."
        : "تشغيل تجريبي فقط. أعد الطلب مع ?apply=true لتطبيق التعديلات.",
    });
  } catch {
    return NextResponse.json({ status: 500, message: "فشل تنفيذ عملية التنظيف" }, { status: 500 });
  }
}
