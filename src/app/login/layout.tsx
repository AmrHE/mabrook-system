import React from 'react'

const AuthLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  return (
    <div 
      className='flex items-center justify-center min-h-screen bg-[#F4F4F4]'
    >
      {children}
    </div>
  )
}

export default AuthLayout