/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type SurveyEntry = {
  product: { _id?: string; name?: string } | string;
  QA: { question: string; answer: string }[];
};

/**
 * Answers the survey questions for each box given to this mom (a mom may
 * receive several). The boxes themselves are locked at mom creation (they drove
 * the stock decrements); here we only edit the answers, so add-survey never
 * re-touches stock.
 */
export default function SurveyForm({ survey: initialSurvey, id, userToken }: { survey: SurveyEntry[]; id: string; userToken: string | undefined }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const busy = isLoading || isPending;
  const router = useRouter();

  const [survey, setSurvey] = useState<SurveyEntry[]>(
    (initialSurvey || []).map((entry) => ({
      product: entry.product,
      QA: (entry.QA || []).map((qa) => ({ question: qa.question, answer: qa.answer || "" })),
    }))
  );

  const productId = (p: SurveyEntry["product"]) => (typeof p === "string" ? p : p?._id || "");
  const productName = (p: SurveyEntry["product"]) => (typeof p === "string" ? "" : p?.name || "");

  const handleAnswerChange = (pid: string, questionIndex: number, value: string) => {
    setSurvey((prev) =>
      prev.map((item) =>
        productId(item.product) === pid
          ? { ...item, QA: item.QA.map((qa, idx) => (idx === questionIndex ? { ...qa, answer: value } : qa)) }
          : item
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Send product as its id — the API matches on it and updates QA only.
    const payload = survey.map((entry) => ({ product: productId(entry.product), QA: entry.QA }));
    try {
      const res = await fetch(`/api/mom/add-survey/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ survey: payload }),
      });
      if (!res.ok) {
        toast.error("حدث خطأ ما أثناء حفظ الإجابات. الرجاء المحاولة مرة أخرى.");
        return;
      }
      toast.success("تم حفظ الإجابات بنجاح!");
      // Already on /moms/[id] — refresh, don't push to the current route.
      startTransition(() => router.refresh());
    } catch {
      toast.error("حدث خطأ ما أثناء حفظ الإجابات. الرجاء المحاولة مرة أخرى.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!survey.length) {
    return <p className="text-gray-400 mt-6">لا يوجد صندوق مسجّل لهذه الأم.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 lg:w-1/3 mt-6">
      {survey.map((entry, pIndex) => (
        <div key={pIndex} className="p-4 border rounded-lg">
          <h2 className="font-bold mb-4">الصندوق: {productName(entry.product) || "—"}</h2>
          {entry.QA.length === 0 ? (
            <p className="text-gray-400 text-sm">لا توجد أسئلة لهذا الصندوق.</p>
          ) : (
            entry.QA.map((qa, qIndex) => (
              <div key={qIndex} className="mb-4">
                <label className="block font-medium mb-1">{qa.question}</label>
                <input
                  type="text"
                  value={qa.answer}
                  onChange={(e) => handleAnswerChange(productId(entry.product), qIndex, e.target.value)}
                  className="w-full border rounded p-2"
                  placeholder="الإجابة"
                />
              </div>
            ))
          )}
        </div>
      ))}

      <Button
        type="submit"
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        disabled={busy}
      >
        {busy ? "جاري الحفظ..." : "احفظ الإجابات"}
      </Button>
    </form>
  );
}
