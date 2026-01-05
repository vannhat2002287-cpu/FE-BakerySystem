import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Product, Inventory, Order, CartItem, OrderType, PaymentMethod } from "../types";
import { getProducts } from "../api/products";
import { getAllInventory } from "../api/inventory";
import { createOrder } from "../api/orders";
import { ApiError } from "../api/client";
import toast from "react-hot-toast";

interface StoreContextType {
  products: Product[];
  inventory: Inventory[];
  orders: Order[];
  cart: CartItem[];
  isLoading: boolean;
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, delta: number) => void;
  clearCart: () => void;
  placeOrder: (
    orderType: OrderType,
    paymentMethod: PaymentMethod,
    receivedAmount: number
  ) => Promise<boolean>;
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
  const [isLoading, setIsLoading] = useState<boolean>(true);

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

  // Fetch products and inventory from API on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [productsData, inventoryData] = await Promise.all([
          getProducts({ is_active: true }),
          getAllInventory(),
        ]);
        setProducts(productsData);
        setInventory(inventoryData);
      } catch (error) {
        console.error("Failed to fetch data:", error);
        if (error instanceof ApiError) {
          toast.error(`Failed to load data: ${error.message}`);
        } else {
          toast.error("Failed to connect to server. Please check your connection.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const isStockManaged = (product: Product | undefined) => {
    if (!product) return false;
    // Drinks and Alcohol are not subject to inventory tracking
    return product.type !== "drink" && product.type !== "alcohol";
  };

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.product_id);
      if (existing) {
        // Check inventory limit ONLY if stock is managed
        if (isStockManaged(product)) {
          const stock = inventory.find((inv) => inv.product_id === product.product_id);
          if (stock && existing.quantity >= stock.current_quantity) {
            toast.error("在庫不足です (Out of Stock)");
            return prev;
          }
        }
        return prev.map((item) =>
          item.product_id === product.product_id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev.map((item) => {
        if (item.product_id === productId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return item; // Don't remove, just floor at 1. Or allow remove? Let's floor at 1.

          const product = products.find((p) => p.product_id === productId);

          // Check inventory ONLY if stock is managed
          if (product && isStockManaged(product)) {
            const stock = inventory.find((inv) => inv.product_id === productId);
            if (stock && newQty > stock.current_quantity) {
              toast.error("在庫不足です (Out of Stock)");
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
    setInventory((prev) =>
      prev.map((item) =>
        item.product_id === productId
          ? {
              ...item,
              current_quantity: newQuantity,
              last_updated: new Date().toISOString(),
            }
          : item
      )
    );
  };

  const placeOrder = async (
    orderType: OrderType,
    paymentMethod: PaymentMethod,
    receivedAmount: number
  ): Promise<boolean> => {
    if (cart.length === 0) return false;

    try {
      // Prepare order items for API
      const orderItems = cart.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      }));

      // Call API to create order
      const newOrder = await createOrder(orderItems, orderType, paymentMethod, receivedAmount);

      // Add order to local state
      setOrders((prev) => [newOrder, ...prev]);

      // Refresh inventory from API to get updated stock
      try {
        const updatedInventory = await getAllInventory();
        setInventory(updatedInventory);
      } catch (error) {
        console.error("Failed to refresh inventory:", error);
        // Continue even if inventory refresh fails
      }

      // Clear cart
      setCart([]);
      toast.success("Order created successfully!");
      return true;
    } catch (error) {
      console.error("Failed to place order:", error);
      if (error instanceof ApiError) {
        // Try to extract error message from backend response
        let errorMessage = error.message;
        if (error.response) {
          if (typeof error.response === "string") {
            errorMessage = error.response;
          } else if (error.response.message) {
            errorMessage = error.response.message;
          } else if (error.response.error) {
            errorMessage = error.response.error;
          }
        }
        toast.error(`Failed to create order: ${errorMessage}`);
      } else {
        toast.error("Failed to connect to server. Please try again.");
      }
      return false;
    }
  };

  return (
    <StoreContext.Provider
      value={{
        products,
        inventory,
        orders,
        cart,
        isLoading,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        placeOrder,
        updateInventory,
        currentTime,
        setSimulationTime,
        resetSimulation,
        isSimulationMode,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
};
