/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";

export default function SurveyForm({ products, id, userToken } : {products: any, id: string, userToken: string | undefined}) {
  // Prepare initial state based on products
  const [survey, setSurvey] = useState(
    products
      .filter((p:any) => p.questions && p.questions.length > 0)
      .map((product:any) => ({
        product: product._id,
        QA: product.questions.map((q:any) => {
          // Try to find existing answer if product has `QA` field
          const existingAnswer = product.QA?.find((qa:any) => qa.question === q)?.answer || "";
          return { question: q, answer: existingAnswer };
        }),
      }))

  );

  // Handle answer change
  const handleAnswerChange = (productId: string, questionIndex: number, value: any) => {
    setSurvey((prev:any) =>
      prev.map((item:any) =>
        item.product === productId
          ? {
              ...item,
              QA: item.QA.map((qa:any, idx:any) =>
                idx === questionIndex ? { ...qa, answer: value } : qa
              ),
            }
          : item
      )
    );
  };

  const handleSubmit = async (/*e:any*/) => {
    // e.preventDefault();
    await fetch(`/api/mom/add-survey/${id}`, {
      method: "PATCH",
      headers: { 
        "Content-Type": "application/json",
        authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ survey }),
    });
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-8 w-1/3">
      {survey.map((productData:any, pIndex:any) => {
        const product = products.find((p:any) => p._id === productData.product);
        return (
          <div key={pIndex} className="p-4 border-b rounded">
            <h2 className="font-bold mb-4">{product.name}</h2>
            {productData.QA.map((qa:any, qIndex:any) => (
              <div key={qIndex} className="mb-4">
                <label className="block font-medium mb-1">{qa.question}</label>
                <input
                  type="text"
                  value={qa.answer}
                  onChange={(e) =>
                    handleAnswerChange(productData.product, qIndex, e.target.value)
                  }
                  className="w-full border rounded p-2"
                  placeholder="Your answer"
                />
              </div>
            ))}
          </div>
        );
      })}

      <button
        type="submit"
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Submit Survey
      </button>
    </form>
  );
}
