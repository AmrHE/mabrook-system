"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DatabaseBackup, Download, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { downloadBlob } from "@/utils/export/downloadBlob";

/** Documents per request. Small enough to stay well inside the serverless response limits. */
const PAGE = 500;

interface BackupManifest {
  dbName: string;
  generatedAt: string;
  format: string;
  totalDocuments: number;
  collections: { name: string; count: number }[];
}

const fmt = (n: number) => n.toLocaleString("en-SA");

/** Restore instructions shipped inside the archive as README.txt. */
function buildReadme(man: BackupManifest): string {
  const files = man.collections.map((c) => `  ${c.name}.json — ${fmt(c.count)} document(s)`).join("\n");
  const imports = man.collections
    .map((c) => `mongoimport --uri="<CONNECTION_URI>" --collection=${c.name} --file=${c.name}.json --jsonArray`)
    .join("\n");

  return `مبروك — نسخة احتياطية لقاعدة البيانات
Mabrook System — Database Backup
================================================================

قاعدة البيانات / Database : ${man.dbName}
تاريخ النسخة / Generated  : ${man.generatedAt}
الصيغة / Format           : ${man.format}
إجمالي المستندات / Total  : ${fmt(man.totalDocuments)}

المحتويات / CONTENTS
----------------------------------------------------------------
${files}
  manifest.json — بيانات هذه النسخة / metadata (do NOT import as a collection)

الاستعادة عبر MONGODB COMPASS
----------------------------------------------------------------
1. فك ضغط هذا الملف.
2. افتح Compass واتصل بالسيرفر، ثم أنشئ قاعدة بيانات جديدة (مثلاً mabrook).
3. لكل ملف <name>.json: أنشئ مجموعة (collection) بنفس الاسم بدون امتداد .json.
4. اختر المجموعة ثم Add Data ← Import JSON ← اختر الملف ← Import.
5. لا يهم ترتيب الاستيراد؛ المعرّفات (ObjectId) محفوظة كما هي، فتبقى العلاقات سليمة.
6. لا تستورد manifest.json ولا README.txt.

RESTORING WITH MONGODB COMPASS
----------------------------------------------------------------
1. Unzip this archive.
2. Connect in Compass, then create the target database (e.g. "mabrook").
3. For each <name>.json, create a collection named <name> (filename without .json).
4. Select it, then: Add Data -> Import JSON -> pick the file -> Import.
5. Import order does not matter — ObjectIds are preserved, so every reference
   between collections (Mom.hospital, Visit.mom, Shift.user, ...) stays intact.
6. Do NOT import manifest.json or README.txt.

RESTORING WITH MONGOIMPORT (faster)
----------------------------------------------------------------
${imports}

Or, from the unzipped folder in one go:

for f in *.json; do [ "$f" = manifest.json ] || \\
  mongoimport --uri="<CONNECTION_URI>" --collection="\${f%.json}" --file="$f" --jsonArray; done

ملاحظات مهمة / IMPORTANT NOTES
----------------------------------------------------------------
* تحقّق بعد الاستعادة من تطابق عدد المستندات مع manifest.json.
  After restoring, check the document counts against manifest.json.

* الفهارس (indexes) وقواعد التحقق غير مضمَّنة في هذه النسخة. يعيد Mongoose إنشاء
  فهارس المخططات عند أول اتصال، لكن تأكّد يدويًا من أي فهرس فريد (unique index).
  Indexes and schema validators are NOT part of this backup. Mongoose recreates
  its schema indexes on first connect, but verify any unique index manually.

* الصور والتواقيع مخزَّنة في Cloudinary ويُشار إليها برابط فقط، فهي ليست داخل هذا
  الملف؛ قاعدة البيانات المستعادة تظل تشير إلى حساب Cloudinary الحالي.
  Uploaded images and signatures live in Cloudinary and are referenced by URL, so
  they are not inside this archive — a restored database still points at the live
  Cloudinary account.

* يحتوي users.json على كلمات مرور المستخدمين، لذا تبقى الحسابات تعمل بعد الاستعادة.
  تنبيه مهم: حقل passwordHash يخزّن كلمة المرور كنص صريح (غير مشفّرة) في قاعدة
  البيانات نفسها، فهي مقروءة داخل هذا الملف. تعامل مع هذا الملف كملف بالغ الحساسية.
  users.json contains user login passwords, so existing logins keep working after a
  restore. IMPORTANT: despite its name, the passwordHash field stores the password as
  PLAIN TEXT in the database itself, so passwords are readable in this archive. Treat
  this file as highly sensitive.
`;
}

/**
 * Admin call-to-action that downloads the entire database as a zip of per-collection
 * MongoDB Extended JSON files, ready to import straight into MongoDB Compass.
 *
 * The archive is assembled in the browser from small keyset-paginated pages of
 * `/api/backup/collection` rather than one big server response, which keeps every
 * request inside the serverless duration / body-size limits regardless of how large
 * the database grows, and gives us a progress indicator for free.
 */
export default function BackupCard({ userToken }: { userToken?: string }) {
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);

  const run = async () => {
    setConfirmOpen(false);
    setBusy(true);
    setProgress(null);
    const headers = { authorization: `Bearer ${userToken}` };

    try {
      // Loaded on demand so jszip stays out of the settings page bundle.
      const { default: JSZip } = await import("jszip");

      const manRes = await fetch("/api/backup/manifest", { headers });
      const man: BackupManifest = await manRes.json();
      if (!manRes.ok) throw new Error((man as unknown as { message?: string }).message || "تعذّر قراءة قائمة المجموعات");

      const zip = new JSZip();
      let done = 0;
      setProgress({ done: 0, total: man.totalDocuments, label: "" });

      for (const col of man.collections) {
        const pages: string[] = [];
        let after = "";

        for (;;) {
          const qs = new URLSearchParams({ name: col.name, limit: String(PAGE) });
          if (after) qs.set("after", after);

          const res = await fetch(`/api/backup/collection?${qs.toString()}`, { headers });
          if (!res.ok) throw new Error(`${col.name}: ${res.status}`);

          const text = await res.text();
          if (text) pages.push(text);

          const count = Number(res.headers.get("x-doc-count") ?? 0);
          done += count;
          setProgress({ done, total: man.totalDocuments, label: col.name });

          const lastId = res.headers.get("x-last-id") ?? "";
          if (count < PAGE || !lastId) break;
          after = lastId;
        }

        // Pages arrive as ",\n"-joined document fragments; wrapping them in brackets
        // yields the JSON array that Compass and `mongoimport --jsonArray` expect.
        const joined = pages.join(",\n");
        zip.file(`${col.name}.json`, joined ? `[\n${joined}\n]\n` : "[]\n");
      }

      zip.file("manifest.json", JSON.stringify(man, null, 2));
      zip.file("README.txt", buildReadme(man));

      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      downloadBlob(`mabrook-backup-${man.generatedAt.slice(0, 10)}.zip`, blob);
      toast.success(`تم تنزيل النسخة الاحتياطية (${fmt(man.totalDocuments)} مستند)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل إنشاء النسخة الاحتياطية");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const pct = progress && progress.total > 0 ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <DatabaseBackup className="size-4 text-[#5570F1]" />
          النسخة الاحتياطية لقاعدة البيانات
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-500">
          نزّل نسخة كاملة من قاعدة البيانات كملف مضغوط يحتوي على ملف JSON لكل مجموعة، بصيغة MongoDB
          Extended JSON. يمكنك استيراد الملفات مباشرة في MongoDB Compass لإعادة بناء قاعدة البيانات في
          أي وقت، مع الحفاظ على المعرّفات والعلاقات بين المجموعات. يوجد داخل الملف المضغوط ملف
          README.txt يشرح خطوات الاستعادة.
        </p>

        <div className="flex items-start gap-2 rounded-lg bg-amber-50 text-amber-800 px-3 py-2.5 text-xs">
          <ShieldAlert className="size-4 shrink-0 mt-0.5" />
          <span>
            يحتوي الملف على بيانات شخصية لجميع الأمهات وكلمات مرور المستخدمين كنص صريح. الملف غير
            مشفّر — احفظه في مكان آمن ولا تشاركه.
          </span>
        </div>

        {progress && (
          <div className="space-y-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-[#5570F1] transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-gray-400">
              {progress.label ? `جاري تصدير ${progress.label} — ` : "جاري التحضير — "}
              {fmt(progress.done)} / {fmt(progress.total)} مستند
            </p>
          </div>
        )}

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogTrigger asChild>
            <Button disabled={busy} className="bg-[#5570F1] hover:bg-[#3250e9]">
              <Download className="size-4" />
              {busy ? "جاري التحضير..." : "تنزيل نسخة احتياطية"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>تنزيل نسخة احتياطية كاملة؟</AlertDialogTitle>
              <AlertDialogDescription>
                سيتم تنزيل جميع بيانات النظام على هذا الجهاز في ملف مضغوط غير مشفّر، يشمل بيانات
                الأمهات والزيارات والموظفين وكلمات مرور الدخول كنص صريح. قد تستغرق العملية دقيقة أو
                أكثر حسب حجم البيانات. تأكّد من أنك على جهاز موثوق.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <Button className="bg-[#5570F1] hover:bg-[#3250e9]" onClick={run}>
                تنزيل
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
