/**
 * @authors Huynh and Hue
 */

import { apiRequest } from "./client";
import { buildApiUrl, API_ENDPOINTS } from "./config";
import { Inventory, InventoryExtended } from "../types";

// DTO từ Backend
interface InventoryDTO {
  product_id: number;
  current_quantity: number;
  min_threshold: number;
  last_updated: string;
}

// DTO mở rộng từ Backend (cho module tự động đặt hàng)
interface InventoryExtendedDTO extends InventoryDTO {
  business_date?: string;
  start_of_day_quantity?: number;
  reorder_point?: number;
  average_daily_sales?: number;
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

// Chuyển DTO mở rộng sang format Frontend
function mapInventoryExtendedDTOToInventoryExtended(dto: InventoryExtendedDTO): InventoryExtended {
  const today = new Date().toISOString().split("T")[0];
  return {
    product_id: String(dto.product_id),
    current_quantity: dto.current_quantity,
    min_threshold: dto.min_threshold,
    last_updated: dto.last_updated,
    business_date: dto.business_date || today,
    start_of_day_quantity: dto.start_of_day_quantity ?? 20,
    reorder_point: dto.reorder_point ?? dto.min_threshold ?? 5,
    average_daily_sales: dto.average_daily_sales ?? 0,
  };
}

// Lấy danh sách tồn kho
export async function getAllInventory(): Promise<Inventory[]> {
  const url = buildApiUrl(API_ENDPOINTS.INVENTORY);
  const data = await apiRequest<InventoryDTO[]>(url);

  return data.map(mapInventoryDTOToInventory);
}

// Lấy danh sách tồn kho mở rộng (cho module tự động đặt hàng)
export async function getAllInventoryExtended(): Promise<InventoryExtended[]> {
  const url = buildApiUrl(API_ENDPOINTS.INVENTORY);
  const data = await apiRequest<InventoryExtendedDTO[]>(url);

  return data.map(mapInventoryExtendedDTOToInventoryExtended);
}

// Cập nhật số lượng tồn kho
export async function adjustInventory(
  productId: string,
  currentQuantity: number
): Promise<Inventory> {
  const url = buildApiUrl(`${API_ENDPOINTS.INVENTORY}/${productId}`, {
    currentQuantity: currentQuantity.toString(),
  });

  const data = await apiRequest<InventoryDTO>(url, {
    method: "PATCH",
  });

  return mapInventoryDTOToInventory(data);
}

// ============================================
// MODULE MỞ RỘNG: RESET KHO HÀNG NGÀY
// ============================================

// Reset tồn kho đầu ngày (tất cả sản phẩm về 20)
// Nếu Backend chưa có API này, sẽ gọi adjustInventory cho từng sản phẩm
export async function resetDailyInventory(
  productIds: string[],
  defaultQuantity: number = 20
): Promise<{ success: boolean; updated: number; errors: string[] }> {
  const errors: string[] = [];
  let updated = 0;

  // ọi API bulk reset nếu Backend hỗ trợ
  try {
    const url = buildApiUrl(`${API_ENDPOINTS.INVENTORY}/reset-daily`);
    await apiRequest(url, {
      method: "POST",
      body: JSON.stringify({
        product_ids: productIds.map((id) => parseInt(id)),
        default_quantity: defaultQuantity,
        business_date: new Date().toISOString().split("T")[0],
      }),
    });
    return { success: true, updated: productIds.length, errors: [] };
  } catch {
    // Fallback: Reset từng sản phẩm
    console.log("Bulk reset not available, falling back to individual updates...");
  }

  // Fallback: Gọi adjustInventory cho từng sản phẩm
  for (const productId of productIds) {
    try {
      await adjustInventory(productId, defaultQuantity);
      updated++;
    } catch (error) {
      errors.push(`Failed to reset product ${productId}: ${error}`);
    }
  }

  return {
    success: errors.length === 0,
    updated,
    errors,
  };
}

// Lấy ngày kinh doanh hiện tại từ localStorage hoặc mặc định là hôm nay
export function getCurrentBusinessDate(): string {
  const stored = localStorage.getItem("bakery_business_date");
  const today = new Date().toISOString().split("T")[0];

  if (stored) {
    return stored;
  }
  return today;
}

// Lưu ngày kinh doanh
export function setCurrentBusinessDate(date: string): void {
  localStorage.setItem("bakery_business_date", date);
}

// Kiểm tra xem đã reset kho cho ngày hôm nay chưa
export function hasResetTodayInventory(): boolean {
  const lastReset = localStorage.getItem("bakery_last_inventory_reset");
  const today = new Date().toISOString().split("T")[0];
  return lastReset === today;
}

// Đánh dấu đã reset kho cho ngày hôm nay
export function markInventoryResetDone(): void {
  const today = new Date().toISOString().split("T")[0];
  localStorage.setItem("bakery_last_inventory_reset", today);
  setCurrentBusinessDate(today);
}
