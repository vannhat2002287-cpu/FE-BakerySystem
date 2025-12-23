export type ProductType = 'food' | 'drink' | 'alcohol' | 'merchandise';

export interface Category {
  category_id: string;
  name: string;
}

export interface Product {
  product_id: string;
  name: string;
  price: number;
  type: ProductType;
  is_alcoholic: boolean;
  category_id: string;
  image_url: string;
  is_active: boolean;
}

export interface Inventory {
  product_id: string;
  current_quantity: number;
  min_threshold: number;
  last_updated: string;
}

export type OrderType = 'eat-in' | 'takeaway';
// Only Cash is supported now
export type PaymentMethod = 'cash';

export interface OrderDetail {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
}

export interface Order {
  order_id: string;
  order_time: string; // ISO string
  order_type: OrderType;
  total_amount: number;
  payment_method: PaymentMethod;
  payment_received: number;
  change_amount: number;
  items: OrderDetail[];
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Shift {
  shift_id: string;
  name: string;
  start_time: string;
  end_time: string;
}