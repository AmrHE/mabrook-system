/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"
import { Label } from '@radix-ui/react-label';
import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react'
import { Input } from '../ui/input';
import { Button } from '../ui/button';

const EditProductForm = ({userToken, product}: {userToken: string | undefined, product: any}) => {
  const params = useParams();
  const productId = params.id as string;
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  // const [image, setImage] = useState<File | null>(null)
  const [size, setSize] = useState("");
  const [isLoading, setIsLoading] = useState(false)

  const [warehouseQuantity, setWarehouseQuantity] = useState<number>(0);
  const [responseMessage, setResponseMessage] = useState('');
  const [updatedProduct, setUpdatedProduct] = useState<any>(null);
  const router = useRouter();
  

  useEffect(() => {
    if(product) {
      setName(product.name);
      setDescription(product.description);
      setSize(product.size);
      setWarehouseQuantity(product.warehouseQuantity);
    }
  }, [product])

  useEffect(() => {
    if(updatedProduct) {
      console.log("Updated Product:", updatedProduct);
      setName(updatedProduct.name);
      setDescription(updatedProduct.description);
      setSize(updatedProduct.size);
      setWarehouseQuantity(updatedProduct.warehouseQuantity);
    }
  }, [updatedProduct])

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
        body: JSON.stringify({
          name,
          description,
          size,
          warehouseQuantity,
        }),
      });

      const data = await res.json();
      setUpdatedProduct(data.product);

      if (!res.ok) {
        alert('حدث خطأ ما أثناء تعديل المنتج. الرجاء المحاولة مرة أخرى.');
        setIsLoading(false)
      }
      alert('تمت تعديل المنتج بنجاح!');
      setResponseMessage('Mom submitted successfully!');
      router.push(`/products/${productId}`);

    } catch (error: any) {
      setResponseMessage(`Error: ${error.message}`);
    }
  };

  return (
    <form className='flex flex-col gap-5 lg:max-w-1/3 mt-10' onSubmit={handleSubmit}>
      <Label htmlFor="name">
        اسم المنتج
      </Label>
      <Input
        placeholder="اسم المنتج"
        id="name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)} 
      />
      
      <Label htmlFor="description">
        وصف المنتج
      </Label>
      <Input
        placeholder="وصف المنتج"
        id="description"
        required
        value={description}
        onChange={(e) => setDescription(e.target.value)} 
      />
      
      <Label htmlFor="size">
        حجم المنتج
      </Label>
      <Input
        placeholder="حجم المنتج"
        id="size"
        required
        value={size}
        onChange={(e) => setSize(e.target.value)} 
      />
      
      <Label htmlFor="warehouseQuantity">
        الكمية المتاحة في المستودع
      </Label>
      <Input
        type='number'
        placeholder="الكمية المتاحة في المستودع"
        id="warehouseQuantity"
        required
        value={warehouseQuantity}
        onChange={(e) => setWarehouseQuantity(Number(e.target.value))} 
      />
      
      <div className='flex items-center justify-center w-full mt-4'>
        <Button className='lg:w-2/3 w-full text-center py-6 text-xl font-semibold' type='submit' disabled={isLoading}>
          { isLoading ? 'جاري الحفظ...' : 'احفظ التعديلات' }
        </Button>
      </div>
    </form>
  )
}

export default EditProductForm