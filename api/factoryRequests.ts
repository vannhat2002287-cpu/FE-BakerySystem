import { apiRequest } from "./client";
import { buildApiUrl, API_ENDPOINTS } from "./config";

// Trạng thái yêu cầu: PENDING | DELIVERED | CANCELLED
type FactoryRequestStatus = "PENDING" | "DELIVERED" | "CANCELLED";

// DTO request tạo yêu cầu
interface FactoryRequestDTO {
  productId: number;
  requestQuantity: number;
  etaAt: string;
  note?: string;
}

// DTO response từ Backend
interface FactoryRequestResponseDTO {
  request_id: number;
  product_id: number;
  product_name: string;
  request_quantity: number;
  created_at: string;
  eta_at: string;
  note?: string;
  status: FactoryRequestStatus;
}

// Interface cho Frontend
export interface FactoryRequest {
  request_id: string;
  product_id: string;
  product_name: string;
  request_quantity: number;
  created_at: string;
  eta_at: string;
  note?: string;
  status: FactoryRequestStatus;
}

// Chuyển DTO sang format Frontend
function mapFactoryRequestDTOToFactoryRequest(dto: FactoryRequestResponseDTO): FactoryRequest {
  return {
    request_id: String(dto.request_id),
    product_id: String(dto.product_id),
    product_name: dto.product_name,
    request_quantity: dto.request_quantity,
    created_at: dto.created_at,
    eta_at: dto.eta_at,
    note: dto.note,
    status: dto.status,
  };
}

// Chuyển dữ liệu FE sang DTO
function mapFactoryRequestToDTO(
  productId: string,
  requestQuantity: number,
  etaAt: string,
  note?: string
): FactoryRequestDTO {
  return {
    productId: Number.parseInt(productId),
    requestQuantity,
    etaAt: etaAt,
    note: note?.trim() || undefined,
  };
}

// Lấy tất cả yêu cầu đặt hàng
export async function getAllFactoryRequests(): Promise<FactoryRequest[]> {
  const url = buildApiUrl(API_ENDPOINTS.FACTORY_REQUESTS);
  const data = await apiRequest<FactoryRequestResponseDTO[]>(url);

  return data.map(mapFactoryRequestDTOToFactoryRequest);
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
