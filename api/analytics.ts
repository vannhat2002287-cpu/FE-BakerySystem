import { apiRequest } from "./client";
import { buildApiUrl, API_ENDPOINTS } from "./config";
import { getOrdersByDate } from "./orders";

interface PopularProductDTO {
  product_id: number;
  name: string;
  sold_quantity: number;
}

interface DashboardResponseDTO {
  daily_sales: number;
  order_count: number;
  low_stock_count: number;
  hourly_sales: number[];
  popular_products: PopularProductDTO[];
}

export interface DashboardData {
  dailySales: number;
  orderCount: number;
  lowStockCount: number;
  hourlyData: Array<{ hour: number; sales: number; name: string }>;
  typeData: Array<{ name: string; value: number }>;
  popularProducts: Array<{ id: string; name: string; count: number }>;
}

function mapDashboardDTOToDashboardData(
  dto: DashboardResponseDTO,
  eatInSales: number,
  takeawaySales: number
): DashboardData {
  return {
    dailySales: dto.daily_sales,
    orderCount: dto.order_count,
    lowStockCount: dto.low_stock_count,
    hourlyData: dto.hourly_sales.map((sales, hour) => ({
      hour,
      sales,
      name: `${hour}:00`,
    })),
    typeData: [
      { name: "店内 (Eat-in)", value: eatInSales },
      { name: "持ち帰り (Takeaway)", value: takeawaySales },
    ],
    popularProducts: dto.popular_products.map((product) => ({
      id: String(product.product_id),
      name: product.name,
      count: product.sold_quantity,
    })),
  };
}

export async function getDashboard(): Promise<DashboardData> {
  const url = buildApiUrl(`${API_ENDPOINTS.ANALYTICS}/dashboard`);
  const analyticsData = await apiRequest<DashboardResponseDTO>(url);

  // TODO: xóa logic tính eatInSales, takeawaySales thủ công này nếu BE trả về từ api rồi
  let eatInSales = 0;
  let takeawaySales = 0;

  try {
    const today = new Date().toISOString().split("T")[0];
    const todaysOrders = await getOrdersByDate(today);

    todaysOrders.forEach((order) => {
      if (order.order_type === "eat-in") {
        eatInSales += order.total_amount;
      } else {
        takeawaySales += order.total_amount;
      }
    });
  } catch (error) {
    console.error("Failed to fetch orders for type breakdown:", error);
  }

  return mapDashboardDTOToDashboardData(
    analyticsData,
    eatInSales,
    takeawaySales
  );
}
