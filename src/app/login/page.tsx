import Login from '@/components/auth/login'
import { getServerSession } from '@/utils/auth/serverSession.server';
import { redirect } from 'next/navigation';
import React from 'react'

const LoginPage = async () => {
  // Presence is not liveness. The access-token cookie now persists for 30 days,
  // so a revoked or expired session still HAS one — bouncing on presence alone
  // would send the user to `/`, which middleware happily renders, leaving them
  // with a page where everything 401s and no way back to the login form.
  if (await getServerSession()) {
    redirect('/')
  }

  return (
    <Login/>
  )
}

export default LoginPage
