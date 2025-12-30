import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product, Inventory, Order, CartItem, OrderType, PaymentMethod } from '../../types';

interface StoreContextType {
  products: Product[];
  inventory: Inventory[];
  orders: Order[];
  cart: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, delta: number) => void;
  clearCart: () => void;
  placeOrder: (orderType: OrderType, paymentMethod: PaymentMethod, receivedAmount: number) => Promise<boolean>;
  updateInventory: (productId: string, newQuantity: number) => void;
  // Time Management
  currentTime: Date;
  setSimulationTime: (date: Date) => void;
  resetSimulation: () => void;
  isSimulationMode: boolean;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  // Time Management State
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isSimulationMode, setIsSimulationMode] = useState<boolean>(false);

  // Timer Effect
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (!isSimulationMode) {
      timer = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000); // Update every second
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isSimulationMode]);

  const setSimulationTime = (date: Date) => {
    setIsSimulationMode(true);
    setCurrentTime(date);
  };

  const resetSimulation = () => {
    setIsSimulationMode(false);
    setCurrentTime(new Date());
  };

  // Load orders from local storage or mock initial data simulation
  useEffect(() => {
    // In a real app, this would fetch from API
  }, []);

  const isStockManaged = (product: Product | undefined) => {
    if (!product) return false;
    // Drinks and Alcohol are not subject to inventory tracking
    return product.type !== 'drink' && product.type !== 'alcohol';
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.product_id);
      if (existing) {
        // Check inventory limit ONLY if stock is managed
        if (isStockManaged(product)) {
          const stock = inventory.find(inv => inv.product_id === product.product_id);
          if (stock && existing.quantity >= stock.current_quantity) {
            alert('在庫不足です (Out of Stock)');
            return prev;
          }
        }
        return prev.map(item => 
          item.product_id === product.product_id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product_id !== productId));
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product_id === productId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return item; // Don't remove, just floor at 1. Or allow remove? Let's floor at 1.
          
          const product = products.find(p => p.product_id === productId);
          
          // Check inventory ONLY if stock is managed
          if (product && isStockManaged(product)) {
            const stock = inventory.find(inv => inv.product_id === productId);
            if (stock && newQty > stock.current_quantity) {
               // Silently fail or handled by UI
               return item; 
            }
          }
          return { ...item, quantity: newQty };
        }
        return item;
      });
    });
  };

  const clearCart = () => setCart([]);

  const updateInventory = (productId: string, newQuantity: number) => {
    setInventory(prev => prev.map(item => 
      item.product_id === productId ? { ...item, current_quantity: newQuantity, last_updated: new Date().toISOString() } : item
    ));
  };

  const placeOrder = async (orderType: OrderType, paymentMethod: PaymentMethod, receivedAmount: number): Promise<boolean> => {
    if (cart.length === 0) return false;

    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const changeAmount = receivedAmount - totalAmount;

    const newOrder: Order = {
      order_id: `ORD-${Date.now()}`,
      order_time: currentTime.toISOString(), // Use the simulated or real time
      order_type: orderType,
      total_amount: totalAmount,
      payment_method: paymentMethod,
      payment_received: receivedAmount,
      change_amount: changeAmount,
      items: cart.map(item => ({
        product_id: item.product_id,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.price
      }))
    };

    // Update Inventory
    setInventory(prev => {
      const nextInv = [...prev];
      cart.forEach(cartItem => {
        const product = products.find(p => p.product_id === cartItem.product_id);
        
        // Only decrement stock if the product is stock-managed (i.e. not drink or alcohol)
        if (product && isStockManaged(product)) {
          const idx = nextInv.findIndex(inv => inv.product_id === cartItem.product_id);
          if (idx > -1) {
            nextInv[idx] = {
              ...nextInv[idx],
              current_quantity: nextInv[idx].current_quantity - cartItem.quantity
            };
          }
        }
      });
      return nextInv;
    });

    setOrders(prev => [newOrder, ...prev]);
    setCart([]);
    return true;
  };

  return (
    <StoreContext.Provider value={{
      products,
      inventory,
      orders,
      cart,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      clearCart,
      placeOrder,
      updateInventory,
      currentTime,
      setSimulationTime,
      resetSimulation,
      isSimulationMode
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within StoreProvider');
  return context;
};