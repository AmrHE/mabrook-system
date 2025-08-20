 
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"
import { Label } from '@radix-ui/react-label';
import { useParams } from 'next/navigation';
import React, { useState } from 'react'
import { Input } from '../ui/input';
import { Button } from '../ui/button';

interface ProductStock {
  _id: string;
  product: {
    _id: string;
    name: string;
    size: string;
  };
  quantity: number;
  lastRestockedAt: string | null;
}

const HospitalStockDetails = ({
  userToken,
  productStocks
}: { userToken: string | undefined, productStocks: ProductStock[] }) => {
  const params = useParams();
  const hospitalId = params.id as string;

  // Initialize local state with the current stock quantities
  const [stocks, setStocks] = useState<ProductStock[]>(productStocks);

  const handleChange = (id: string, value: number) => {
    setStocks((prev) =>
      prev.map((stock) =>
        stock._id === id ? { ...stock, quantity: value } : stock
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Transform state into the required format
    const hospitalQuantities = stocks.map((stock) => ({
      productId: stock.product._id,
      quantity: stock.quantity,
    }));

    console.log("Submitting hospitalQuantities:", hospitalQuantities);

    try {
      const res = await fetch(`/api/hospitals/update-products-quantity/${hospitalId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ hospitalQuantities }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Something went wrong');
      }

      // success handling...
      console.log("Updated successfully:", data);
    } catch (error: any) {
      console.error("Error updating:", error.message);
    }
  };

  return (
    <form
      className="flex flex-col gap-5 lg:max-w-1/3 mt-10"
      onSubmit={handleSubmit}
    >
      <h1>الكميات المتاحة</h1>

      {stocks.map((stock) => (
        <div key={stock._id} className="flex flex-col gap-2">
          <Label htmlFor={`product-${stock._id}`}>
            {stock.product.name} ({stock.product.size})
          </Label>
          <Input
            type="number"
            id={`product-${stock._id}`}
            placeholder="أدخل الكمية"
            value={stock.quantity}
            onChange={(e) => handleChange(stock._id, Number(e.target.value))}
            required
          />
        </div>
      ))}

      <div className="flex items-center justify-center w-full mt-4">
        <Button
          className="lg:w-2/3 w-full text-center py-6 text-xl font-semibold"
          type="submit"
        >
          تعديل الكميات
        </Button>
      </div>
    </form>
  );
};

export default HospitalStockDetails;
