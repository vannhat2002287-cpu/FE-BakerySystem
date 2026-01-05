import React, { useState, useEffect, useMemo } from "react";
import { Search, Grid, Trash2, Plus, Minus, Clock } from "lucide-react";
import { useStore } from "@/store/StoreContext";
import { Product, OrderType, PaymentMethod, Category } from "@/types";
import { getCategories } from "@/api/categories";
import toast from "react-hot-toast";
import Loading from "@/components/Loading";

const POS: React.FC = () => {
  const {
    products,
    inventory,
    cart,
    isLoading,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    placeOrder,
    currentTime,
  } = useStore();

  // Local State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [orderType, setOrderType] = useState<OrderType>("takeaway");
  const [categories, setCategories] = useState<Category[]>([]);

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  // Default and only option is cash
  const paymentMethod: PaymentMethod = "cash";
  const [isProcessing, setIsProcessing] = useState(false);

  // Time Logic
  const currentHour = currentTime.getHours();
  const currentMinutes = currentTime.getMinutes();

  const isAlcoholAllowed = currentHour >= 17;
  const isEatInAllowed = currentHour < 20 || (currentHour === 20 && currentMinutes < 30);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const categoriesData = await getCategories();
        setCategories(categoriesData);
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (!isEatInAllowed && orderType === "eat-in") {
      setOrderType("takeaway");
    }
  }, [isEatInAllowed, orderType]);

  // Derived State
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === "all" || p.category_id === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Handlers
  const handleProductClick = (product: Product) => {
    if (product.is_alcoholic && !isAlcoholAllowed) {
      toast.error("アルコール類は17:00以降のみ販売可能です。");
      return;
    }

    // Check inventory ONLY for food/merchandise
    const isStockManaged = product.type !== "drink" && product.type !== "alcohol";

    if (isStockManaged) {
      const inv = inventory.find((i) => i.product_id === product.product_id);
      if (!inv || inv.current_quantity <= 0) {
        toast.error("在庫切れです (Out of Stock)");
        return;
      }
    }
    addToCart(product);
  };

  const handleCheckout = async () => {
    setIsProcessing(true);
    // Direct payment assumes exact amount received
    const received = totalAmount;

    try {
      const success = await placeOrder(orderType, paymentMethod, received);
      if (success) {
        setIsPaymentModalOpen(false);
        // Show success feedback logic could go here
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* LEFT: Product Catalog */}
      <div className="flex h-full flex-1 flex-col overflow-hidden bg-gray-50">
        {/* Header: Search & Category */}
        <div className="z-10 border-b border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">商品一覧</h2>
            <div className="flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-500">
              <Clock className="mr-2 h-4 w-4" />
              {currentTime.toLocaleDateString("ja-JP")}{" "}
              {currentTime.toLocaleTimeString("ja-JP", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>

          <div className="mb-4 flex space-x-4">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
              <input
                type="text"
                placeholder="商品を検索..."
                className="focus:ring-brand-500 w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 outline-none focus:border-transparent focus:ring-2"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="scrollbar-hide flex space-x-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === "all"
                  ? "bg-brand-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              すべて
            </button>
            {categories.map((cat) => (
              <button
                key={cat.category_id}
                onClick={() => setSelectedCategory(cat.category_id)}
                className={`rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat.category_id
                    ? "bg-brand-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loading message="Loading products..." />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 pb-20 md:grid-cols-3 lg:grid-cols-4">
              {filteredProducts.map((product) => {
                const stock =
                  inventory.find((i) => i.product_id === product.product_id)?.current_quantity || 0;
                const isStockManaged = product.type !== "drink" && product.type !== "alcohol";

                const isOutOfStock = isStockManaged && stock <= 0;
                const isAlcoholRestricted = product.is_alcoholic && !isAlcoholAllowed;

                return (
                  <div
                    key={product.product_id}
                    onClick={() =>
                      !isOutOfStock && !isAlcoholRestricted && handleProductClick(product)
                    }
                    className={`relative cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-transform active:scale-95 ${
                      isOutOfStock || isAlcoholRestricted
                        ? "cursor-not-allowed opacity-60 grayscale"
                        : "hover:border-brand-300 hover:shadow-md"
                    } `}
                  >
                    <div className="relative aspect-square bg-gray-100">
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                      {isStockManaged && stock > 0 && (
                        <span
                          className={`absolute top-2 right-2 z-10 rounded-full px-2 py-1 text-xs font-bold shadow-sm ${
                            stock <= 5
                              ? "bg-red-500 text-white"
                              : "border border-gray-200 bg-white/80 text-gray-800 backdrop-blur-sm"
                          }`}
                        >
                          {stock <= 5 ? `残り ${stock}` : `在庫: ${stock}`}
                        </span>
                      )}
                      {isAlcoholRestricted && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <span className="text-sm font-bold text-white">17:00~ 販売</span>
                        </div>
                      )}
                      {isOutOfStock && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <span className="text-lg font-bold text-white">SOLD OUT</span>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="truncate text-sm font-bold text-gray-800">{product.name}</h3>
                      <p className="text-brand-600 mt-1 font-bold">
                        ¥{product.price.toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Cart & Checkout */}
      <div className="z-20 flex h-full w-96 flex-col border-l border-gray-200 bg-white shadow-lg">
        <div className="border-b border-gray-200 bg-gray-50 p-4">
          <div className="mb-4 flex rounded-lg bg-gray-200 p-1">
            <button
              onClick={() => isEatInAllowed && setOrderType("eat-in")}
              disabled={!isEatInAllowed}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                orderType === "eat-in" ? "text-brand-600 bg-white shadow-sm" : "text-gray-500"
              } ${!isEatInAllowed ? "cursor-not-allowed opacity-50" : ""}`}
            >
              店内 (Eat-in)
              {!isEatInAllowed && <span className="block text-[10px] text-red-500">20:30終了</span>}
            </button>
            <button
              onClick={() => setOrderType("takeaway")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                orderType === "takeaway" ? "text-brand-600 bg-white shadow-sm" : "text-gray-500"
              }`}
            >
              持ち帰り (Takeaway)
            </button>
          </div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-700">現在の注文</h2>
            <button
              onClick={clearCart}
              className="text-gray-400 transition-colors hover:text-red-500"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-gray-400 opacity-50">
              <Grid className="mb-2 h-16 w-16" />
              <p>カートは空です</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product_id}
                className="flex items-center justify-between rounded-lg border border-gray-100 bg-white p-3 shadow-sm"
              >
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-800">{item.name}</h4>
                  <p className="text-brand-600 text-sm font-bold">
                    {" "}
                    ¥{item.price.toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => updateCartQuantity(item.product_id, -1)}
                    className="rounded-full bg-gray-100 p-1 text-gray-600 hover:bg-gray-200"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center font-bold text-gray-700">{item.quantity}</span>
                  <button
                    onClick={() => updateCartQuantity(item.product_id, 1)}
                    className="rounded-full bg-gray-100 p-1 text-gray-600 hover:bg-gray-200"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-gray-200 bg-white p-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="mb-2 flex justify-between text-gray-600">
            <span>小計 ({totalItems}点)</span>
            <span>¥{totalAmount.toLocaleString()}</span>
          </div>

          <div className="mb-6 flex justify-between border-t border-dashed border-gray-300 pt-4">
            <span className="text-xl font-bold text-gray-800">合計</span>
            <span className="text-brand-600 text-2xl font-bold">
              ¥{totalAmount.toLocaleString()}
            </span>
          </div>

          <button
            onClick={() => setIsPaymentModalOpen(true)}
            disabled={cart.length === 0}
            className="bg-brand-600 hover:bg-brand-700 w-full rounded-xl py-4 text-lg font-bold text-white shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            会計に進む
          </button>
        </div>
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 p-6">
              <h3 className="text-xl font-bold text-gray-800">お支払い (現金のみ)</h3>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6 p-6">
              <div className="mb-6 text-center">
                <p className="mb-1 text-gray-500">お支払い合計</p>
                <p className="text-4xl font-extrabold text-gray-800">
                  ¥{totalAmount.toLocaleString()}
                </p>
              </div>

              <div className="bg-brand-50 border-brand-100 rounded-xl border p-6 text-center">
                <p className="text-brand-800 mb-2 font-medium">
                  会計内容を確認して完了してください
                </p>
                <p className="text-sm text-gray-500">＿＿＿＿＿</p>
              </div>
            </div>

            <div className="border-t border-gray-100 bg-gray-50 p-6">
              <button
                onClick={handleCheckout}
                disabled={isProcessing}
                className="bg-brand-600 hover:bg-brand-700 flex w-full items-center justify-center rounded-xl py-4 text-lg font-bold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isProcessing ? (
                  <svg
                    className="mr-3 -ml-1 h-5 w-5 animate-spin text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                ) : null}
                {isProcessing ? "処理中..." : "会計を完了する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
