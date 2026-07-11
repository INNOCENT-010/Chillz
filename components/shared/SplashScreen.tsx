'use client'
import { useEffect, useState } from 'react'

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<'logo' | 'tagline' | 'out'>('logo')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('tagline'), 900)
    const t2 = setTimeout(() => setPhase('out'), 2200)
    const t3 = setTimeout(onComplete, 2700)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onComplete])

  return (
    <div className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#4B0082] transition-opacity duration-500 ${phase === 'out' ? 'opacity-0' : 'opacity-100'}`}>
      {/* Animated ring */}
      <div className="relative flex items-center justify-center mb-6">
        <div className="absolute w-32 h-32 rounded-full border-2 border-[#00C851]/30 animate-spin-slow" />
        <div className="absolute w-24 h-24 rounded-full border border-[#00C851]/20 animate-spin-slow" style={{ animationDirection: 'reverse', animationDuration: '2s' }} />
        <div className={`w-20 h-20 rounded-2xl bg-white flex items-center justify-center shadow-lg transition-all duration-700 ${phase === 'logo' ? 'animate-splash' : 'scale-100'}`}>
          <span className="font-syne font-black text-2xl text-[#4B0082] tracking-tight">Cz</span>
        </div>
      </div>

      {/* Brand name */}
      <div className={`transition-all duration-500 ${phase === 'logo' ? 'opacity-0 translate-y-3' : 'opacity-100 translate-y-0'}`}>
        <h1 className="font-syne font-black text-4xl text-white tracking-tight">CHILLZ</h1>
        <p className="text-[#00C851] text-sm text-center mt-1 font-dm tracking-widest uppercase">Find your vibe</p>
      </div>

      {/* Loading bar */}
      <div className="absolute bottom-16 w-24 h-0.5 bg-white/20 rounded-full overflow-hidden">
        <div className={`h-full bg-[#00C851] rounded-full transition-all duration-1800 ease-out ${phase === 'out' ? 'w-full' : phase === 'tagline' ? 'w-3/4' : 'w-1/4'}`} />
      </div>
    </div>
  )
}
