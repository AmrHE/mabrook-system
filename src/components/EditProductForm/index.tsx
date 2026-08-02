/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"
import { Label } from '@radix-ui/react-label';
import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState, useTransition } from 'react'
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { toast } from 'sonner';

const EditProductForm = ({userToken, product}: {userToken: string | undefined, product: any}) => {
  const params = useParams();
  const productId = params.id as string;

  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const busy = isLoading || isPending
  const router = useRouter();

  useEffect(() => {
    if(product) {
      setName(product.name);
    }
  }, [product])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setIsLoading(true)
    e.preventDefault();
    try {
      const res = await fetch(`/api/product/edit-product/${productId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        toast.error('حدث خطأ ما أثناء تعديل الصندوق. الرجاء المحاولة مرة أخرى.');
        return;
      }
      toast.success('تم تعديل الصندوق بنجاح!');
      // Already on /products/[id] — refresh, don't push to the current route.
      startTransition(() => router.refresh());
    } catch (error: any) {
      toast.error('حدث خطأ ما أثناء تعديل الصندوق. الرجاء المحاولة مرة أخرى.');
    } finally {
      setIsLoading(false)
    }
  };

  return (
    <form className='flex flex-col gap-5 lg:max-w-1/3 mt-10' onSubmit={handleSubmit}>
      <Label htmlFor="name">
        اسم الصندوق
      </Label>
      <Input
        placeholder="اسم الصندوق"
        id="name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div className='flex items-center justify-center w-full mt-4'>
        <Button className='lg:w-2/3 w-full text-center py-6 text-xl font-semibold' type='submit' disabled={busy}>
          { busy ? 'جاري الحفظ...' : 'احفظ التعديلات' }
        </Button>
      </div>
    </form>
  )
}

export default EditProductForm
