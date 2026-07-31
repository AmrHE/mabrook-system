"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Check, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { SettingsType } from "@/types/types";
import BackupCard from "./BackupCard";

const FIELDS: { key: keyof SettingsType; label: string; hint: string; type: "time" | "number" }[] = [
  { key: "expectedStartFrom", label: "بداية نافذة الحضور", hint: "أبكر وقت لبدء الدوام (HH:MM)", type: "time" },
  { key: "expectedStartTo", label: "نهاية نافذة الحضور", hint: "آخر وقت يُعتبر التزامًا (HH:MM)", type: "time" },
  { key: "expectedHoursPerDay", label: "ساعات العمل المتوقعة يوميًا", hint: "مدة الوردية المستهدفة بالساعات", type: "number" },
  { key: "expectedDaysPerWeek", label: "أيام العمل الأسبوعية", hint: "عدد أيام العمل المتوقعة في الأسبوع", type: "number" },
  { key: "graceMinutes", label: "دقائق السماح", hint: "سماح إضافي بعد نهاية النافذة قبل احتساب التأخير", type: "number" },
  { key: "maxShiftHours", label: "الحد الأقصى لساعات الدوام", hint: "يُغلق الدوام تلقائيًا بعد هذه المدة", type: "number" },
  { key: "inactivityMinutes", label: "دقائق الخمول للإغلاق التلقائي", hint: "يُغلق الدوام بعد هذه المدة دون نشاط", type: "number" },
  { key: "leaveMaxRetroDays", label: "مهلة الاستئذان عن يوم سابق (أيام)", hint: "أقصى عدد أيام يمكن تقديم طلب استئذان أو إجازة عن تاريخ ماضٍ", type: "number" },
  { key: "geofenceRadiusMeters", label: "نطاق تسجيل الحضور (متر)", hint: "المسافة المسموح بها حول المستشفى لتسجيل بدء الدوام/الزيارة", type: "number" },
];

const STOCK_FIELDS: { key: keyof SettingsType; label: string; hint: string; type: "number" }[] = [
  { key: "outOfStockThreshold", label: "حد نفاد المخزون", hint: "أقل من هذا العدد يُعتبر الصندوق نافدًا (نفذ)", type: "number" },
  { key: "lowStockThreshold", label: "حد المخزون المنخفض", hint: "أقل من هذا العدد (وأعلى من حد النفاد) يُعتبر منخفضًا", type: "number" },
];

/**
 * Reusable card for an admin-managed string list (projects, apps, …). Loads the
 * list from `listEndpoint` (reading `json[listKey]`) and supports add / rename /
 * delete via the matching endpoints (each POST returns { name, message } and is
 * idempotent server-side). Items in `lockedItems` are read-only (e.g. a seeded
 * base value) — they show a badge and no edit/delete controls.
 */
function ManagedListCard({
  userToken,
  title,
  description,
  listEndpoint,
  addEndpoint,
  updateEndpoint,
  deleteEndpoint,
  listKey,
  addLabel,
  placeholder,
  emptyText,
  errorAddText,
  existsText,
  addedText,
  deleteConfirmText,
  lockedItems = [],
  lockedBadge = "افتراضي",
}: {
  userToken?: string;
  title: string;
  description: string;
  listEndpoint: string;
  addEndpoint: string;
  updateEndpoint: string;
  deleteEndpoint: string;
  listKey: string;
  addLabel: string;
  placeholder: string;
  emptyText: string;
  errorAddText: string;
  existsText: string;
  addedText: string;
  deleteConfirmText: string;
  lockedItems?: string[];
  lockedBadge?: string;
}) {
  const [items, setItems] = useState<string[] | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const lockedSet = useMemo(() => new Set(lockedItems), [lockedItems]);
  const sortAr = (list: string[]) => [...list].sort((a, b) => a.localeCompare(b, "ar"));

  useEffect(() => {
    let cancelled = false;
    fetch(listEndpoint)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setItems(Array.isArray(j[listKey]) ? j[listKey] : []);
      })
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [listEndpoint, listKey]);

  const add = async () => {
    const name = draft.trim();
    if (!name) return;
    setAdding(true);
    try {
      const res = await fetch(addEndpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${userToken}`, "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message || errorAddText);
        return;
      }
      const canonical = data.name as string;
      setItems((prev) => {
        const list = prev ?? [];
        return list.includes(canonical) ? list : sortAr([...list, canonical]);
      });
      setDraft("");
      toast.success(data.created === false ? existsText : addedText);
    } catch {
      toast.error(errorAddText);
    } finally {
      setAdding(false);
    }
  };

  const saveEdit = async (oldName: string) => {
    const newName = editDraft.trim();
    if (!newName || newName === oldName) {
      setEditing(null);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(updateEndpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${userToken}`, "content-type": "application/json" },
        body: JSON.stringify({ oldName, newName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message || "فشل التعديل");
        return;
      }
      const canonical = (data.name as string) || newName;
      setItems((prev) => sortAr((prev ?? []).map((it) => (it === oldName ? canonical : it))));
      setEditing(null);
      setEditDraft("");
      toast.success(data.message || "تم التعديل");
    } catch {
      toast.error("فشل التعديل");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (name: string) => {
    setBusy(true);
    try {
      const res = await fetch(deleteEndpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${userToken}`, "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message || "فشل الحذف");
        return;
      }
      setItems((prev) => (prev ?? []).filter((it) => it !== name));
      toast.success(data.message || "تم الحذف");
    } catch {
      toast.error("فشل الحذف");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-xs text-gray-400">{description}</p>

        {items === null ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </div>
        ) : items.length === 0 ? (
          <span className="text-sm text-gray-400">{emptyText}</span>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => {
              const locked = lockedSet.has(it);
              const isEditing = editing === it;
              return (
                <li key={it} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                  {isEditing ? (
                    <>
                      <Input
                        autoFocus
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            saveEdit(it);
                          } else if (e.key === "Escape") {
                            setEditing(null);
                          }
                        }}
                        className="h-8 max-w-xs"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-green-600"
                        disabled={busy || !editDraft.trim()}
                        onClick={() => saveEdit(it)}
                        aria-label="حفظ"
                      >
                        <Check className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-gray-500"
                        disabled={busy}
                        onClick={() => setEditing(null)}
                        aria-label="إلغاء"
                      >
                        <X className="size-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm">{it}</span>
                      {locked ? (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                          {lockedBadge}
                        </span>
                      ) : (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-gray-500 hover:text-[#5570F1]"
                            disabled={busy}
                            onClick={() => {
                              setEditing(it);
                              setEditDraft(it);
                            }}
                            aria-label="تعديل"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-gray-500 hover:text-red-600"
                                disabled={busy}
                                aria-label="حذف"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent dir="rtl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {deleteConfirmText.replace("{name}", it)}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <Button variant="destructive" disabled={busy} onClick={() => remove(it)}>
                                  {busy ? "جارٍ الحذف..." : "تأكيد الحذف"}
                                </Button>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="grid gap-1.5">
          <Label>{addLabel}</Label>
          <div className="flex gap-2">
            <Input
              placeholder={placeholder}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              className="max-w-xs"
            />
            <Button
              onClick={add}
              disabled={adding || !draft.trim()}
              className="bg-[#5570F1] hover:bg-[#3250e9]"
            >
              {adding ? "جاري الإضافة..." : "إضافة"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type Box = { _id: string; name: string };

/**
 * Box catalog manager. Boxes are real documents (unlike the string lists above):
 * created by name here, their stock is filled per hospital, and their survey
 * questions are edited on the box detail page (/products/[id]).
 */
function BoxesCard({ userToken }: { userToken?: string }) {
  const [boxes, setBoxes] = useState<Box[] | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/product/get-all", { headers: { authorization: `Bearer ${userToken}` } })
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setBoxes(Array.isArray(j.products) ? j.products.map((p: Box) => ({ _id: p._id, name: p.name })) : []);
      })
      .catch(() => !cancelled && setBoxes([]));
    return () => {
      cancelled = true;
    };
  }, [userToken]);

  const add = async () => {
    const name = draft.trim();
    if (!name) return;
    setAdding(true);
    try {
      const res = await fetch("/api/product/create", {
        method: "POST",
        headers: { authorization: `Bearer ${userToken}`, "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        toast.error(data.message || data.error || "فشل إضافة الصندوق");
        return;
      }
      const created: Box = { _id: data.product._id, name: data.product.name };
      setBoxes((prev) => [...(prev ?? []), created].sort((a, b) => a.name.localeCompare(b.name, "ar")));
      setDraft("");
      toast.success("تمت إضافة الصندوق");
    } catch {
      toast.error("فشل إضافة الصندوق");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (box: Box) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/product/delete/${box._id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${userToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status === 403 || data.status === 404) {
        toast.error(data.message || "فشل الحذف");
        return;
      }
      setBoxes((prev) => (prev ?? []).filter((b) => b._id !== box._id));
      toast.success("تم حذف الصندوق");
    } catch {
      toast.error("فشل الحذف");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">الصناديق</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-xs text-gray-400">
          الصناديق المتاحة عند تسجيل أم جديدة. أضف صندوقًا بالاسم هنا، ثم حدّد كمياته لكل مستشفى وأسئلته من صفحة تفاصيل الصندوق.
        </p>

        {boxes === null ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </div>
        ) : boxes.length === 0 ? (
          <span className="text-sm text-gray-400">لا توجد صناديق بعد</span>
        ) : (
          <ul className="space-y-2">
            {boxes.map((box) => (
              <li key={box._id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <Link href={`/products/${box._id}`} className="flex-1 text-sm hover:text-[#5570F1] hover:underline">
                  {box.name}
                </Link>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-gray-500 hover:text-red-600"
                      disabled={busy}
                      aria-label="حذف"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                      <AlertDialogDescription>
                        سيتم حذف الصندوق «{box.name}» وإزالته من مخزون جميع المستشفيات. لا يمكن التراجع.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                      <Button variant="destructive" disabled={busy} onClick={() => remove(box)}>
                        {busy ? "جارٍ الحذف..." : "تأكيد الحذف"}
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-1.5">
          <Label>إضافة صندوق</Label>
          <div className="flex gap-2">
            <Input
              placeholder="اسم الصندوق الجديد"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              className="max-w-xs"
            />
            <Button onClick={add} disabled={adding || !draft.trim()} className="bg-[#5570F1] hover:bg-[#3250e9]">
              {adding ? "جاري الإضافة..." : "إضافة"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsClient({ userToken }: { userToken?: string }) {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings", { headers: { authorization: `Bearer ${userToken}` } })
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) {
          if (j.settings) setSettings(j.settings);
          else setError(j.message || "تعذّر تحميل الإعدادات");
        }
      })
      .catch(() => !cancelled && setError("تعذّر تحميل الإعدادات"));
    return () => {
      cancelled = true;
    };
  }, [userToken]);

  const update = (key: keyof SettingsType, value: string) =>
    setSettings((s) => (s ? { ...s, [key]: value } : s));

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { authorization: `Bearer ${userToken}`, "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "فشل الحفظ");
      } else {
        toast.success("تم حفظ الإعدادات");
        if (data.settings) setSettings(data.settings);
      }
    } catch {
      toast.error("فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="font-bold text-3xl mb-6">الإعدادات</h1>

      {error && <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">جدول الحضور والالتزام</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {!settings && !error ? (
            <div className="space-y-4">
              {FIELDS.map((f) => (
                <Skeleton key={String(f.key)} className="h-10 w-full" />
              ))}
            </div>
          ) : settings ? (
            FIELDS.map((f) => (
              <div key={String(f.key)} className="grid gap-1.5">
                <Label htmlFor={String(f.key)}>{f.label}</Label>
                <Input
                  id={String(f.key)}
                  type={f.type === "time" ? "time" : "number"}
                  value={String(settings[f.key] ?? "")}
                  onChange={(e) => update(f.key, e.target.value)}
                  className="max-w-xs"
                />
                <p className="text-xs text-gray-400">{f.hint}</p>
              </div>
            ))
          ) : null}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">حدود مخزون الصناديق</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {!settings && !error ? (
            <div className="space-y-4">
              {STOCK_FIELDS.map((f) => (
                <Skeleton key={String(f.key)} className="h-10 w-full" />
              ))}
            </div>
          ) : settings ? (
            STOCK_FIELDS.map((f) => (
              <div key={String(f.key)} className="grid gap-1.5">
                <Label htmlFor={String(f.key)}>{f.label}</Label>
                <Input
                  id={String(f.key)}
                  type="number"
                  min={0}
                  value={String(settings[f.key] ?? "")}
                  onChange={(e) => update(f.key, e.target.value)}
                  className="max-w-xs"
                />
                <p className="text-xs text-gray-400">{f.hint}</p>
              </div>
            ))
          ) : null}
        </CardContent>
      </Card>

      {settings && (
        <Button onClick={save} disabled={saving} className="mt-6 bg-[#5570F1] hover:bg-[#3250e9]">
          {saving ? "جاري الحفظ..." : "حفظ"}
        </Button>
      )}

      <BoxesCard userToken={userToken} />

      <ManagedListCard
        userToken={userToken}
        title="المشاريع"
        description="المشاريع المتاحة عند إضافة موظف جديد. أضف مشروعًا أو عدّله أو احذفه."
        listEndpoint="/api/projects"
        addEndpoint="/api/projects/add"
        updateEndpoint="/api/projects/update"
        deleteEndpoint="/api/projects/delete"
        listKey="projects"
        addLabel="إضافة مشروع"
        placeholder="اسم المشروع الجديد"
        emptyText="لا توجد مشاريع بعد"
        errorAddText="فشل إضافة المشروع"
        existsText="المشروع موجود بالفعل"
        addedText="تمت إضافة المشروع"
        deleteConfirmText="سيتم حذف المشروع «{name}» ونقل الموظفين المرتبطين به إلى mabrook. لا يمكن التراجع."
        lockedItems={["mabrook"]}
      />

      <ManagedListCard
        userToken={userToken}
        title="التطبيقات"
        description="التطبيقات المتاحة عند تسجيل أم جديدة. أضف تطبيقًا أو عدّله أو احذفه."
        listEndpoint="/api/apps"
        addEndpoint="/api/apps/add"
        updateEndpoint="/api/apps/update"
        deleteEndpoint="/api/apps/delete"
        listKey="apps"
        addLabel="إضافة تطبيق"
        placeholder="اسم التطبيق الجديد"
        emptyText="لا توجد تطبيقات بعد"
        errorAddText="فشل إضافة التطبيق"
        existsText="التطبيق موجود بالفعل"
        addedText="تمت إضافة التطبيق"
        deleteConfirmText="سيتم حذف التطبيق «{name}» وإزالته من جميع الأمهات المسجّلات به. لا يمكن التراجع."
      />

      <BackupCard userToken={userToken} />
    </div>
  );
}
