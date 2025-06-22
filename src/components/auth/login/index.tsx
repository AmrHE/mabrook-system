'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Image from 'next/image'
import React, { useState } from 'react'
import logo from '../../../../public/logo.svg'
import { useRouter } from 'next/navigation';

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter();


  const handleLogin = async () => {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (data.status !== 200) {
        setError(data.message || 'Login failed')
      } else {
        // Handle successful login (e.g., redirect or store token)
        router.push('/')
      }
    } catch (err) {
      console.error('Error during login:', err)
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('An unexpected error occurred')
      }
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className='bg-white max-w-md text-center p-8 rounded-lg shadow-md mx-2.5'>
      <Image src={logo} alt='logo' width={260} height={145} className='mx-auto' />
      <h1 className='font-medium text-xl m-2'>Welcome to Mabrouk System!</h1>
      <p className='text-sm text-[#8B8D97] mb-16'>Login to your account</p>
      <div className='space-y-4'>
        <Input
          type='email'
          placeholder='Email Address'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className='w-full sm:w-96 p-4 h-12'
        />
        <Input
          type='password'
          placeholder='Password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className='w-full sm:w-96 p-4 h-12'
        />
        {error && <p className='text-red-500 text-sm'>{error}</p>}
        <Button
          className='bg-[#5570F1] w-44 h-14 text-xl mt-10'
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? 'Logging in...' : 'Login'}
        </Button>
      </div>
    </div>
  )
}

export default Login
