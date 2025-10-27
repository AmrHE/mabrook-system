 
"use client"
import React, { useState } from 'react'
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const EndVisitButton = ({id, userToken} : {id: string | undefined, userToken: string | undefined}) => {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter();

  async function endVisit() {
    setIsLoading(true)
  const res = await fetch(`/api/visit/end-visit/${id}`, {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${userToken}`,
    },
  });
  if (!res.ok) {
    toast.error('حدث خطأ ما أثناء انهاء الزيارة. الرجاء المحاولة مرة أخرى.');
    setIsLoading(false)
  }
  toast.success('تم انهاء الزيارة بنجاح!');
  router.push(`/`)
}
  return (
    <Button size="lg" className='py-5 bg-[#5570F1] hover:bg-[#3250e9] transition-all duration-500' onClick={endVisit} disabled={isLoading}>
      <span className='text-lg'>
        {isLoading ? 'جاري الإنهاء...' : 'انهاء الزيارة'}
      </span>
    </Button>
  )
}

export default EndVisitButton