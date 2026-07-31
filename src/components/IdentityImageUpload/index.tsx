/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import Image from "next/image";
import { Input } from "../ui/input";
import { toast } from "sonner";

/**
 * Identity-document image field. On file select it reads the file as a base64
 * data URL and uploads it to Cloudinary via the existing upload-signature
 * endpoint, then calls `onChange` with the returned secure URL. Fully
 * controlled: `value` is the stored Cloudinary URL (or null).
 */
export default function IdentityImageUpload({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/cloudinary/upload-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature: base64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "upload failed");

      onChange(data.url);
      toast.success("تم رفع صورة الهوية");
    } catch {
      toast.error("تعذّر رفع صورة الهوية. الرجاء المحاولة مرة أخرى.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Input type="file" accept="image/*" onChange={handleFile} disabled={uploading} className="bg-white" />
      {uploading && <p className="text-sm text-muted-foreground">جاري الرفع...</p>}
      {value && (
        <Image
          src={value}
          alt="صورة الهوية"
          width={220}
          height={140}
          className="rounded-md border object-contain"
        />
      )}
    </div>
  );
}
