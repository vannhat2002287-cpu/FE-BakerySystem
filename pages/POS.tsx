/**
 * @authors Huynh and Hue
 * @optimized_by Gemini (UI/UX)
 */

import React, { useState, useEffect, useMemo } from "react";
import { Search, Grid, Trash2, Plus, Minus, Clock, UtensilsCrossed, Receipt } from "lucide-react";
import { useStore } from "@/store/StoreContext";
import { Product, OrderType, PaymentMethod, Category } from "@/types";
import { getCategories } from "@/api/categories";
import toast from "react-hot-toast";
import Loading from "@/components/Loading";
import { formatDateTime } from "@/utils/date";

// Component chính cho màn hình bán hàng POS
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

  // Từ khóa tìm kiếm sản phẩm
  const [searchQuery, setSearchQuery] = useState("");
  // Danh mục sản phẩm đang chọn
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  // Loại đơn hàng: mang về hoặc ăn tại chỗ
  const [orderType, setOrderType] = useState<OrderType>("takeaway");
  // Danh sách các danh mục sản phẩm
  const [categories, setCategories] = useState<Category[]>([]);

  // Trạng thái mở modal thanh toán
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  // Phương thức thanh toán (mặc định: tiền mặt)
  const paymentMethod: PaymentMethod = "cash";
  // Trạng thái đang xử lý thanh toán
  const [isProcessing, setIsProcessing] = useState(false);

  // Giờ hiện tại và các điều kiện bán hàng đặc biệt
  const currentHour = currentTime.getHours();
  const currentMinutes = currentTime.getMinutes();
  // Giờ bắt đầu cho phép bán đồ uống có cồn
  const ALCOHOL_START_HOUR = 17;
  // Có được phép bán đồ uống có cồn không
  const isAlcoholAllowed = currentTime.getHours() >= ALCOHOL_START_HOUR;
  // Có được phép chọn ăn tại chỗ không (trước 20:30)
  const isEatInAllowed = currentHour < 20 || (currentHour === 20 && currentMinutes < 30);

  // Lấy danh sách danh mục sản phẩm khi load trang
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

  // Nếu hết giờ ăn tại chỗ thì tự động chuyển sang mang về
  useEffect(() => {
    if (!isEatInAllowed && orderType === "eat-in") {
      setOrderType("takeaway");
    }
  }, [isEatInAllowed, orderType]);

  // Lọc sản phẩm theo từ khóa tìm kiếm và danh mục
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === "all" || p.category_id === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Tổng tiền và tổng số lượng sản phẩm trong giỏ hàng
  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Xử lý khi click vào sản phẩm để thêm vào giỏ hàng
  const handleProductClick = (product: Product) => {
    const isAlcoholic =
      product.category_id === "c5" ||
      product.type === "alcohol" ||
      product.is_alcoholic === true ||
      String(product.is_alcoholic) === "true";

    if (isAlcoholic && !isAlcoholAllowed) {
      toast.error(
        `アルコール類は${ALCOHOL_START_HOUR}:00以降のみ販売可能です。(現在: ${formatDateTime(currentTime, "h:mm A")})`
      );
      return;
    }

    const inv = inventory.find((i) => i.product_id === product.product_id);
    if (inv && inv.current_quantity <= 0) {
      toast.error("在庫切れです。");
      return;
    }
    addToCart(product);
  };

  // Xử lý khi bấm nút thanh toán
  const handleCheckout = async () => {
    setIsProcessing(true);
    const received = totalAmount;

    try {
      const success = await placeOrder(orderType, paymentMethod, received);
      if (success) {
        setIsPaymentModalOpen(false);
      }
    } catch (error: any) {
      const serverMessage = error.response?.data?.message || error.message;
      console.error("Payment failed:", serverMessage);
      toast.error(`決済エラー: ${serverMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-full bg-slate-50 font-sans text-slate-800">
      {/* LEFT SIDE: Products - Khu vực hiển thị danh sách sản phẩm */}
      <div className="flex h-full flex-1 flex-col overflow-hidden">
        {/* Header - Tiêu đề, đồng hồ, tìm kiếm, chọn danh mục */}
        <div className="z-10 border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
              <UtensilsCrossed className="h-6 w-6 text-orange-600" />
              商品一覧
            </h2>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-4 py-1.5 text-sm font-semibold text-slate-600">
              <Clock className="h-4 w-4 text-orange-500" />
              {formatDateTime(currentTime, "HH:mm:ss")}
            </div>
          </div>

          <div className="mb-4 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="商品を検索..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-4 pl-10 text-slate-700 transition-all outline-none focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-200"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="scrollbar-hide flex space-x-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`rounded-full px-5 py-2 text-sm font-bold transition-all ${
                selectedCategory === "all"
                  ? "bg-slate-800 text-white shadow-lg"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              すべて
            </button>
            {categories.map((cat) => (
              <button
                key={cat.category_id}
                onClick={() => setSelectedCategory(cat.category_id)}
                className={`rounded-full px-5 py-2 text-sm font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat.category_id
                    ? "bg-orange-600 text-white shadow-lg shadow-orange-200"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid - Lưới hiển thị các sản phẩm */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loading message="商品を読み込み中..." />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 pb-20 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredProducts.map((product) => {
                const invEntry = inventory.find((i) => i.product_id === product.product_id);
                const hasInventory = !!invEntry;
                const stock = invEntry?.current_quantity ?? 0;
                const isAlcoholic =
                  product.category_id === "c5" ||
                  product.type === "alcohol" ||
                  product.is_alcoholic === true ||
                  String(product.is_alcoholic) === "true";

                const isAlcoholRestricted = isAlcoholic && !isAlcoholAllowed;
                const isOutOfStock = hasInventory && stock <= 0;
                const isDisabled = isOutOfStock || isAlcoholRestricted;

                return (
                  <div
                    key={product.product_id}
                    onClick={() => !isDisabled && handleProductClick(product)}
                    className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all ${
                      isDisabled
                        ? "cursor-not-allowed border-slate-100 opacity-60 grayscale"
                        : "cursor-pointer border-slate-100 hover:-translate-y-1 hover:border-orange-300 hover:shadow-lg"
                    }`}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <span
                        className={`absolute top-2 right-2 z-10 rounded-full px-2.5 py-1 text-xs font-bold shadow-sm backdrop-blur-md ${
                          stock <= 0
                            ? "bg-slate-800 text-white"
                            : stock <= 5
                              ? "bg-red-500 text-white"
                              : "bg-white/90 text-slate-800"
                        }`}
                      >
                        {stock <= 0 ? "在庫なし" : stock <= 5 ? `残り ${stock}` : `${stock}`}
                      </span>
                      {isAlcoholRestricted && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-[2px]">
                          <span className="rounded-md border border-white/30 bg-black/40 px-3 py-1 text-sm font-bold text-white">
                            17:00~ 販売
                          </span>
                        </div>
                      )}
                      {isOutOfStock && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-[2px]">
                          <span className="rotate-[-12deg] rounded-md border-2 border-white px-4 py-1 text-xl font-black tracking-widest text-white uppercase">
                            Sold Out
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="mb-1 line-clamp-2 text-sm font-bold text-slate-700">
                        {product.name}
                      </h3>
                      <div className="mt-auto flex items-end justify-between">
                        <p className="text-lg font-bold text-orange-600">
                          ¥{product.price.toLocaleString()}
                        </p>
                        {!isDisabled && (
                          <div className="rounded-full bg-orange-50 p-1.5 text-orange-600 opacity-0 transition-opacity group-hover:opacity-100">
                            <Plus className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDE: Cart - Khu vực giỏ hàng và thanh toán */}
      <div className="z-20 flex h-full w-96 flex-col border-l border-slate-200 bg-white shadow-2xl">
        {/* Order Type Selector - Chọn loại đơn hàng: ăn tại chỗ hay mang về */}
        <div className="border-b border-slate-200 bg-slate-50 p-4">
          <div className="flex rounded-lg bg-slate-200 p-1">
            <button
              onClick={() => isEatInAllowed && setOrderType("eat-in")}
              disabled={!isEatInAllowed}
              className={`flex flex-1 flex-col items-center justify-center rounded-md py-2 text-sm font-bold transition-all ${
                orderType === "eat-in"
                  ? "bg-white text-orange-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-600"
              } ${!isEatInAllowed ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <span>店内 (Eat-in)</span>
              {!isEatInAllowed && (
                <span className="text-[10px] font-normal text-red-500">20:30終了</span>
              )}
            </button>
            <button
              onClick={() => setOrderType("takeaway")}
              className={`flex-1 rounded-md py-2 text-sm font-bold transition-all ${
                orderType === "takeaway"
                  ? "bg-white text-orange-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-600"
              }`}
            >
              持ち帰り
            </button>
          </div>
        </div>

        {/* Cart Header - Tiêu đề và nút xóa giỏ hàng */}
        <div className="flex items-center justify-between border-b border-dashed border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-bold text-slate-700">現在の注文</h2>
          </div>
          <button
            onClick={clearCart}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-red-500 transition-colors hover:bg-red-50"
            disabled={cart.length === 0}
          >
            <Trash2 className="h-3.5 w-3.5" /> 全削除
          </button>
        </div>

        {/* Cart Items - Danh sách sản phẩm trong giỏ hàng */}
        <div className="flex-1 space-y-1 overflow-y-auto bg-slate-50/50 p-4">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-slate-400">
              <div className="mb-4 rounded-full bg-slate-100 p-6">
                <Grid className="h-10 w-10 text-slate-300" />
              </div>
              <p className="font-medium">カートは空です</p>
              <p className="text-sm">商品をタップして追加してください</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product_id}
                className="group flex items-center justify-between rounded-xl border border-transparent bg-white p-3 shadow-sm transition-all hover:border-orange-200"
              >
                <div className="flex-1 pr-3">
                  <h4 className="line-clamp-1 text-sm font-bold text-slate-800">{item.name}</h4>
                  <p className="mt-1 text-sm font-bold text-orange-600">
                    ¥{item.price.toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-1">
                  <button
                    onClick={() =>
                      item.quantity === 1
                        ? removeFromCart(item.product_id)
                        : updateCartQuantity(item.product_id, -1)
                    }
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-slate-600 shadow-sm transition-colors hover:text-orange-600"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-4 text-center text-sm font-bold text-slate-800">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateCartQuantity(item.product_id, 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-slate-600 shadow-sm transition-colors hover:text-orange-600"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer / Checkout - Hiển thị tổng tiền và nút thanh toán */}
        <div className="z-30 bg-white p-6 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)]">
          <div className="mb-3 flex justify-between text-sm font-medium text-slate-500">
            <span>小計 ({totalItems}点)</span>
            <span>¥{totalAmount.toLocaleString()}</span>
          </div>
          <div className="mb-6 flex items-end justify-between border-t border-dashed border-slate-200 pt-4">
            <span className="text-lg font-bold text-slate-800">合計</span>
            <span className="text-3xl font-extrabold tracking-tight text-orange-600">
              ¥{totalAmount.toLocaleString()}
            </span>
          </div>
          <button
            onClick={() => setIsPaymentModalOpen(true)}
            disabled={cart.length === 0}
            className="w-full rounded-xl bg-slate-900 py-4 text-lg font-bold text-white shadow-lg shadow-slate-200 transition-all hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-orange-200 active:scale-95 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            会計に進む
          </button>
        </div>
      </div>

      {/* Payment Modal - Hộp thoại xác nhận thanh toán */}
      {isPaymentModalOpen && (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm duration-200">
          <div className="animate-in zoom-in-95 flex w-full max-w-md scale-100 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-800">お支払い確認</h3>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              >
                <Plus className="h-6 w-6 rotate-45" />
              </button>
            </div>

            <div className="p-8 text-center">
              <p className="mb-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">
                お支払い合計 (現金)
              </p>
              <p className="mb-8 text-5xl font-black tracking-tight text-slate-800">
                ¥{totalAmount.toLocaleString()}
              </p>

              <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4">
                <p className="text-sm font-medium text-orange-800">
                  現金を受け取り、会計を完了してください。
                </p>
              </div>
            </div>

            <div className="border-t border-slate-100 bg-slate-50 p-6">
              <button
                onClick={handleCheckout}
                disabled={isProcessing}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-4 text-lg font-bold text-white shadow-lg shadow-orange-200 transition-all hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isProcessing && (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
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
