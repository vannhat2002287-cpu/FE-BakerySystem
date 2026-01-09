import { apiRequest } from "./client";
import { buildApiUrl, API_ENDPOINTS } from "./config";
import { Inventory } from "../types";

// DTO từ Backend
interface InventoryDTO {
  product_id: number;
  current_quantity: number;
  min_threshold: number;
  last_updated: string;
}

// Chuyển DTO sang format Frontend
function mapInventoryDTOToInventory(dto: InventoryDTO): Inventory {
  return {
    product_id: String(dto.product_id),
    current_quantity: dto.current_quantity,
    min_threshold: dto.min_threshold,
    last_updated: dto.last_updated,
  };
}

// Lấy danh sách tồn kho
export async function getAllInventory(): Promise<Inventory[]> {
  const url = buildApiUrl(API_ENDPOINTS.INVENTORY);
  const data = await apiRequest<InventoryDTO[]>(url);

  return data.map(mapInventoryDTOToInventory);
}

// Cập nhật số lượng tồn kho
export async function adjustInventory(
  productId: string,
  currentQuantity: number
): Promise<Inventory> {
  const url = buildApiUrl(`${API_ENDPOINTS.INVENTORY}/${productId}`, {
    currentQuantity: currentQuantity.toString(),
    tram: "acsa",
  });

  const data = await apiRequest<InventoryDTO>(url, {
    method: "PATCH",
  });

  return mapInventoryDTOToInventory(data);
}
