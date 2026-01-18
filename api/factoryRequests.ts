/**
 * @authors Huynh and Hue
 */

import { apiRequest } from "./client";
import { buildApiUrl, API_ENDPOINTS } from "./config";
import { FactoryRequestStatus } from "../types";
import { getCurrentBusinessDate } from "./inventory";

// DTO request tạo yêu cầu
interface FactoryRequestDTO {
  productId: number;
  requestQuantity: number;
  etaAt: string;
  note?: string;
  businessDate?: string;
}

// DTO response từ Backend
interface FactoryRequestResponseDTO {
  request_id: number;
  product_id: number;
  product_name: string;
  request_quantity: number;
  delivered_quantity?: number;
  created_at: string;
  eta_at: string;
  note?: string;
  status: FactoryRequestStatus;
  business_date?: string;
}

// Interface cho Frontend (backward compatible)
export interface FactoryRequest {
  request_id: string;
  product_id: string;
  product_name: string;
  request_quantity: number;
  delivered_quantity: number; // Thêm field mới
  created_at: string;
  eta_at: string;
  note?: string;
  status: FactoryRequestStatus;
  business_date: string; // Thêm field mới
}

// Chuyển DTO sang format Frontend
function mapFactoryRequestDTOToFactoryRequest(dto: FactoryRequestResponseDTO): FactoryRequest {
  const today = new Date().toISOString().split("T")[0];
  return {
    request_id: String(dto.request_id),
    product_id: String(dto.product_id),
    product_name: dto.product_name,
    request_quantity: dto.request_quantity,
    delivered_quantity: dto.delivered_quantity ?? 0,
    created_at: dto.created_at,
    eta_at: dto.eta_at,
    note: dto.note,
    status: dto.status,
    business_date: dto.business_date || today,
  };
}

// Chuyển dữ liệu FE sang DTO
function mapFactoryRequestToDTO(
  productId: string,
  requestQuantity: number,
  etaAt: string,
  note?: string,
  businessDate?: string
): FactoryRequestDTO {
  return {
    productId: Number.parseInt(productId),
    requestQuantity,
    etaAt: etaAt,
    note: note?.trim() || undefined,
    businessDate: businessDate || getCurrentBusinessDate(),
  };
}

// Lấy tất cả yêu cầu đặt hàng
export async function getAllFactoryRequests(): Promise<FactoryRequest[]> {
  const url = buildApiUrl(API_ENDPOINTS.FACTORY_REQUESTS);
  const data = await apiRequest<FactoryRequestResponseDTO[]>(url);

  return data.map(mapFactoryRequestDTOToFactoryRequest);
}

// Lấy yêu cầu đặt hàng theo ngày (cho filter theo business_date)
export async function getFactoryRequestsByDate(businessDate: string): Promise<FactoryRequest[]> {
  // Thử gọi API với filter date nếu Backend hỗ trợ
  try {
    const url = buildApiUrl(API_ENDPOINTS.FACTORY_REQUESTS, { date: businessDate });
    const data = await apiRequest<FactoryRequestResponseDTO[]>(url);
    return data.map(mapFactoryRequestDTOToFactoryRequest);
  } catch {
    // Fallback: Lấy tất cả và filter ở client
    const allRequests = await getAllFactoryRequests();
    return allRequests.filter((req) => {
      // Filter theo business_date hoặc created_at
      const reqDate = req.business_date || req.created_at.split("T")[0];
      return reqDate === businessDate;
    });
  }
}

// Lấy yêu cầu đang active của ngày hôm nay (PENDING hoặc PARTIAL)
export async function getActiveFactoryRequestsToday(): Promise<FactoryRequest[]> {
  const today = getCurrentBusinessDate();
  const requests = await getFactoryRequestsByDate(today);
  return requests.filter((req) => req.status === "PENDING" || req.status === "PARTIAL");
}

// Kiểm tra sản phẩm có đơn hàng đang pending không (No Spam check)
export async function hasActivePendingRequest(productId: string): Promise<boolean> {
  const activeRequests = await getActiveFactoryRequestsToday();
  return activeRequests.some((req) => req.product_id === productId);
}

// Tạo yêu cầu đặt hàng mới
export async function createFactoryRequest(
  productId: string,
  requestQuantity: number,
  etaAt: string,
  note?: string
): Promise<FactoryRequest> {
  const url = buildApiUrl(API_ENDPOINTS.FACTORY_REQUESTS);
  const requestBody = mapFactoryRequestToDTO(productId, requestQuantity, etaAt, note);

  const data = await apiRequest<FactoryRequestResponseDTO>(url, {
    method: "POST",
    body: JSON.stringify(requestBody),
  });

  return mapFactoryRequestDTOToFactoryRequest(data);
}

// Cập nhật trạng thái yêu cầu
export async function updateFactoryRequestStatus(
  requestId: string,
  status: FactoryRequestStatus
): Promise<FactoryRequest> {
  const url = buildApiUrl(`${API_ENDPOINTS.FACTORY_REQUESTS}/${requestId}/status`, {
    status,
  });

  const data = await apiRequest<FactoryRequestResponseDTO>(url, {
    method: "PATCH",
  });

  return mapFactoryRequestDTOToFactoryRequest(data);
}

// ============================================
// MODULE MỞ RỘNG: PARTIAL DELIVERY
// ============================================

// Cập nhật số lượng đã nhận (Partial Delivery)
export async function updatePartialDelivery(
  requestId: string,
  receivedQuantity: number
): Promise<FactoryRequest> {
  // Thử gọi API partial-delivery nếu Backend hỗ trợ
  try {
    const url = buildApiUrl(`${API_ENDPOINTS.FACTORY_REQUESTS}/${requestId}/partial-delivery`);
    const data = await apiRequest<FactoryRequestResponseDTO>(url, {
      method: "PATCH",
      body: JSON.stringify({ received_quantity: receivedQuantity }),
    });
    return mapFactoryRequestDTOToFactoryRequest(data);
  } catch {
    // Fallback: Không có API partial-delivery, xử lý ở client
    // Lấy request hiện tại và cập nhật status
    console.log("Partial delivery API not available, using status update fallback");
    throw new Error("Partial delivery requires backend support");
  }
}

// Tính backlog (số lượng còn thiếu)
export function calculateBacklog(request: FactoryRequest): number {
  return Math.max(0, request.request_quantity - request.delivered_quantity);
}
