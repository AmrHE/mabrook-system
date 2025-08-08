/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies, headers } from 'next/headers';
import React from 'react'
import SurveyForm from './Survey';


async function getProducts( userToken: any) {
  const headersList = await headers();
  const host = headersList.get('host');

const res = await fetch(`${process.env.NODE_ENV === "development" ? process.env.URL : `https://${host}`}/api/product/get-all`, {
  cache: 'no-store',
  headers: {
    'Content-Type': 'application/json',
    authorization: `Bearer ${userToken}`,
  },
});
return res.json();
}

const ProductSurveyForm = async({id} : {id: string}) => {
  const cookieStore = await cookies();
  const userToken = cookieStore.get('access_token')?.value;

  const products = await getProducts(userToken);


  // const productsWithQuestions = products.products.filter(
  //   (product) => product.questions && product.questions.length > 0
  // );


  console.log({products})
  return (
    <div>
      <SurveyForm userToken={userToken} products={products.products} id={id}/>
    </div>
  )
}

export default ProductSurveyForm