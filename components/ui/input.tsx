'use client'
import { cn } from '@/lib/utils'
import { type InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, leftIcon, rightIcon, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && <label className="text-sm font-medium text-[#0A0A0F]">{label}</label>}
        <div className="relative">
          {leftIcon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9999B3]">{leftIcon}</span>}
          <input
            ref={ref}
            className={cn(
              'w-full h-12 bg-[#F7F7FA] border border-[#EBEBF5] rounded-lg px-4 text-sm text-[#0A0A0F] placeholder:text-[#9999B3]',
              'outline-none focus:border-[#4B0082] focus:ring-2 focus:ring-[#4B0082]/10 transition-all',
              error && 'border-red-400 focus:border-red-400 focus:ring-red-400/10',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              className
            )}
            {...props}
          />
          {rightIcon && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9999B3]">{rightIcon}</span>}
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
