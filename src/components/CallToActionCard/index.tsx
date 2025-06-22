import Image from 'next/image'
import React from 'react'
import { Button } from '../ui/button'


interface ICTAProps {
  icon: string,
  title: string,
  text: string,
  cta: string,
  CtaIcon: React.ComponentType; // Add ctaIcon as an optional property
  action?: () => void | Promise<void>;
}

const CallToActionCard = ({icon, title, text, cta, action, CtaIcon} : ICTAProps) => {

    const handleClick = async () => {
    if (action) {
      try {
        await action();
      } catch (err) {
        console.error("CTA action failed:", err);
      }
    }
  };
  return (
    <div className='flex items-center justify-between bg-white rounded-xl p-10'>
      <div className='flex items-center ps-10 gap-4'>
        <Image src={icon} alt='icon' width={50} height={50}/>
        <div className='space-y-4'>
          <h1 className='font-medium text-xl'>{title}</h1>
          <p className='text-gray-500'>{text}</p>
        </div>
      </div>

      <Button size="lg" className='space-x-10 py-7 bg-[#5570F1] hover:bg-[#3250e9] transition-all duration-500' onClick={handleClick}>
        <span className='text-lg'>
          {cta}
        </span>

        <CtaIcon /> 
      </Button>
    </div>
  )
}

export default CallToActionCard