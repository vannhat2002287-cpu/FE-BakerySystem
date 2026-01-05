import React, { useState, useMemo, useEffect } from "react";
import { ChevronDown, ChevronUp, FileText, Printer, Calendar } from "lucide-react";
import { getOrdersByDate } from "@/api/orders";
import { Order } from "@/types";
import { ApiError } from "@/api/client";
import Loading from "@/components/Loading";

const HistoryPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [activeTab, setActiveTab] = useState<"daily" | "product">("daily");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // --- TAB 1: Daily Summary Logic ---
  // Group orders by date (simple string YYYY-MM-DD)
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

    orders.forEach((order) => {
      // Parse order_time properly, handling timezone issues
      // Backend returns ISO string, parse it correctly
      const orderDate = new Date(order.order_time);
      // Use toLocaleDateString with consistent locale to avoid timezone issues
      const dateStr = orderDate.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Asia/Tokyo", // Use consistent timezone
      });

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
      if (order.order_type === "eat-in") entry.eatIn += order.total_amount;
      else entry.takeaway += order.total_amount;
    });

    // Sort by date properly
    return Array.from(map.values()).sort((a, b) => {
      // Parse dates consistently for sorting
      const dateA = new Date(a.date.replace(/\//g, "-"));
      const dateB = new Date(b.date.replace(/\//g, "-"));
      return dateB.getTime() - dateA.getTime();
    });
  }, [orders]);

  // --- TAB 2: Product Analysis Logic (ABC Analysis mock) ---
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
    return Array.from(map.values()).sort((a, b) => b.sales - a.sales);
  }, [orders]);

  // Fetch orders from API
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setIsLoading(true);
        const ordersData = await getOrdersByDate(selectedDate);
        setOrders(ordersData);
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

  const toggleOrderExpand = (id: string) => {
    setExpandedOrderId(expandedOrderId === id ? null : id);
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-8">
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

      {/* Tabs */}
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

      {activeTab === "daily" && (
        <div className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loading message="Loading orders..." />
            </div>
          ) : dailySummary.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
              <FileText className="mx-auto mb-4 h-16 w-16 text-gray-300" />
              <p className="text-lg text-gray-500">No orders found for selected date</p>
              <p className="mt-2 text-sm text-gray-400">Select a different date to view orders</p>
            </div>
          ) : (
            dailySummary.map((day) => (
              <div
                key={day.date}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                {/* Daily Header */}
                <div className="flex flex-wrap items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4">
                  <div>
                    <h3 className="flex items-center text-lg font-bold text-gray-800">
                      <FileText className="text-brand-500 mr-2 h-5 w-5" />
                      {day.date}
                    </h3>
                    <span className="ml-7 text-sm text-gray-500">{day.count} 件の注文</span>
                  </div>
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

                {/* Order List for that day */}
                <div className="divide-y divide-gray-100">
                  {day.orders.map((order: any) => (
                    <div key={order.order_id}>
                      <div
                        onClick={() => toggleOrderExpand(order.order_id)}
                        className="flex cursor-pointer items-center justify-between px-6 py-3 hover:bg-gray-50"
                      >
                        <div className="flex items-center space-x-4">
                          <span className="font-mono text-sm text-gray-400">
                            {new Date(order.order_time).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
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
                            {order.order_id}
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

                      {/* Expanded Details */}
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
                          <div className="flex items-center justify-between border-t border-gray-200 pt-2">
                            <span className="text-xs text-gray-500">支払方法: 現金</span>
                            <button className="text-brand-600 hover:text-brand-800 border-brand-200 flex items-center rounded border bg-white px-3 py-1 text-xs font-bold shadow-sm">
                              <Printer className="mr-1 h-3 w-3" /> 領収書印刷
                            </button>
                          </div>
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
