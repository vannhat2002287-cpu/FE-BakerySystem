/**
 * @authors Huynh and Hue
 */

// Dashboard: Thống kê tổng quan
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/store/StoreContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { TrendingUp, ShoppingBag, AlertTriangle, JapaneseYen } from "lucide-react";
import { getDashboard, DashboardData } from "@/api/analytics";
import { getOrdersByDate } from "@/api/orders";
import { ApiError } from "@/api/client";
import toast from "react-hot-toast";
import Loading from "@/components/Loading";

// Hàm chính cho dashboard
const Dashboard: React.FC = () => {
  // Lấy dữ liệu inventory và products từ store
  const { inventory, products } = useStore();
  // Hàm chuyển trang
  const navigate = useNavigate();

  // ==== STATE QUẢN LÝ DỮ LIỆU ====
  // Dữ liệu dashboard tổng hợp từ API
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  // Trạng thái loading khi lấy dữ liệu
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Trạng thái lỗi khi lấy dữ liệu
  const [error, setError] = useState<string | null>(null);
  // Danh sách top sản phẩm bán chạy hôm nay
  const [todayPopular, setTodayPopular] = useState<
    Array<{ id: string; name: string; count: number; sales: number }>
  >([]);
  // Tổng số đơn hàng hôm nay
  const [todayOrderCount, setTodayOrderCount] = useState<number>(0);
  // Tổng doanh thu hôm nay
  const [todayDailySales, setTodayDailySales] = useState<number>(0);

  // ==== HÀM LẤY DỮ LIỆU DASHBOARD ====
  const fetchDashboardData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Bước 1: Lấy đơn hàng hôm nay để tính KPI
      try {
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
        const orders = await getOrdersByDate(today);
        console.debug("[Dashboard] today (Ho_Chi_Minh):", today);
        console.debug("[Dashboard] orders.length from getOrdersByDate:", orders.length);

        // Tính tổng số đơn và doanh thu
        const totalOrders = orders.length;
        const totalSales = orders.reduce((s, o) => s + (o.total_amount || 0), 0);

        // Tính sản phẩm bán chạy từ đơn hàng
        const counts = new Map<string, { name: string; count: number; sales: number }>();
        orders.forEach((order) => {
          order.items.forEach((it) => {
            const id = it.product_id;
            const name = it.name || (products.find((p) => p.product_id === id)?.name ?? "");
            const prev = counts.get(id) ?? { name, count: 0, sales: 0 };
            prev.count += it.quantity;
            prev.sales += it.unit_price * it.quantity;
            counts.set(id, prev);
          });
        });

        // Sắp xếp và lấy top 5
        const todayArr = Array.from(counts.entries())
          .map(([id, v]) => ({
            id,
            name: v.name || (products.find((p) => p.product_id === id)?.name ?? ""),
            count: v.count,
            sales: v.sales,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        setTodayOrderCount(totalOrders);
        setTodayDailySales(totalSales);
        setTodayPopular(todayArr);
        console.debug(
          "[Dashboard] computed today totalOrders:",
          totalOrders,
          "totalSales:",
          totalSales
        );
      } catch (e) {
        console.error("Failed to fetch today's orders for dashboard KPIs:", e);
      }

      // Bước 2: Lấy analytics cho biểu đồ
      try {
        const data = await getDashboard();
        console.debug("[Dashboard] analytics.dailySales from getDashboard():", data?.dailySales);
        setDashboardData(data);
      } catch (e) {
        console.error("Failed to fetch analytics data:", e);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      const errorMessage =
        error instanceof ApiError
          ? `ダッシュボードデータの読み込みに失敗しました: ${error.message}`
          : "サーバーに接続できません。接続を確認してください。";
      setError(errorMessage);
      toast.error(errorMessage);
      setDashboardData(null);
    } finally {
      setIsLoading(false);
    }
  }, [products]);

  // ==== EFFECT: Gọi API khi component mount ====
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // ==== LỌC SẢN PHẨM SẮP HẾT HÀNG (không tính đồ uống) ====
  const lowStockItems = inventory.filter((i) => {
    const product = products.find((p) => p.product_id === i.product_id);
    if (product && (product.type === "drink" || product.type === "alcohol")) {
      return false;
    }
    return i.current_quantity <= i.min_threshold;
  });

  // ==== BIẾN TỔNG HỢP DỮ LIỆU HIỂN THỊ ====
  // Số lượng sản phẩm sắp hết hàng
  const lowStockCount = dashboardData?.lowStockCount ?? lowStockItems.length;
  // Doanh thu hôm nay
  const dailySales = todayDailySales ?? dashboardData?.dailySales ?? 0;
  // Số đơn hàng hôm nay
  const orderCount = todayOrderCount ?? dashboardData?.orderCount ?? 0;
  // Dữ liệu doanh thu theo giờ
  const hourlyData = dashboardData?.hourlyData ?? [];

  // ==== DỮ LIỆU BIỂU ĐỒ TRÒN (eat-in vs takeaway) ====
  const typeData = useMemo(() => {
    if (dashboardData?.typeData && dashboardData.typeData.length > 0) {
      return dashboardData.typeData;
    }
    return [
      { name: "店内 (Eat-in)", value: 0 },
      { name: "持ち帰り (Takeaway)", value: 0 },
    ];
  }, [dashboardData?.typeData]);

  // ==== TOP 5 SẢN PHẨM BÁN CHẠY ====
  const popularProducts = (
    todayPopular.length > 0
      ? todayPopular
      : (dashboardData?.popularProducts ?? []).map((p) => ({ ...p, sales: 0 }))
  ).slice(0, 5);

  // ==== MÀU CHO BIỂU ĐỒ TRÒN ====
  const COLORS = ["#ea5f0c", "#fb923c"];

  // ==== RENDER GIAO DIỆN DASHBOARD ====
  return (
    // Wrapper dashboard
    <div className="h-full overflow-y-auto p-8">
      {/* Tiêu đề với ngày hiện tại */}
      <h1 className="text-2xl font-bold text-gray-800">
        ダッシュボード (本日:{" "}
        {new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Ho_Chi_Minh" })})
      </h1>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loading message="Loading dashboard data..." />
        </div>
      ) : (
        <>
          {/* Thẻ KPI: Doanh thu, Số đơn, Đơn giá TB, Cảnh báo tồn kho */}
          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Doanh thu hôm nay */}
            <div
              onClick={() => navigate("/history")}
              className="hover:border-brand-200 flex cursor-pointer items-center rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:shadow-md"
            >
              <div className="bg-brand-100 text-brand-600 mr-4 rounded-lg p-3">
                <JapaneseYen className="h-8 w-8" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">本日の売上</p>
                <p className="text-2xl font-bold text-gray-800">¥{dailySales.toLocaleString()}</p>
              </div>
            </div>

            {/* Số đơn hàng */}
            <div
              onClick={() => navigate("/history")}
              className="flex cursor-pointer items-center rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
            >
              <div className="mr-4 rounded-lg bg-blue-100 p-3 text-blue-600">
                <ShoppingBag className="h-8 w-8" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">注文件数</p>
                <p className="text-2xl font-bold text-gray-800">{orderCount} 件</p>
              </div>
            </div>

            {/* Đơn giá trung bình */}
            <div
              onClick={() => navigate("/history")}
              className="flex cursor-pointer items-center rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:border-green-200 hover:shadow-md"
            >
              <div className="mr-4 rounded-lg bg-green-100 p-3 text-green-600">
                <TrendingUp className="h-8 w-8" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">客単価</p>
                <p className="text-2xl font-bold text-gray-800">
                  ¥{orderCount > 0 ? Math.floor(dailySales / orderCount).toLocaleString() : 0}
                </p>
              </div>
            </div>

            {/* Cảnh báo tồn kho thấp */}
            <div
              onClick={() => navigate("/inventory")}
              className="flex cursor-pointer items-center rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:border-red-200 hover:shadow-md"
            >
              <div className="mr-4 rounded-lg bg-red-100 p-3 text-red-600">
                <AlertTriangle className="h-8 w-8" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">在庫アラート</p>
                <p className="text-2xl font-bold text-gray-800">{lowStockCount} 商品</p>
              </div>
            </div>
          </div>

          {/* Biểu đồ */}
          <div className="mb-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Biểu đồ cột: Doanh thu theo giờ */}
            <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm lg:col-span-2">
              <h3 className="mb-4 font-bold text-gray-700">時間別売上推移 (24時間)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="name"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      interval={2}
                    />
                    <YAxis
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `¥${value}`}
                    />
                    <Tooltip
                      formatter={(value: number) => [`¥${value.toLocaleString()}`, "売上"]}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                      }}
                    />
                    <Bar dataKey="sales" fill="#ea5f0c" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Biểu đồ tròn: Tỷ lệ eat-in vs takeaway */}
            <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-bold text-gray-700">売上構成比</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      animationBegin={0}
                      animationDuration={600}
                    >
                      {typeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `¥${value.toLocaleString()}`} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Bảng xếp hạng sản phẩm bán chạy */}
          <div
            onClick={() => navigate("/")}
            className="hover:border-brand-200 mb-8 cursor-pointer overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md"
          >
            <div className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
              <h3 className="text-lg font-bold text-gray-700">人気商品ランキング</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50/50 text-xs font-semibold text-gray-400">
                  <tr>
                    <th className="px-6 py-3">順位</th>
                    <th className="px-6 py-3">商品名</th>
                    <th className="px-6 py-3 text-right">販売数</th>
                    <th className="px-6 py-3 text-right">売上金額</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {popularProducts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                        データがありません
                      </td>
                    </tr>
                  ) : (
                    popularProducts.map((item, index) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-400">#{index + 1}</td>
                        <td className="px-6 py-4 text-base font-bold text-gray-800">{item.name}</td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-brand-600 text-lg font-bold">{item.count}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-gray-800">
                          ¥{(item.sales ?? 0).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
