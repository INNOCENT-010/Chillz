import { create } from "zustand";

interface WalletStore {
  balance: number;
  reservedBalance: number;
  setBalance: (balance: number) => void;
  setReservedBalance: (reserved: number) => void;
}

export const useWalletStore = create<WalletStore>((set) => ({
  balance: 0,
  reservedBalance: 0,
  setBalance: (balance) => set({ balance }),
  setReservedBalance: (reservedBalance) => set({ reservedBalance }),
}));
