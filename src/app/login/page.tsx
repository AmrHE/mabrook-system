import Login from '@/components/auth/login'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation';
import React from 'react'

const LoginPage = async () => {
  const cookieStore = await cookies();
  const userToken = cookieStore.get('access_token')?.value;

  if(userToken){
    redirect('/')
  }

  return (
    <Login/>
  )
}

export default LoginPage