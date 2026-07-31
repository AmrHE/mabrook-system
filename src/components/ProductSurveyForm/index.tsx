/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies, headers } from 'next/headers';
import React from 'react'
import SurveyForm from './Survey';

async function getMom(id: string, userToken: any) {
  const headersList = await headers();
  const host = headersList.get('host');

  const res = await fetch(`${process.env.NODE_ENV === "development" ? process.env.URL : `https://${host}`}/api/mom/get-mom/${id}`, {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${userToken}`,
    },
  });
  return res.json();
}

const ProductSurveyForm = async ({ id }: { id: string }) => {
  const cookieStore = await cookies();
  const userToken = cookieStore.get('access_token')?.value;

  const data = await getMom(id, userToken);
  // Only the box that was actually given to this mom (set at creation).
  const survey = Array.isArray(data?.mom?.survey) ? data.mom.survey : [];

  return (
    <div>
      <SurveyForm userToken={userToken} survey={survey} id={id} />
    </div>
  )
}

export default ProductSurveyForm
