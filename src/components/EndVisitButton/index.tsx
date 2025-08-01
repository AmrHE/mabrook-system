 
"use client"
import React from 'react'
import { Button } from '../ui/button';

const EndVisitButton = ({id, userToken} : {id: string | undefined, userToken: string | undefined}) => {

  async function endVisit() {
  const res = await fetch(`/api/visit/end-visit/${id}`, {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${userToken}`,
    },
  });
  return res.json();
}
  return (
    <Button size="lg" className='py-5 bg-[#5570F1] hover:bg-[#3250e9] transition-all duration-500' onClick={endVisit}>
      <span className='text-lg'>
        انهاء الزيارة
      </span>
    </Button>
  )
}

export default EndVisitButton