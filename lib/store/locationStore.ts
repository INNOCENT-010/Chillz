import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface LocationState {
  lat: number | null
  lng: number | null
  address: string
  radiusKm: number
  setLocation: (lat: number, lng: number, address: string) => void
  setRadius: (km: number) => void
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      lat: null, lng: null,
      address: 'Lagos, Nigeria',
      radiusKm: 10,
      setLocation: (lat, lng, address) => set({ lat, lng, address }),
      setRadius: (radiusKm) => set({ radiusKm }),
    }),
    { name: 'chillz-location' }
  )
)
