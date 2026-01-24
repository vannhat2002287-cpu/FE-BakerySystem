/**
 * @authors Huynh and Hue
 * MODULE: TỰ ĐỘNG ĐẶT HÀNG (AUTO ORDERING)
 *
 * Logic:
 * - Trigger: Chỉ chạy kiểm tra vào 2 khung giờ: 12:00 và 17:00
 * - Condition A: Current Stock < Reorder Point
 * - Condition B: Không có đơn PENDING/PARTIAL cho sản phẩm đó
 * - Ngoại lệ: Bỏ qua drinks
 */

import { Product, Inventory, AutoOrderCheckResult } from "../types";
import {
  FactoryRequest,
  getActiveFactoryRequestsToday,
  createFactoryRequest,
} from "../api/factoryRequests";
import { getCurrentBusinessDate } from "../api/inventory";

// Cấu hình mặc định
export const AUTO_ORDER_CONFIG = {
  CHECK_HOURS: [12, 17], // Giờ kiểm tra tự động
  DEFAULT_START_QUANTITY: 20, // Số lượng đầu ngày
  MIN_ORDER_QUANTITY: 1, // [FIX] Đổi từ 10 thành 1 để không tự động cộng 10
  DEFAULT_REORDER_POINT: 5, // Điểm đặt hàng lại mặc định
  DEFAULT_ETA_MINUTES: 5, // Thời gian giao hàng dự kiến (phút)
  EXCLUDED_TYPES: ["drink", "alcohol"] as const, // Loại sản phẩm không đặt tự động
};

// Kiểm tra có phải giờ đặt hàng tự động không
export function isAutoOrderTime(currentHour: number): boolean {
  return AUTO_ORDER_CONFIG.CHECK_HOURS.includes(currentHour);
}

// Kiểm tra sản phẩm có nên bỏ qua không (drinks, alcohol)
export function shouldSkipProduct(product: Product): boolean {
  return AUTO_ORDER_CONFIG.EXCLUDED_TYPES.includes(product.type as any);
}

// Tính số lượng đã bán trong ngày
// Sold Today = Start of Day Quantity - Current Stock
export function calculateSoldToday(
  currentStock: number,
  startOfDayQuantity: number = AUTO_ORDER_CONFIG.DEFAULT_START_QUANTITY
): number {
  return Math.max(0, startOfDayQuantity - currentStock);
}

// Tính số lượng cần đặt
// Gap = Doanh số trung bình hàng ngày - Đã bán hôm nay
// Nếu Gap nhỏ hơn số lượng đặt tối thiểu, sẽ đặt bằng số lượng tối thiểu.
export function calculateOrderQuantity(averageDailySales: number, soldToday: number): number {
  const gap = averageDailySales - soldToday;

  // [FIX] Logic được làm rõ:
  // 1. Tính toán số lượng cần bù (gap).
  // 2. So sánh với số lượng đặt tối thiểu (hiện là 1).
  // 3. Luôn lấy số lớn hơn để đảm bảo không đặt hàng lắt nhắt dưới mức tối thiểu.
  const quantityToOrder = Math.max(AUTO_ORDER_CONFIG.MIN_ORDER_QUANTITY, gap);

  return Math.ceil(quantityToOrder); // Làm tròn lên số nguyên gần nhất
}

// Kiểm tra một sản phẩm có cần đặt hàng không
export function checkProductNeedsOrder(
  product: Product,
  inventory: Inventory,
  activeRequests: FactoryRequest[],
  averageDailySales: number = 0, // [FIX] Mặc định là 0 thay vì 10
  startOfDayQuantity: number = AUTO_ORDER_CONFIG.DEFAULT_START_QUANTITY
): AutoOrderCheckResult {
  const result: AutoOrderCheckResult = {
    product_id: product.product_id,
    product_name: product.name,
    current_stock: inventory.current_quantity,
    reorder_point: inventory.min_threshold || AUTO_ORDER_CONFIG.DEFAULT_REORDER_POINT,
    should_order: false,
    suggested_quantity: 0,
  };

  // Check 1: Bỏ qua drinks/alcohol
  if (shouldSkipProduct(product)) {
    result.skip_reason = "飲み物・アルコールは自動発注対象外";
    return result;
  }

  // Check 2: Stock > Reorder Point => không cần đặt
  if (inventory.current_quantity > result.reorder_point) {
    result.skip_reason = "在庫が基準値以上";
    return result;
  }

  // Check 3: Đã có đơn PENDING/PARTIAL cho sản phẩm này
  const hasPendingRequest = activeRequests.some((req) => req.product_id === product.product_id);
  if (hasPendingRequest) {
    result.skip_reason = "既に発注中の依頼があります";
    return result;
  }

  // Tính số lượng cần đặt
  const soldToday = calculateSoldToday(inventory.current_quantity, startOfDayQuantity);
  const orderQuantity = calculateOrderQuantity(averageDailySales, soldToday);

  result.should_order = true;
  result.suggested_quantity = orderQuantity;

  return result;
}

// Kiểm tra tất cả sản phẩm và trả về danh sách cần đặt
export async function checkAllProductsForAutoOrder(
  products: Product[],
  inventoryList: Inventory[],
  averageDailySalesMap: Map<string, number> = new Map(), // product_id => avg sales
  startOfDayQuantity: number = AUTO_ORDER_CONFIG.DEFAULT_START_QUANTITY
): Promise<AutoOrderCheckResult[]> {
  // Lấy danh sách requests đang active của ngày hôm nay
  let activeRequests: FactoryRequest[] = [];
  try {
    activeRequests = await getActiveFactoryRequestsToday();
  } catch (error) {
    console.error("Failed to get active requests:", error);
  }

  const results: AutoOrderCheckResult[] = [];

  for (const product of products) {
    const inventory = inventoryList.find((inv) => inv.product_id === product.product_id);

    if (!inventory) {
      // Sản phẩm không có trong inventory (có thể là drink)
      continue;
    }

    const avgSales = averageDailySalesMap.get(product.product_id) || 0; // [FIX] Mặc định là 0

    const result = checkProductNeedsOrder(
      product,
      inventory,
      activeRequests,
      avgSales,
      startOfDayQuantity
    );

    results.push(result);
  }

  return results;
}

// Lấy danh sách sản phẩm cần đặt hàng
export async function getProductsNeedingOrder(
  products: Product[],
  inventoryList: Inventory[],
  averageDailySalesMap: Map<string, number> = new Map()
): Promise<AutoOrderCheckResult[]> {
  const allResults = await checkAllProductsForAutoOrder(
    products,
    inventoryList,
    averageDailySalesMap
  );

  return allResults.filter((r) => r.should_order);
}

// Tạo ETA time (current time + minutes)
export function createEtaTime(
  minutesFromNow: number = AUTO_ORDER_CONFIG.DEFAULT_ETA_MINUTES
): string {
  const eta = new Date();
  eta.setMinutes(eta.getMinutes() + minutesFromNow);

  const year = eta.getFullYear();
  const month = String(eta.getMonth() + 1).padStart(2, "0");
  const day = String(eta.getDate()).padStart(2, "0");
  const hours = String(eta.getHours()).padStart(2, "0");
  const minutes = String(eta.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:00`;
}

// Thực hiện auto-order cho một sản phẩm
export async function executeAutoOrder(
  productId: string,
  quantity: number,
  note?: string
): Promise<FactoryRequest> {
  const etaAt = createEtaTime();
  const autoNote = note || `自動発注 (${new Date().toLocaleTimeString("ja-JP")})`;

  return createFactoryRequest(productId, quantity, etaAt, autoNote);
}

// Thực hiện auto-order cho tất cả sản phẩm cần đặt
export async function executeAutoOrderForAll(
  productsNeedingOrder: AutoOrderCheckResult[]
): Promise<{
  success: FactoryRequest[];
  failed: Array<{ product_id: string; error: string }>;
}> {
  const success: FactoryRequest[] = [];
  const failed: Array<{ product_id: string; error: string }> = [];

  for (const item of productsNeedingOrder) {
    try {
      const request = await executeAutoOrder(
        item.product_id,
        item.suggested_quantity,
        `自動発注: ${item.product_name}`
      );
      success.push(request);
    } catch (error) {
      failed.push({
        product_id: item.product_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { success, failed };
}

// Format giờ hiển thị cho UI
export function formatAutoOrderSchedule(): string {
  return AUTO_ORDER_CONFIG.CHECK_HOURS.map((h) => `${h}:00`).join(" / ");
}

// Kiểm tra và hiển thị thời gian đến lần check tiếp theo
export function getNextAutoOrderCheck(currentHour: number): { hour: number; isNow: boolean } {
  const checkHours = AUTO_ORDER_CONFIG.CHECK_HOURS.sort((a, b) => a - b);

  // Tìm giờ check tiếp theo
  for (const hour of checkHours) {
    if (currentHour < hour) {
      return { hour, isNow: false };
    }
    if (currentHour === hour) {
      return { hour, isNow: true };
    }
  }

  // Nếu đã qua tất cả giờ check trong ngày, trả về giờ đầu tiên của ngày mai
  return { hour: checkHours[0], isNow: false };
}
