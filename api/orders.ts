/**
 * @authors Huynh and Hue
 */

import { apiRequest } from "./client";
import { buildApiUrl, API_ENDPOINTS } from "./config";
import { Order, OrderType, PaymentMethod } from "../types";

// DTO request tạo đơn
interface OrderItemRequestDTO {
  productId: number;
  quantity: number;
}

interface OrderRequestDTO {
  orderType: "EAT_IN" | "TAKEAWAY";
  paymentMethod: "cash";
  paymentReceived: number;
  items: OrderItemRequestDTO[];
}

// DTO response đơn hàng
interface OrderItemDTO {
  product_id: number;
  name: string;
  quantity: number;
  unit_price: number;
}

interface OrderDTO {
  order_id: number;
  order_time: string;
  order_type: "EAT_IN" | "TAKEAWAY";
  total_amount: number;
  payment_method: "cash";
  payment_received: number;
  change_amount: number;
  items: OrderItemDTO[];
}

// Chuyển đổi orderType giữa BE và FE
function mapBackendOrderTypeToFrontend(orderType: "EAT_IN" | "TAKEAWAY"): OrderType {
  return orderType === "EAT_IN" ? "eat-in" : "takeaway";
}

function mapBackendPaymentMethodToFrontend(paymentMethod: "cash"): PaymentMethod {
  return "cash";
}

function mapOrderTypeToBackend(orderType: OrderType): "EAT_IN" | "TAKEAWAY" {
  return orderType === "eat-in" ? "EAT_IN" : "TAKEAWAY";
}

function mapPaymentMethodToBackend(paymentMethod: PaymentMethod): "cash" {
  return "cash";
}

// Chuyển dữ liệu FE sang DTO để gửi BE
function mapOrderToRequestDTO(
  items: Array<{ product_id: string; quantity: number }>,
  orderType: OrderType,
  paymentMethod: PaymentMethod,
  paymentReceived: number
): OrderRequestDTO {
  return {
    orderType: mapOrderTypeToBackend(orderType),
    paymentMethod: mapPaymentMethodToBackend(paymentMethod),
    paymentReceived,
    items: items.map((item) => ({
      productId: Number.parseInt(item.product_id),
      quantity: item.quantity,
    })),
  };
}

// Chuyển DTO sang format Frontend
function mapOrderDTOToOrder(dto: OrderDTO): Order {
  return {
    order_id: String(dto.order_id),
    order_time: dto.order_time,
    order_type: mapBackendOrderTypeToFrontend(dto.order_type),
    total_amount: dto.total_amount,
    payment_method: mapBackendPaymentMethodToFrontend(dto.payment_method),
    payment_received: dto.payment_received,
    change_amount: dto.change_amount,
    items: dto.items.map((item) => ({
      product_id: String(item.product_id),
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
    })),
  };
}

// Tạo đơn hàng mới
export async function createOrder(
  items: Array<{ product_id: string; quantity: number }>,
  orderType: OrderType,
  paymentMethod: PaymentMethod,
  paymentReceived: number
): Promise<Order> {
  const url = buildApiUrl(API_ENDPOINTS.ORDERS);
  const requestBody = mapOrderToRequestDTO(items, orderType, paymentMethod, paymentReceived);

  const data = await apiRequest<OrderDTO>(url, {
    method: "POST",
    body: JSON.stringify(requestBody),
  });

  return mapOrderDTOToOrder(data);
}

// Lấy danh sách đơn theo ngày
export async function getOrdersByDate(date: string, orderType?: OrderType): Promise<Order[]> {
  const params: Record<string, string> = { date };
  if (orderType) {
    params.type = mapOrderTypeToBackend(orderType);
  }

  const url = buildApiUrl(API_ENDPOINTS.ORDERS, params);
  const data = await apiRequest<OrderDTO[]>(url);

  return data.map(mapOrderDTOToOrder);
}

// Lấy chi tiết đơn theo ID
export async function getOrderById(orderId: string): Promise<Order> {
  const url = buildApiUrl(`${API_ENDPOINTS.ORDERS}/${orderId}`);
  const data = await apiRequest<OrderDTO>(url);

  return mapOrderDTOToOrder(data);
}
