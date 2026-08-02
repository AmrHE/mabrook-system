 
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"
import { Label } from '@radix-ui/react-label';
import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState, useTransition } from 'react'
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import TransferStockDialog from '../TransferStockDialog';

interface ProductStock {
  _id: string;
  product: {
    _id: string;
    name: string;
    size?: string;
  };
  quantity: number;
  lastRestockedAt: string | null;
}

const HospitalStockDetails = ({
  userToken,
  productStocks,
  hospitalName,
}: { userToken: string | undefined, productStocks: ProductStock[], hospitalName?: string }) => {
  const params = useParams();
  const hospitalId = params.id as string;

  // Initialize local state with the current stock quantities
  const [stocks, setStocks] = useState<ProductStock[]>(productStocks);
  const [isLoading, setIsLoading] = useState(false)
  // router.refresh() is async: it re-renders the server component and streams
  // fresh props down. Wrapping it in a transition keeps the button disabled
  // until that lands, instead of the request finishing and the numbers on
  // screen still being the old ones.
  const [isPending, startTransition] = useTransition()
  const busy = isLoading || isPending
  const router = useRouter();

  // A transfer changes these quantities server-side, and router.refresh() only
  // hands down fresh props — the useState initializer above would keep showing
  // the pre-transfer numbers without this.
  useEffect(() => {
    setStocks(productStocks);
  }, [productStocks]);

  const handleChange = (id: string, value: number) => {
    setStocks((prev) =>
      prev.map((stock) =>
        stock._id === id ? { ...stock, quantity: value } : stock
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setIsLoading(true)
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

      if (!res.ok) {
        toast.error('حدث خطأ ما أثناء تعديل الكميات. الرجاء المحاولة مرة أخرى.');
        return;
      }
      toast.success('تمت تعديل الكميات بنجاح!');
      // We are already on /hospitals/[id]; pushing that same route was a no-op
      // that never resolved, so the button stayed on "جاري الحفظ..." forever.
      startTransition(() => router.refresh());
    } catch (error: any) {
      toast.error('حدث خطأ ما أثناء تعديل الكميات. الرجاء المحاولة مرة أخرى.');
      console.error("Error updating:", error?.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Outside the <form> so the trigger can never act as a submit button. */}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 lg:max-w-1/3">
        <h1>الكميات المتاحة</h1>
        <TransferStockDialog
          userToken={userToken}
          hospitalId={hospitalId}
          hospitalName={hospitalName}
          productStocks={productStocks}
        />
      </div>

      <form
        className="flex flex-col gap-5 lg:max-w-1/3 mt-6"
        onSubmit={handleSubmit}
      >
        {stocks.map((stock) => (
          <div key={stock._id} className="flex flex-col gap-2">
            <Label htmlFor={`product-${stock._id}`}>
              {stock.product.name}
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
            disabled={busy}
          >
            {busy ? 'جاري الحفظ...' : 'احفظ الكميات'}
          </Button>
        </div>
      </form>
    </>
  );
};

export default HospitalStockDetails;
