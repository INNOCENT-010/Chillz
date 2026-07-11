import { create } from "zustand";

interface CartItem {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  category: string;
  qty: number;
}

interface VenueCartState {
  venueId: string | null;
  items: Record<string, CartItem>;
  setVenueId: (id: string) => void;
  increment: (item: Omit<CartItem, "qty">) => void;
  decrement: (itemId: string) => void;
  clear: () => void;
  selectedTotal: () => number;
  selectedCount: () => number;
}

export const useVenueCart = create<VenueCartState>((set, get) => ({
  venueId: null,
  items: {},

  setVenueId: (id) => {
    // Clear cart if switching venues
    if (get().venueId && get().venueId !== id) {
      set({ venueId: id, items: {} });
    } else {
      set({ venueId: id });
    }
  },

  increment: (item) =>
    set((state) => ({
      items: {
        ...state.items,
        [item.id]: {
          ...item,
          qty: (state.items[item.id]?.qty || 0) + 1,
        },
      },
    })),

  decrement: (itemId) =>
    set((state) => {
      const current = state.items[itemId]?.qty || 0;
      if (current <= 1) {
        const next = { ...state.items };
        delete next[itemId];
        return { items: next };
      }
      return {
        items: {
          ...state.items,
          [itemId]: { ...state.items[itemId], qty: current - 1 },
        },
      };
    }),

  clear: () => set({ items: {} }),

  selectedTotal: () =>
    Object.values(get().items).reduce(
      (acc, item) => acc + item.price * item.qty,
      0
    ),

  selectedCount: () =>
    Object.values(get().items).reduce((acc, item) => acc + item.qty, 0),
}));