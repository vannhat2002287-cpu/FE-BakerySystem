/**
 * @authors Huynh and Hue
 * @optimized_by Gemini (UI/UX)
 */

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
import {
  TrendingUp,
  ShoppingBag,
  AlertTriangle,
  JapaneseYen,
  Clock,
  ArrowRight,
  LayoutDashboard,
} from "lucide-react";
import { getDashboard, DashboardData } from "@/api/analytics";
import { getOrdersByDate } from "@/api/orders";
import { ApiError } from "@/api/client";
import toast from "react-hot-toast";
import Loading from "@/components/Loading";

// Component chính
const Dashboard: React.FC = () => {
  const { inventory, products } = useStore();
  const navigate = useNavigate();

  // State & Logic (Giữ nguyên)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [todayPopular, setTodayPopular] = useState<
    Array<{ id: string; name: string; count: number; sales: number }>
  >([]);
  const [todayOrderCount, setTodayOrderCount] = useState<number>(0);
  const [todayDailySales, setTodayDailySales] = useState<number>(0);

  const fetchDashboardData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Logic: Lấy đơn hàng hôm nay
      try {
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
        const orders = await getOrdersByDate(today);
        const totalOrders = orders.length;
        const totalSales = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
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
      } catch (e) {
        console.error("Failed to fetch today's orders:", e);
      }
      // Logic: Lấy analytics
      try {
        const data = await getDashboard();
        setDashboardData(data);
      } catch (e) {
        console.error("Failed to fetch analytics:", e);
      }
    } catch (error) {
      const errorMessage =
        error instanceof ApiError ? `Error: ${error.message}` : "Connection failed.";
      setError(errorMessage);
      toast.error(errorMessage);
      setDashboardData(null);
    } finally {
      setIsLoading(false);
    }
  }, [products]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const lowStockItems = inventory.filter((i) => {
    const product = products.find((p) => p.product_id === i.product_id);
    if (product && (product.type === "drink" || product.type === "alcohol")) {
      return false;
    }
    return i.current_quantity <= i.min_threshold;
  });

  const lowStockCount = dashboardData?.lowStockCount ?? lowStockItems.length;
  const dailySales = todayDailySales ?? dashboardData?.dailySales ?? 0;
  const orderCount = todayOrderCount ?? dashboardData?.orderCount ?? 0;
  const hourlyData = dashboardData?.hourlyData ?? [];
  const typeData = useMemo(() => {
    if (dashboardData?.typeData && dashboardData.typeData.length > 0) {
      return dashboardData.typeData;
    }
    return [
      { name: "店内 (Eat-in)", value: 0 },
      { name: "持ち帰り (Takeaway)", value: 0 },
    ];
  }, [dashboardData?.typeData]);
  const popularProducts = (
    todayPopular.length > 0
      ? todayPopular
      : (dashboardData?.popularProducts ?? []).map((p) => ({ ...p, sales: 0 }))
  ).slice(0, 5);
  const COLORS = ["#ea5f0c", "#3b82f6"]; // Orange and Blue

  return (
    <div className="h-full overflow-y-auto bg-slate-50/50 p-6 font-sans text-slate-800">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-orange-100 p-2">
              <LayoutDashboard className="h-6 w-6 text-orange-600" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-800">ダッシュボード</h1>
          </div>
          <p className="mt-2 pl-1 text-sm font-medium text-slate-500">
            本日の店舗状況の概要 ({" "}
            {new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Ho_Chi_Minh" })} )
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-96 items-center justify-center">
          <Loading message="データを分析中..." />
        </div>
      ) : (
        <div className="space-y-8">
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Sales Card */}
            <div
              onClick={() => navigate("/history")}
              className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                    本日の売上
                  </p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-slate-800 transition-colors group-hover:text-orange-600">
                    ¥{dailySales.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-2xl bg-orange-50 p-3 text-orange-600 transition-colors group-hover:bg-orange-100">
                  <JapaneseYen className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-xs font-bold text-orange-600 opacity-0 transition-opacity group-hover:opacity-100">
                詳細を見る <ArrowRight className="ml-1 h-3 w-3" />
              </div>
            </div>

            {/* Orders Card */}
            <div
              onClick={() => navigate("/history")}
              className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                    注文件数
                  </p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-slate-800 transition-colors group-hover:text-blue-600">
                    {orderCount} <span className="text-lg font-bold text-slate-400">件</span>
                  </p>
                </div>
                <div className="rounded-2xl bg-blue-50 p-3 text-blue-600 transition-colors group-hover:bg-blue-100">
                  <ShoppingBag className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-xs font-bold text-blue-600 opacity-0 transition-opacity group-hover:opacity-100">
                履歴を確認 <ArrowRight className="ml-1 h-3 w-3" />
              </div>
            </div>

            {/* Average Price Card */}
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                    平均客単価
                  </p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-slate-800">
                    ¥{orderCount > 0 ? Math.floor(dailySales / orderCount).toLocaleString() : 0}
                  </p>
                </div>
                <div className="rounded-2xl bg-green-50 p-3 text-green-600">
                  <TrendingUp className="h-6 w-6" />
                </div>
              </div>
            </div>

            {/* Stock Alert Card */}
            <div
              onClick={() => navigate("/inventory")}
              className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                    在庫アラート
                  </p>
                  <p
                    className={`mt-2 text-3xl font-black tracking-tight ${lowStockCount > 0 ? "text-red-600" : "text-slate-800"}`}
                  >
                    {lowStockCount} <span className="text-lg font-bold text-slate-400">商品</span>
                  </p>
                </div>
                <div
                  className={`rounded-2xl p-3 ${lowStockCount > 0 ? "animate-pulse bg-red-50 text-red-600" : "bg-slate-50 text-slate-400"}`}
                >
                  <AlertTriangle className="h-6 w-6" />
                </div>
              </div>
              {lowStockCount > 0 && (
                <div className="mt-4 flex items-center text-xs font-bold text-red-600 opacity-0 transition-opacity group-hover:opacity-100">
                  在庫を確認 <ArrowRight className="ml-1 h-3 w-3" />
                </div>
              )}
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Bar Chart */}
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-2">
              <div className="mb-6 flex items-center gap-2">
                <div className="rounded-lg bg-orange-50 p-1.5">
                  <Clock className="h-4 w-4 text-orange-500" />
                </div>
                <h3 className="font-bold text-slate-700">時間別売上推移</h3>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#94a3b8" }}
                      dy={10}
                    />
                    <YAxis
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `¥${value}`}
                      tick={{ fill: "#94a3b8" }}
                    />
                    <Tooltip
                      cursor={{ fill: "#f8fafc" }}
                      formatter={(value: number) => [`¥${value.toLocaleString()}`, "売上"]}
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                        padding: "12px",
                        fontWeight: "bold",
                        color: "#1e293b",
                      }}
                    />
                    <Bar dataKey="sales" fill="#ea5f0c" radius={[6, 6, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pie Chart */}
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center gap-2">
                <div className="rounded-lg bg-blue-50 p-1.5">
                  <ShoppingBag className="h-4 w-4 text-blue-500" />
                </div>
                <h3 className="font-bold text-slate-700">売上構成比</h3>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      cornerRadius={6}
                    >
                      {typeData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                          strokeWidth={0}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => `¥${value.toLocaleString()}`}
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                        fontWeight: "bold",
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                      formatter={(value) => (
                        <span className="ml-1 text-xs font-bold text-slate-600">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Ranking Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-white px-6 py-5">
              <div className="rounded-lg bg-yellow-50 p-1.5">
                <TrendingUp className="h-4 w-4 text-yellow-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">本日の人気商品 TOP 5</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-bold tracking-wider text-slate-400 uppercase">
                  <tr>
                    <th className="w-20 px-6 py-4 text-center">順位</th>
                    <th className="px-6 py-4">商品名</th>
                    <th className="px-6 py-4 text-right">販売数</th>
                    <th className="px-6 py-4 text-right">売上金額</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {popularProducts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                        <ShoppingBag className="mx-auto mb-2 h-8 w-8 opacity-20" />
                        まだデータがありません
                      </td>
                    </tr>
                  ) : (
                    popularProducts.map((item, index) => (
                      <tr key={item.id} className="transition-colors hover:bg-slate-50/80">
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-black shadow-sm ${
                              index === 0
                                ? "bg-yellow-400 text-yellow-900 ring-4 ring-yellow-100"
                                : index === 1
                                  ? "bg-slate-300 text-slate-800"
                                  : index === 2
                                    ? "bg-orange-200 text-orange-800"
                                    : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-base font-bold text-slate-800">{item.name}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-mono text-lg font-bold text-slate-600">
                            {item.count}
                          </span>
                          <span className="ml-1 text-xs text-slate-400">個</span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-slate-800">
                          ¥{(item.sales ?? 0).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
