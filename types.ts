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
