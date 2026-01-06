import React, { useState, useEffect, useMemo } from "react";
import { Search, Grid, Trash2, Plus, Minus, Clock } from "lucide-react";
import { useStore } from "@/store/StoreContext";
import { Product, OrderType, PaymentMethod, Category } from "@/types";
import { getCategories } from "@/api/categories";
import toast from "react-hot-toast";
import Loading from "@/components/Loading";

// Component chính cho giao diện POS (Point of Sale) - hệ thống bán hàng tại quầy
const POS: React.FC = () => {
  // Lấy dữ liệu từ store (context) bao gồm sản phẩm, kho hàng, giỏ hàng, v.v.
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

  // Các state cục bộ cho tìm kiếm, danh mục, loại đơn hàng, v.v.
  const [searchQuery, setSearchQuery] = useState(""); // Từ khóa tìm kiếm sản phẩm
  const [selectedCategory, setSelectedCategory] = useState<string>("all"); // Danh mục được chọn
  const [orderType, setOrderType] = useState<OrderType>("takeaway"); // Loại đơn hàng: takeaway hoặc eat-in
  const [categories, setCategories] = useState<Category[]>([]); // Danh sách danh mục sản phẩm

  // State cho modal thanh toán
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false); // Có mở modal thanh toán không
  const paymentMethod: PaymentMethod = "cash"; // Phương thức thanh toán mặc định là tiền mặt
  const [isProcessing, setIsProcessing] = useState(false); // Đang xử lý thanh toán không

  // Logic liên quan đến thời gian: kiểm tra giờ cho rượu và ăn tại chỗ
  const currentHour = currentTime.getHours(); // Giờ hiện tại
  const currentMinutes = currentTime.getMinutes(); // Phút hiện tại
  const ALCOHOL_START_HOUR = 17; // Giờ bắt đầu bán rượu (17:00)
  const isAlcoholAllowed = currentTime.getHours() >= ALCOHOL_START_HOUR; // Cho phép bán rượu chưa
  const isEatInAllowed = currentHour < 20 || (currentHour === 20 && currentMinutes < 30); // Cho phép ăn tại chỗ (trước 20:30)

  // useEffect: Lấy danh sách danh mục khi component mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const categoriesData = await getCategories(); // Gọi API lấy danh mục
        setCategories(categoriesData); // Lưu vào state
      } catch (error) {
        console.error("Failed to fetch categories:", error); // Log lỗi nếu có
      }
    };
    fetchCategories();
  }, []);

  // useEffect: Tự động chuyển loại đơn hàng về takeaway nếu không cho phép eat-in
  useEffect(() => {
    if (!isEatInAllowed && orderType === "eat-in") {
      setOrderType("takeaway");
    }
  }, [isEatInAllowed, orderType]);

  // State dẫn xuất: Lọc sản phẩm dựa trên tìm kiếm và danh mục
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()); // Khớp từ khóa tìm kiếm
      const matchesCategory = selectedCategory === "all" || p.category_id === selectedCategory; // Khớp danh mục
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Tính tổng tiền và số lượng sản phẩm trong giỏ
  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0); // Tổng tiền
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0); // Tổng số lượng

  // Hàm xử lý khi click vào sản phẩm
  const handleProductClick = (product: Product) => {
    // Kiểm tra sản phẩm có phải đồ uống có cồn không (dựa trên nhiều tiêu chí để tránh sót)
    const isAlcoholic =
      product.category_id === "c5" ||
      product.type === "alcohol" ||
      product.is_alcoholic === true ||
      String(product.is_alcoholic) === "true";

    // Nếu là rượu và chưa đến giờ bán, hiển thị lỗi
    if (isAlcoholic && !isAlcoholAllowed) {
      toast.error(
        `アルコール類は${ALCOHOL_START_HOUR}:00以降のみ販売可能です。(現在: ${currentTime.toLocaleTimeString([], { timeZone: "Asia/Ho_Chi_Minh" })})`
      );
      return;
    }

    // Kiểm tra kho hàng chỉ cho thực phẩm/hàng hóa (không phải đồ uống hoặc rượu)
    const isStockManaged = product.type !== "drink" && product.type !== "alcohol";
    if (isStockManaged) {
      const inv = inventory.find((i) => i.product_id === product.product_id); // Tìm kho của sản phẩm
      if (!inv || inv.current_quantity <= 0) {
        toast.error("在庫切れです (Out of Stock)"); // Lỗi hết hàng
        return;
      }
    }
    addToCart(product); // Thêm vào giỏ
  };

  // Hàm xử lý thanh toán
  const handleCheckout = async () => {
    setIsProcessing(true); // Bắt đầu xử lý
    const received = totalAmount; // Số tiền nhận (bằng tổng tiền vì chỉ có tiền mặt)

    try {
      // Gửi yêu cầu đặt hàng. Nếu server lỗi, sẽ catch
      const success = await placeOrder(orderType, paymentMethod, received);
      if (success) {
        setIsPaymentModalOpen(false); // Đóng modal
        toast.success("会計が完了しました。"); // Thông báo thành công
      }
    } catch (error: any) {
      // Hiển thị lỗi từ server để debug
      const serverMessage = error.response?.data?.message || error.message;
      console.error("Payment failed:", serverMessage);
      toast.error(`決済エラー: ${serverMessage}`);
    } finally {
      setIsProcessing(false); // Kết thúc xử lý
    }
  };

  // Render giao diện
  return (
    <div className="flex h-full">
      {/* Bên trái: Danh sách sản phẩm */}
      <div className="flex h-full flex-1 flex-col overflow-hidden bg-gray-50">
        {/* Header: Tìm kiếm và danh mục */}
        <div className="z-10 border-b border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">商品一覧</h2>{" "}
            {/* Tiêu đề danh sách sản phẩm */}
            <div className="bg-brand-50 text-brand-700 border-brand-100 flex items-center rounded-full border px-3 py-1 text-sm font-bold">
              <Clock className="mr-2 h-4 w-4" /> {/* Icon đồng hồ */}
              {currentTime.toLocaleTimeString("ja-JP", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                timeZone: "Asia/Ho_Chi_Minh",
              })}
            </div>
          </div>

          {/* Ô tìm kiếm */}
          <div className="mb-4 flex space-x-4">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 transform text-gray-400" />{" "}
              {/* Icon tìm kiếm */}
              <input
                type="text"
                placeholder="商品を検索..." // Placeholder tìm kiếm
                className="focus:ring-brand-500 w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 outline-none focus:border-transparent focus:ring-2"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)} // Cập nhật từ khóa tìm kiếm
              />
            </div>
          </div>

          {/* Nút chọn danh mục */}
          <div className="scrollbar-hide flex space-x-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory("all")} // Chọn tất cả
              className={`rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === "all"
                  ? "bg-brand-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              すべて {/* Tất cả */}
            </button>
            {categories.map(
              (
                cat // Render nút cho từng danh mục
              ) => (
                <button
                  key={cat.category_id}
                  onClick={() => setSelectedCategory(cat.category_id)} // Chọn danh mục cụ thể
                  className={`rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === cat.category_id
                      ? "bg-brand-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {cat.name} {/* Tên danh mục */}
                </button>
              )
            )}
          </div>
        </div>

        {/* Lưới sản phẩm */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? ( // Nếu đang tải, hiển thị loading
            <div className="flex h-full items-center justify-center">
              <Loading message="Loading products..." />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 pb-20 md:grid-cols-3 lg:grid-cols-4">
              {" "}
              {/* Grid responsive */}
              {filteredProducts.map((product) => {
                // Tính kho hàng và trạng thái sản phẩm
                const stock =
                  inventory.find((i) => i.product_id === product.product_id)?.current_quantity || 0; // Số lượng kho
                const isStockManaged = product.type !== "drink" && product.type !== "alcohol"; // Có quản lý kho không
                // Sửa logic isAlcoholic để nhất quán với handleProductClick
                const isAlcoholic =
                  product.category_id === "c5" ||
                  product.type === "alcohol" ||
                  product.is_alcoholic === true ||
                  String(product.is_alcoholic) === "true"; // Là rượu không
                const isOutOfStock = isStockManaged && stock <= 0; // Hết hàng không
                const isAlcoholRestricted = isAlcoholic && !isAlcoholAllowed; // Bị hạn chế bán rượu không

                return (
                  <div
                    key={product.product_id}
                    onClick={() =>
                      !isOutOfStock && !isAlcoholRestricted && handleProductClick(product)
                    } // Click để thêm vào giỏ (nếu hợp lệ)
                    className={`relative cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-transform active:scale-95 ${
                      isOutOfStock || isAlcoholRestricted
                        ? "cursor-not-allowed opacity-60 grayscale" // Vô hiệu hóa nếu hết hàng hoặc bị hạn chế
                        : "hover:border-brand-300 hover:shadow-md"
                    } `}
                  >
                    <div className="relative aspect-square bg-gray-100">
                      <img
                        src={product.image_url} // Hình ảnh sản phẩm
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                      {/* Hiển thị kho nếu có */}
                      {isStockManaged && stock > 0 && (
                        <span
                          className={`absolute top-2 right-2 z-10 rounded-full px-2 py-1 text-xs font-bold shadow-sm ${
                            stock <= 5
                              ? "bg-red-500 text-white" // Màu đỏ nếu ít hàng
                              : "border border-gray-200 bg-white/80 text-gray-800 backdrop-blur-sm"
                          }`}
                        >
                          {stock <= 5 ? `残り ${stock}` : `在庫: ${stock}`} {/* Số lượng kho */}
                        </span>
                      )}
                      {/* Overlay nếu bị hạn chế bán rượu */}
                      {isAlcoholRestricted && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <span className="text-sm font-bold text-white">17:00~ 販売</span>{" "}
                          {/* Chỉ bán từ 17:00 */}
                        </div>
                      )}
                      {/* Overlay nếu hết hàng */}
                      {isOutOfStock && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <span className="text-lg font-bold text-white">SOLD OUT</span>{" "}
                          {/* Hết hàng */}
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="truncate text-sm font-bold text-gray-800">{product.name}</h3>{" "}
                      {/* Tên sản phẩm */}
                      <p className="text-brand-600 mt-1 font-bold">
                        ¥{product.price.toLocaleString()} {/* Giá sản phẩm */}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bên phải: Giỏ hàng và thanh toán */}
      <div className="z-20 flex h-full w-96 flex-col border-l border-gray-200 bg-white shadow-lg">
        {/* Header giỏ hàng */}
        <div className="border-b border-gray-200 bg-gray-50 p-4">
          {/* Nút chọn loại đơn hàng */}
          <div className="mb-4 flex rounded-lg bg-gray-200 p-1">
            <button
              onClick={() => isEatInAllowed && setOrderType("eat-in")} // Chọn ăn tại chỗ (nếu cho phép)
              disabled={!isEatInAllowed}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                orderType === "eat-in" ? "text-brand-600 bg-white shadow-sm" : "text-gray-500"
              } ${!isEatInAllowed ? "cursor-not-allowed opacity-50" : ""}`}
            >
              店内 (Eat-in) {/* Ăn tại chỗ */}
              {!isEatInAllowed && (
                <span className="block text-[10px] text-red-500">20:30終了</span>
              )}{" "}
              {/* Kết thúc lúc 20:30 */}
            </button>
            <button
              onClick={() => setOrderType("takeaway")} // Chọn mang đi
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                orderType === "takeaway" ? "text-brand-600 bg-white shadow-sm" : "text-gray-500"
              }`}
            >
              持ち帰り (Takeaway) {/* Mang đi */}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-700">現在の注文</h2>{" "}
            {/* Đơn hàng hiện tại */}
            <button
              onClick={clearCart} // Xóa giỏ hàng
              className="text-gray-400 transition-colors hover:text-red-500"
            >
              <Trash2 className="h-5 w-5" /> {/* Icon thùng rác */}
            </button>
          </div>
        </div>

        {/* Danh sách sản phẩm trong giỏ */}
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {cart.length === 0 ? ( // Nếu giỏ trống
            <div className="flex h-full flex-col items-center justify-center text-gray-400 opacity-50">
              <Grid className="mb-2 h-16 w-16" /> {/* Icon lưới */}
              <p>カートは空です</p> {/* Giỏ trống */}
            </div>
          ) : (
            cart.map(
              (
                item // Render từng item trong giỏ
              ) => (
                <div
                  key={item.product_id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-white p-3 shadow-sm"
                >
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-800">{item.name}</h4>{" "}
                    {/* Tên sản phẩm */}
                    <p className="text-brand-600 text-sm font-bold">
                      ¥{item.price.toLocaleString()} {/* Giá */}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => removeFromCart(item.product_id)} // Xóa sản phẩm
                      className="rounded-full bg-gray-100 p-1 text-gray-500 hover:bg-red-100 hover:text-red-600"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => updateCartQuantity(item.product_id, -1)} // Giảm số lượng
                      className="rounded-full bg-gray-100 p-1 text-gray-600 hover:bg-gray-200"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-6 text-center font-bold text-gray-700">{item.quantity}</span>{" "}
                    {/* Số lượng */}
                    <button
                      onClick={() => updateCartQuantity(item.product_id, 1)} // Tăng số lượng
                      className="rounded-full bg-gray-100 p-1 text-gray-600 hover:bg-gray-200"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            )
          )}
        </div>

        {/* Tổng tiền và nút thanh toán */}
        <div className="border-t border-gray-200 bg-white p-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="mb-2 flex justify-between text-gray-600">
            <span>小計 ({totalItems}点)</span> {/* Tạm tính */}
            <span>¥{totalAmount.toLocaleString()}</span>
          </div>
          <div className="mb-6 flex justify-between border-t border-dashed border-gray-300 pt-4">
            <span className="text-xl font-bold text-gray-800">合計</span> {/* Tổng cộng */}
            <span className="text-brand-600 text-2xl font-bold">
              ¥{totalAmount.toLocaleString()}
            </span>
          </div>
          <button
            onClick={() => setIsPaymentModalOpen(true)} // Mở modal thanh toán
            disabled={cart.length === 0} // Vô hiệu hóa nếu giỏ trống
            className="bg-brand-600 hover:bg-brand-700 w-full rounded-xl py-4 text-lg font-bold text-white shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            会計に進む {/* Tiến hành thanh toán */}
          </button>
        </div>
      </div>

      {/* Modal thanh toán */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 p-6">
              <h3 className="text-xl font-bold text-gray-800">お支払い (現金のみ)</h3>{" "}
              {/* Thanh toán (chỉ tiền mặt) */}
              <button
                onClick={() => setIsPaymentModalOpen(false)} // Đóng modal
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6 p-6">
              <div className="mb-6 text-center">
                <p className="mb-1 text-gray-500">お支払い合計</p> {/* Tổng thanh toán */}
                <p className="text-4xl font-extrabold text-gray-800">
                  ¥{totalAmount.toLocaleString()}
                </p>
              </div>

              <div className="bg-brand-50 border-brand-100 rounded-xl border p-6 text-center">
                <p className="text-brand-800 mb-2 font-medium">
                  会計内容を確認して完了してください {/* Xác nhận và hoàn tất thanh toán */}
                </p>
                <p className="text-sm text-gray-500">＿＿＿＿＿</p>
              </div>
            </div>

            <div className="border-t border-gray-100 bg-gray-50 p-6">
              <button
                onClick={handleCheckout} // Xử lý thanh toán
                disabled={isProcessing} // Vô hiệu hóa khi đang xử lý
                className="bg-brand-600 hover:bg-brand-700 flex w-full items-center justify-center rounded-xl py-4 text-lg font-bold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isProcessing ? ( // Hiển thị spinner nếu đang xử lý
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
                {isProcessing ? "処理中..." : "会計を完了する"}{" "}
                {/* Đang xử lý hoặc Hoàn tất thanh toán */}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
