/**
 * @authors Huynh and Hue
 */

// Trang lịch sử đơn hàng và phân tích doanh thu
import React, { useState, useMemo, useEffect } from "react";
import { ChevronDown, ChevronUp, FileText, Printer, Calendar } from "lucide-react";
import { getOrdersByDate } from "@/api/orders";
import { Order } from "@/types";
import { ApiError } from "@/api/client";
import Loading from "@/components/Loading";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

// Múi giờ server (Việt Nam)
const SERVER_ZONE = "Asia/Ho_Chi_Minh";

const HistoryPage: React.FC = () => {
  // State quản lý
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // Mặc định là ngày hôm nay theo múi giờ VN
    return dayjs().tz(SERVER_ZONE).format("YYYY-MM-DD");
  });
  const [activeTab, setActiveTab] = useState<"daily" | "product">("daily");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  // Filter theo loại đơn hàng: all, eat-in, takeaway
  const [orderTypeFilter, setOrderTypeFilter] = useState<"all" | "eat-in" | "takeaway">("all");

  // TAB 1: Tổng hợp đơn hàng theo ngày
  const dailySummary = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        total: number;
        eatIn: number;
        takeaway: number;
        count: number;
        orders: any[];
      }
    >();

    // Lọc đơn hàng theo loại nếu có filter
    const filteredOrders =
      orderTypeFilter === "all"
        ? orders
        : orders.filter((order) => order.order_type === orderTypeFilter);

    // Nhóm đơn hàng theo ngày
    filteredOrders.forEach((order) => {
      const dateStr = dayjs.tz(order.order_time, SERVER_ZONE).format("YYYY-MM-DD");

      if (!map.has(dateStr)) {
        map.set(dateStr, {
          date: dateStr,
          total: 0,
          eatIn: 0,
          takeaway: 0,
          count: 0,
          orders: [],
        });
      }
      const entry = map.get(dateStr)!;
      entry.total += order.total_amount;
      entry.count += 1;
      entry.orders.push(order);
      // Phân loại doanh thu theo loại đơn
      if (order.order_type === "eat-in") entry.eatIn += order.total_amount;
      else entry.takeaway += order.total_amount;
    });

    // Sắp xếp theo ngày giảm dần (mới nhất trước)
    return Array.from(map.values()).sort((a, b) => {
      const dateA = new Date(a.date.replace(/\//g, "-"));
      const dateB = new Date(b.date.replace(/\//g, "-"));
      return dateB.getTime() - dateA.getTime();
    });
  }, [orders, orderTypeFilter]);

  // TAB 2: Phân tích sản phẩm (thống kê số lượng và doanh thu theo sản phẩm)
  const productAnalysis = useMemo(() => {
    const map = new Map<string, { id: string; name: string; qty: number; sales: number }>();
    orders.forEach((order) => {
      order.items.forEach((item) => {
        if (!map.has(item.product_id)) {
          map.set(item.product_id, {
            id: item.product_id,
            name: item.name,
            qty: 0,
            sales: 0,
          });
        }
        const entry = map.get(item.product_id)!;
        entry.qty += item.quantity;
        entry.sales += item.unit_price * item.quantity;
      });
    });
    // Sắp xếp theo doanh thu giảm dần
    return Array.from(map.values()).sort((a, b) => b.sales - a.sales);
  }, [orders]);

  // Gọi API lấy đơn hàng khi đổi ngày
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setIsLoading(true);
        const ordersData = await getOrdersByDate(selectedDate);
        // Lọc chỉ giữ đơn đúng ngày đã chọn (theo múi giờ VN)
        const toDateKey = (iso: string) => dayjs.tz(iso, SERVER_ZONE).format("YYYY-MM-DD");
        const filtered = ordersData.filter((o) => toDateKey(o.order_time) === selectedDate);
        setOrders(filtered);
      } catch (error) {
        console.error("Failed to fetch orders:", error);
        if (error instanceof ApiError) {
          console.error("API Error:", error.status, error.response);
        }
        setOrders([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [selectedDate]);

  // Toggle mở rộng/thu gọn chi tiết đơn hàng
  const toggleOrderExpand = (id: string) => {
    setExpandedOrderId(expandedOrderId === id ? null : id);
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-8">
      {/* Header: Tiêu đề + chọn ngày */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">注文履歴・売上分析</h1>
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-gray-500" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="focus:ring-brand-500 rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-transparent focus:ring-2"
          />
        </div>
      </div>

      {/* Tabs: Báo cáo ngày / Phân tích sản phẩm */}
      <div className="mb-6 flex space-x-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("daily")}
          className={`rounded-t-lg px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === "daily"
              ? "text-brand-600 border-t border-r border-l border-gray-200 bg-white"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          }`}
        >
          日次レポート
        </button>
        <button
          onClick={() => setActiveTab("product")}
          className={`rounded-t-lg px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === "product"
              ? "text-brand-600 border-t border-r border-l border-gray-200 bg-white"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          }`}
        >
          商品分析
        </button>
      </div>

      {/* TAB 1: Báo cáo theo ngày */}
      {activeTab === "daily" && (
        <div className="space-y-6">
          {/* Sub-tabs: Lọc theo loại đơn hàng */}
          <div className="flex items-center gap-2">
            <span className="mr-2 text-sm text-gray-500">注文種類:</span>
            <button
              onClick={() => setOrderTypeFilter("all")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                orderTypeFilter === "all"
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              すべて
            </button>
            <button
              onClick={() => setOrderTypeFilter("eat-in")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                orderTypeFilter === "eat-in"
                  ? "bg-blue-600 text-white"
                  : "border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
              }`}
            >
              店内
            </button>
            <button
              onClick={() => setOrderTypeFilter("takeaway")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                orderTypeFilter === "takeaway"
                  ? "bg-orange-600 text-white"
                  : "border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
              }`}
            >
              持ち帰り
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loading message="Loading orders..." />
            </div>
          ) : dailySummary.length === 0 ? (
            // Trạng thái trống
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
              <FileText className="mx-auto mb-4 h-16 w-16 text-gray-300" />
              <p className="text-lg text-gray-500">No orders found for selected date</p>
              <p className="mt-2 text-sm text-gray-400">Select a different date to view orders</p>
            </div>
          ) : (
            // Danh sách đơn hàng theo ngày
            dailySummary.map((day) => (
              <div
                key={day.date}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                {/* Header tổng hợp ngày */}
                <div className="flex flex-wrap items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4">
                  <div>
                    <h3 className="flex items-center text-lg font-bold text-gray-800">
                      <FileText className="text-brand-500 mr-2 h-5 w-5" />
                      {day.date}
                    </h3>
                    <span className="ml-7 text-sm text-gray-500">{day.count} 件の注文</span>
                  </div>
                  {/* Tổng doanh thu theo loại */}
                  <div className="flex space-x-6 text-right">
                    <div>
                      <p className="text-xs text-gray-500">店内</p>
                      <p className="font-medium text-gray-700">¥{day.eatIn.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">持ち帰り</p>
                      <p className="font-medium text-gray-700">¥{day.takeaway.toLocaleString()}</p>
                    </div>
                    <div className="border-l border-gray-300 pl-6">
                      <p className="text-xs font-bold text-gray-500">総売上</p>
                      <p className="text-brand-600 text-xl font-bold">
                        ¥{day.total.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Danh sách từng đơn hàng */}
                <div className="divide-y divide-gray-100">
                  {day.orders.map((order: any, orderIndex: number) => (
                    <div key={order.order_id}>
                      {/* Row đơn hàng (click để mở rộng) */}
                      <div
                        onClick={() => toggleOrderExpand(order.order_id)}
                        className="flex cursor-pointer items-center justify-between px-6 py-3 hover:bg-gray-50"
                      >
                        <div className="flex items-center space-x-4">
                          <span className="font-mono text-sm text-gray-400">
                            {dayjs.tz(order.order_time, SERVER_ZONE).format("HH:mm")}
                          </span>
                          {/* Badge loại đơn */}
                          <span
                            className={`rounded border px-2 py-0.5 text-xs ${
                              order.order_type === "eat-in"
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-orange-200 bg-orange-50 text-orange-700"
                            }`}
                          >
                            {order.order_type === "eat-in" ? "店内" : "持帰"}
                          </span>
                          <span className="text-sm font-medium text-gray-700">
                            #{orderIndex + 1}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className="font-bold text-gray-800">
                            ¥{order.total_amount.toLocaleString()}
                          </span>
                          {expandedOrderId === order.order_id ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </div>

                      {/* Chi tiết đơn hàng (khi mở rộng) */}
                      {expandedOrderId === order.order_id && (
                        <div className="border-t border-gray-100 bg-gray-50 px-6 py-4 text-sm">
                          <ul className="mb-4 space-y-1">
                            {order.items.map((item: any) => (
                              <li key={item.product_id} className="flex justify-between">
                                <span className="text-gray-600">
                                  {item.name} x {item.quantity}
                                </span>
                                <span className="text-gray-800">
                                  ¥{(item.unit_price * item.quantity).toLocaleString()}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: Phân tích sản phẩm */}
      {activeTab === "product" && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loading message="Loading product analysis..." />
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="border-b border-gray-200 bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">順位</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                    商品名
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                    販売個数
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                    売上金額
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {productAnalysis.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-500">#{index + 1}</td>
                    <td className="px-6 py-4 font-medium text-gray-800">{item.name}</td>
                    <td className="px-6 py-4 text-right text-gray-600">{item.qty}</td>
                    <td className="px-6 py-4 text-right font-bold text-gray-800">
                      ¥{item.sales.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {productAnalysis.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                      データがありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
