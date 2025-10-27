/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"
import React, { useState, useEffect } from 'react'
import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '../ui/button'
import { toast } from 'sonner'

const AddQuestionsForm = ({ userToken, product }: { userToken: string | undefined, product: any }) => {
  const params = useParams();
  const productId = params.id as string;

  const [questions, setQuestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false)

  const router = useRouter();

  // Initialize with existing product questions
  useEffect(() => {
    if (product?.questions) {
      setQuestions(product.questions);
    }
  }, [product]);

  const handleQuestionChange = (index: number, value: string) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index] = value;
    setQuestions(updatedQuestions);
  };

  const handleAddQuestion = () => {
    setQuestions(prev => [...prev, '']);
  };

  const handleRemoveQuestion = () => {
    if (questions.length === 0) return;
    setQuestions(prev => prev.slice(0, -1));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setIsLoading(true)
    e.preventDefault();
    try {
      const res = await fetch(`/api/product/add-questions/${productId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ questions }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error('حدث خطأ ما أثناء إضافة الأسئلة. الرجاء المحاولة مرة أخرى.');
        setIsLoading(false)
      }
      toast.success('تمت إضافة الأسئلة بنجاح!');
      router.push(`/products/${productId}`);
      console.log("Questions added successfully:", data);
    } catch (error) {
      toast.error("Error adding questions:" + error);
    }
  }

  return (
    <form className='flex flex-col gap-5 lg:max-w-1/3 mt-10' onSubmit={handleSubmit}>
      <Label>أسئلة المنتج</Label>

      {questions.map((question, index) => (
        <Input
          key={index}
          placeholder={`السؤال رقم ${index + 1}`}
          required
          value={question}
          onChange={(e) => handleQuestionChange(index, e.target.value)}
        />
      ))}

      <div className='flex items-center gap-5 mt-5 justify-between'>
        <Button
          type="button"
          className='bg-green-500 transition-all ease-in-out duration-300 hover:bg-green-700'
          onClick={handleAddQuestion}
        >
          إضافة سؤال جديد
        </Button>
        <Button
          type="button"
          className='bg-red-500 transition-all ease-in-out duration-300 hover:bg-red-700'
          onClick={handleRemoveQuestion}
        >
          مسح السؤال الأخير
        </Button>
      </div>

      <Button type='submit' disabled={isLoading}>
        { isLoading ? 'جاري الحفظ...' : 'احفظ الأسئلة' }
      </Button>
    </form>
  )
}

export default AddQuestionsForm;
