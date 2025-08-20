/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react'

const CreateNewProduct = ({userToken}: {userToken: string | undefined}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  // const [image, setImage] = useState<File | null>(null)
  const [size, setSize] = useState("");
  const [warehouseQuantity, setWarehouseQuantity] = useState<number>(0);
  const [responseMessage, setResponseMessage] = useState('');
  const [createdProduct, setCreatedProduct] = useState<any>(null);

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/product/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          name,
          description,
          size,
          imageUrl: 'placeholder', // TODO: Placeholder for image URL, implement image upload if needed
          warehouseQuantity,
        }),
      });

      const data = await res.json();
      setCreatedProduct(data.product);

      if (!res.ok) {
        throw new Error(data.message || 'Something went wrong');
      }
      setResponseMessage('Product created successfully!');
      router.push(`/products/${data.product._id}`);
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
        <Button className='lg:w-2/3 w-full text-center py-6 text-xl font-semibold' type='submit'>تعديل المنتج</Button>
      </div>
    </form>
  )
}

export default CreateNewProduct