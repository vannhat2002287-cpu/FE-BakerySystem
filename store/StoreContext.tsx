/**
 * @authors Huynh and Hue
 */

// Global Store - Quản lý state chung: products, inventory, cart, orders, time
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Product, Inventory, Order, CartItem, OrderType, PaymentMethod } from "../types";
import { getProducts } from "../api/products";
import { getAllInventory } from "../api/inventory";
import { createOrder } from "../api/orders";
import { ApiError } from "../api/client";
import toast from "react-hot-toast";

// Định nghĩa kiểu dữ liệu cho Context
interface StoreContextType {
  products: Product[]; // Danh sách sản phẩm
  inventory: Inventory[]; // Danh sách tồn kho
  orders: Order[]; // Danh sách đơn hàng
  cart: CartItem[]; // Giỏ hàng hiện tại
  isLoading: boolean; // Đang tải dữ liệu
  addToCart: (product: Product) => void; // Thêm vào giỏ
  removeFromCart: (productId: string) => void; // Xóa khỏi giỏ
  updateCartQuantity: (productId: string, delta: number) => void; // Cập nhật số lượng
  clearCart: () => void; // Xóa giỏ hàng
  placeOrder: (
    // Đặt đơn hàng
    orderType: OrderType,
    paymentMethod: PaymentMethod,
    receivedAmount: number
  ) => Promise<boolean>;
  updateInventory: (productId: string, newQuantity: number) => void; // Cập nhật tồn kho
  // Quản lý thời gian (simulation mode)
  currentTime: Date; // Thời gian hiện tại
  setSimulationTime: (date: Date) => void; // Đặt thời gian giả lập
  resetSimulation: () => void; // Reset về thời gian thực
  isSimulationMode: boolean; // Đang ở chế độ giả lập?
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

// Provider component - bọc toàn bộ app
export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // State chính
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // State quản lý thời gian
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isSimulationMode, setIsSimulationMode] = useState<boolean>(false);

  // Timer: cập nhật thời gian mỗi giây (chỉ khi không simulation)
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

  // Bật chế độ giả lập thời gian
  const setSimulationTime = (date: Date) => {
    setIsSimulationMode(true);
    setCurrentTime(date);
  };

  // Tắt giả lập, về thời gian thực
  const resetSimulation = () => {
    setIsSimulationMode(false);
    setCurrentTime(new Date());
  };

  // Fetch products và inventory khi mount
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
          toast.error(`データの読み込みに失敗しました: ${error.message}`);
        } else {
          toast.error("サーバーに接続できません。接続を確認してください。");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Kiểm tra sản phẩm có quản lý tồn kho không (có entry trong inventory)
  const isStockManaged = (product: Product | undefined) => {
    if (!product) return false;
    return inventory.some((inv) => inv.product_id === product.product_id);
  };

  // Thêm sản phẩm vào giỏ (kiểm tra tồn kho nếu có)
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.product_id);
      if (existing) {
        // Kiểm tra tồn kho nếu sản phẩm có quản lý stock
        if (isStockManaged(product)) {
          const stock = inventory.find((inv) => inv.product_id === product.product_id);
          if (stock && existing.quantity >= stock.current_quantity) {
            toast.error("在庫不足です。");
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

  // Xóa sản phẩm khỏi giỏ
  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  };

  // Cập nhật số lượng trong giỏ (+ hoặc -)
  const updateCartQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev.map((item) => {
        if (item.product_id === productId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return item; // Không cho về 0

          const product = products.find((p) => p.product_id === productId);

          // Kiểm tra tồn kho nếu có quản lý
          if (product && isStockManaged(product)) {
            const stock = inventory.find((inv) => inv.product_id === productId);
            if (stock && newQty > stock.current_quantity) {
              toast.error("在庫不足です。");
              return item;
            }
          }
          return { ...item, quantity: newQty };
        }
        return item;
      });
    });
  };

  // Xóa toàn bộ giỏ hàng
  const clearCart = () => setCart([]);

  // Cập nhật số lượng tồn kho local
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

  // Đặt đơn hàng: gọi API, refresh inventory, clear cart
  const placeOrder = async (
    orderType: OrderType,
    paymentMethod: PaymentMethod,
    receivedAmount: number
  ): Promise<boolean> => {
    if (cart.length === 0) return false;

    try {
      // Chuẩn bị items cho API
      const orderItems = cart.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      }));

      // Gọi API tạo đơn
      const newOrder = await createOrder(orderItems, orderType, paymentMethod, receivedAmount);

      // Thêm vào state local
      setOrders((prev) => [newOrder, ...prev]);

      // Refresh inventory từ API
      try {
        const updatedInventory = await getAllInventory();
        setInventory(updatedInventory);
      } catch (error) {
        console.error("Failed to refresh inventory:", error);
      }

      // Xóa giỏ hàng
      setCart([]);
      toast.success("ご会計が完了されました。");
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
        toast.error(`注文の作成に失敗しました: ${errorMessage}`);
      } else {
        toast.error("サーバーに接続できません。再度お試しください。");
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

// Hook để sử dụng Store trong components
export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
};
