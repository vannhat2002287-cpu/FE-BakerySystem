/**
 * @authors Huynh and Hue
 */

// Định nghĩa các kiểu dữ liệu chung cho ứng dụng

// Loại sản phẩm: bánh, đồ uống, rượu, hàng hóa khác
export type ProductType = "food" | "drink" | "alcohol" | "merchandise";

// Danh mục sản phẩm
export interface Category {
  category_id: string;
  name: string;
}

// Thông tin sản phẩm
export interface Product {
  product_id: string;
  name: string; // Tên sản phẩm
  price: number; // Giá (¥)
  type: ProductType; // Loại
  is_alcoholic: boolean; // Có cồn không
  category_id: string; // ID danh mục
  image_url: string; // URL hình ảnh
  is_active: boolean; // Đang bán không
}

// Thông tin tồn kho
export interface Inventory {
  product_id: string;
  current_quantity: number; // Số lượng hiện tại
  min_threshold: number; // Ngưỡng cảnh báo
  last_updated: string; // Lần cập nhật cuối
}

// Loại đơn hàng: ăn tại chỗ hoặc mang đi
export type OrderType = "eat-in" | "takeaway";
// Phương thức thanh toán (chỉ hỗ trợ tiền mặt)
export type PaymentMethod = "cash";

// Chi tiết một item trong đơn hàng
export interface OrderDetail {
  product_id: string;
  name: string;
  quantity: number; // Số lượng
  unit_price: number; // Đơn giá
}

// Đơn hàng
export interface Order {
  order_id: string;
  order_time: string; // Thời gian đặt (ISO string)
  order_type: OrderType; // Loại đơn
  total_amount: number; // Tổng tiền
  payment_method: PaymentMethod; // Phương thức thanh toán
  payment_received: number; // Tiền nhận
  change_amount: number; // Tiền thối
  items: OrderDetail[]; // Danh sách sản phẩm
}

// Item trong giỏ hàng (Product + số lượng)
export interface CartItem extends Product {
  quantity: number;
}

// Ca làm việc
export interface Shift {
  shift_id: string;
  name: string;
  start_time: string; // Giờ bắt đầu
  end_time: string; // Giờ kết thúc
}

// ============================================
// MODULE MỞ RỘNG: TỰ ĐỘNG ĐẶT HÀNG & QUẢN LÝ KHO
// ============================================

// Thông tin tồn kho mở rộng (cho module tự động đặt hàng)
export interface InventoryExtended extends Inventory {
  business_date: string; // Ngày kinh doanh (YYYY-MM-DD)
  start_of_day_quantity: number; // Số lượng đầu ngày (mặc định 20)
  reorder_point: number; // Điểm đặt hàng lại
  average_daily_sales: number; // Bình quân bán/ngày
}

// Trạng thái yêu cầu nhà máy mở rộng (thêm PARTIAL)
export type FactoryRequestStatus = "PENDING" | "PARTIAL" | "DELIVERED" | "CANCELLED";

// Yêu cầu nhà máy mở rộng (hỗ trợ Partial Delivery)
export interface FactoryRequestExtended {
  request_id: string;
  product_id: string;
  product_name: string;
  request_quantity: number; // Số lượng yêu cầu
  delivered_quantity: number; // Số lượng đã nhận
  created_at: string;
  eta_at: string;
  note?: string;
  status: FactoryRequestStatus;
  business_date: string; // Ngày kinh doanh
}

// Tổng hợp doanh số theo ngày (để tính average)
export interface DailySalesSummary {
  product_id: string;
  business_date: string;
  total_sold: number;
}

// Kết quả kiểm tra tự động đặt hàng
export interface AutoOrderCheckResult {
  product_id: string;
  product_name: string;
  current_stock: number;
  reorder_point: number;
  should_order: boolean;
  suggested_quantity: number;
  skip_reason?: string; // Lý do bỏ qua (nếu có)
}
