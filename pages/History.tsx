/**
 * @authors Huynh and Hue
 * @optimized_by Gemini (UI/UX)
 */

import React, { useState, useMemo, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Calendar,
  Search,
  ArrowUpDown,
  ListOrdered,
  X,
} from "lucide-react";
import { getOrdersByDate } from "@/api/orders";
import { Order } from "@/types";
import Loading from "@/components/Loading";
import { formatDateTime, getLocalBusinessDate, dateHelper as dayjs } from "@/utils/date";

// ==== HÀM TẠO MẢNG NGÀY TRONG KHOẢNG ====
const getDaysArray = (start: string, end: string): string[] => {
  const days: string[] = [];
  let currentDate = dayjs(start);
  const endDate = dayjs(end);
  while (currentDate.isBefore(endDate) || currentDate.isSame(endDate, "day")) {
    days.push(currentDate.format("YYYY-MM-DD"));
    currentDate = currentDate.add(1, "day");
  }
  return days;
};

// ==== KIỂU SẮP XẾP ====
type SortKey = "order_time" | "total_amount";
type SortDirection = "asc" | "desc";

// ==== COMPONENT CHÍNH: LỊCH SỬ ĐƠN HÀNG ====
const HistoryPage: React.FC = () => {
  // ==== STATE QUẢN LÝ DỮ LIỆU ====
  // Danh sách tất cả đơn hàng lấy được
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  // Trạng thái loading khi lấy đơn hàng
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Ngày bắt đầu lọc
  const [startDate, setStartDate] = useState<string>(() => getLocalBusinessDate());
  // Ngày kết thúc lọc
  const [endDate, setEndDate] = useState<string>(() => getLocalBusinessDate());
  // Tab đang chọn: daily (theo ngày) hoặc product (phân tích sản phẩm)
  const [activeTab, setActiveTab] = useState<"daily" | "product">("daily");
  // ID đơn hàng đang mở chi tiết
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  // Bộ lọc loại đơn hàng
  const [orderTypeFilter, setOrderTypeFilter] = useState<"all" | "eat-in" | "takeaway">("all");
  // Từ khóa tìm kiếm theo ID
  const [searchTerm, setSearchTerm] = useState<string>("");
  // Trường sắp xếp
  const [sortKey, setSortKey] = useState<SortKey>("order_time");
  // Chiều sắp xếp
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // ==== EFFECT: Lấy đơn hàng theo khoảng ngày khi thay đổi filter ngày ====
  useEffect(() => {
    const fetchOrdersForRange = async () => {
      if (!startDate || !endDate || dayjs(startDate).isAfter(dayjs(endDate))) {
        setAllOrders([]);
        return;
      }
      try {
        setIsLoading(true);
        const dateArray = getDaysArray(startDate, endDate);
        const promises = dateArray.map((date) => getOrdersByDate(date));
        const results = await Promise.allSettled(promises);
        const fetchedOrders: Order[] = [];
        results.forEach((result) => {
          if (result.status === "fulfilled" && Array.isArray(result.value)) {
            fetchedOrders.push(...result.value);
          }
        });
        fetchedOrders.sort((a, b) => dayjs(b.order_time).diff(dayjs(a.order_time)));
        setAllOrders(fetchedOrders);
      } catch (error) {
        setAllOrders([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrdersForRange();
  }, [startDate, endDate]);

  // ==== DỮ LIỆU ĐƠN HÀNG ĐÃ LỌC VÀ SẮP XẾP ====
  const processedOrders = useMemo(() => {
    let filtered = allOrders;
    if (orderTypeFilter !== "all") {
      filtered = filtered.filter((order) => order.order_type === orderTypeFilter);
    }
    if (searchTerm) {
      filtered = filtered.filter((order) => order.order_id.toString().includes(searchTerm));
    }
    filtered.sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [allOrders, orderTypeFilter, searchTerm, sortKey, sortDirection]);

  // ==== PHÂN TÍCH SẢN PHẨM (tính tổng bán và doanh thu từng sản phẩm) ====
  const productAnalysis = useMemo(() => {
    const map = new Map<string, { id: string; name: string; qty: number; sales: number }>();
    processedOrders.forEach((order) => {
      order.items.forEach((item) => {
        const entry = map.get(item.product_id) || {
          id: item.product_id,
          name: item.name,
          qty: 0,
          sales: 0,
        };
        entry.qty += item.quantity;
        entry.sales += item.unit_price * item.quantity;
        map.set(item.product_id, entry);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.sales - a.sales);
  }, [processedOrders]);

  // ==== HÀM XỬ LÝ SẮP XẾP BẢNG ====
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  // ==== COMPONENT HEADER CÓ SẮP XẾP (dùng cho bảng) ====
  const SortableHeader: React.FC<{ columnKey: SortKey; title: string }> = ({
    columnKey,
    title,
  }) => (
    // Allow custom alignment for header
    <th
      onClick={() => handleSort(columnKey)}
      className={
        `cursor-pointer px-6 py-3 text-xs font-bold tracking-wider text-slate-500 uppercase transition-colors hover:bg-slate-100 ` +
        (title === "合計金額" ? "text-right" : "text-left")
      }
    >
      <div
        className={
          title === "合計金額" ? "flex items-center justify-end gap-1" : "flex items-center gap-1"
        }
      >
        {title}
        {sortKey === columnKey ? (
          sortDirection === "desc" ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronUp size={14} />
          )
        ) : (
          <ArrowUpDown size={14} className="opacity-30" />
        )}
      </div>
    </th>
  );

  // ==== RENDER GIAO DIỆN LỊCH SỬ ĐƠN HÀNG ====
  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 p-6 font-sans text-slate-800">
      {/* Header & Tabs - Tiêu đề và các tab chuyển đổi giữa xem đơn hàng và phân tích sản phẩm */}
      <div className="mb-6 flex items-end justify-between">
        <h1 className="text-2xl font-bold text-slate-800">売上・注文履歴</h1>
        <div className="flex rounded-lg bg-slate-200 p-1">
          <button
            onClick={() => setActiveTab("daily")}
            className={`flex items-center gap-2 rounded-md px-6 py-2 text-sm font-bold transition-all ${activeTab === "daily" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            <ListOrdered className="h-4 w-4" /> 注文一覧
          </button>
          <button
            onClick={() => setActiveTab("product")}
            className={`flex items-center gap-2 rounded-md px-6 py-2 text-sm font-bold transition-all ${activeTab === "product" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            <FileText className="h-4 w-4" /> 商品分析
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Toolbar - Thanh công cụ lọc ngày, loại đơn hàng, tìm kiếm ID */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
            <Calendar className="h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-32 text-sm font-medium text-slate-700 outline-none"
            />
            <span className="text-slate-300">~</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-32 text-sm font-medium text-slate-700 outline-none"
            />
          </div>

          {activeTab === "daily" && (
            <div className="flex gap-3">
              <select
                value={orderTypeFilter}
                onChange={(e) => setOrderTypeFilter(e.target.value as any)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium outline-none focus:border-orange-500"
              >
                <option value="all">すべての注文</option>
                <option value="eat-in">店内)</option>
                <option value="takeaway">持ち帰り</option>
              </select>
              <div className="relative">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ID検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-48 rounded-lg border border-slate-200 py-1.5 pr-3 pl-9 text-sm transition-all outline-none focus:border-orange-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Stats Cards (Unified) - Thống kê tổng quan: tổng doanh thu, số lượng giao dịch, doanh thu theo loại đơn hàng */}
        <div className="grid grid-cols-3 gap-6 p-6 pb-0">
          <div className="rounded-xl border border-slate-100 bg-white p-4 text-center shadow-sm">
            <div className="mb-1 text-center text-xs font-bold tracking-wider text-slate-400 uppercase">
              総売上
            </div>
            <div className="text-center text-2xl font-black text-slate-800">
              ¥
              {processedOrders
                .reduce(
                  (sum, o) => sum + (activeTab === "daily" ? o.total_amount : 0),
                  activeTab === "product" ? productAnalysis.reduce((sum, i) => sum + i.sales, 0) : 0
                )
                .toLocaleString()}
            </div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-4 text-center shadow-sm">
            <div className="mb-1 text-center text-xs font-bold tracking-wider text-slate-400 uppercase">
              取引件数
            </div>
            <div className="text-center text-2xl font-black text-slate-800">
              {activeTab === "daily"
                ? processedOrders.length
                : productAnalysis.reduce((sum, i) => sum + i.qty, 0)}{" "}
              <span className="text-sm font-normal text-slate-400">
                {activeTab === "daily" ? "件" : "個"}
              </span>
            </div>
          </div>
          <div className="flex flex-col justify-center gap-1 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            {/* Tính tổng doanh thu và phần trăm */}
            {(() => {
              const eatin = processedOrders
                .filter((o) => o.order_type === "eat-in")
                .reduce((sum, o) => sum + o.total_amount, 0);
              const takeaway = processedOrders
                .filter((o) => o.order_type === "takeaway")
                .reduce((sum, o) => sum + o.total_amount, 0);
              const total = eatin + takeaway;
              const eatinPercent = total ? Math.round((eatin / total) * 100) : 0;
              const takeawayPercent = total ? Math.round((takeaway / total) * 100) : 0;
              return (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">店内</span>
                    <span className="font-bold">
                      ¥{eatin.toLocaleString()}{" "}
                      <span className="text-xs text-slate-400">( {eatinPercent}% )</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full bg-blue-500" style={{ width: `${eatinPercent}%` }}></div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">持帰</span>
                    <span className="font-bold">
                      ¥{takeaway.toLocaleString()}{" "}
                      <span className="text-xs text-slate-400">( {takeawayPercent}% )</span>
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Main Content Area - Khu vực hiển thị nội dung chính: bảng đơn hàng hoặc phân tích sản phẩm */}
        <div className="relative flex flex-1 overflow-hidden p-6">
          {isLoading ? (
            <div className="flex h-full w-full items-center justify-center">
              <Loading message="データを読み込み中..." />
            </div>
          ) : (
            <>
              {/* Daily Orders Table - Bảng danh sách đơn hàng theo ngày */}
              {activeTab === "daily" && (
                <div
                  className={`flex flex-1 flex-col overflow-hidden transition-all duration-300 ${expandedOrderId ? "w-2/3 pr-4" : "w-full"}`}
                >
                  <div className="flex-1 overflow-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
                        <tr>
                          <SortableHeader columnKey="order_time" title="ID / 日時" />
                          <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase">
                            種類
                          </th>
                          <SortableHeader columnKey="total_amount" title="合計金額" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {processedOrders.map((order) => (
                          <tr
                            key={order.order_id}
                            onClick={() =>
                              setExpandedOrderId(
                                order.order_id === expandedOrderId ? null : order.order_id
                              )
                            }
                            className={`cursor-pointer transition-colors hover:bg-slate-50 ${expandedOrderId === order.order_id ? "border-l-4 border-orange-500 bg-orange-50" : ""}`}
                          >
                            <td className="px-6 py-4">
                              <div className="font-mono font-bold text-slate-700">
                                #{order.order_id}
                              </div>
                              <div className="text-xs text-slate-400">
                                {formatDateTime(order.order_time, "YYYY/MM/DD HH:mm")}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span
                                className={`rounded px-2 py-1 text-xs font-bold ${order.order_type === "eat-in" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}
                              >
                                {order.order_type === "eat-in" ? "店内" : "持帰"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right font-mono font-bold text-slate-800">
                              ¥{order.total_amount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Product Analysis Table - Bảng phân tích sản phẩm: xếp hạng, tên, số lượng bán, doanh thu */}
              {activeTab === "product" && (
                <div className="w-full overflow-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="w-20 px-6 py-3 text-center text-xs font-bold text-slate-500">
                          順位
                        </th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500">商品名</th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-slate-500">
                          販売数
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-slate-500">
                          売上
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {productAnalysis.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-center">
                            <span
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${idx < 3 ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"}`}
                            >
                              {idx + 1}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-700">{item.name}</td>
                          <td className="px-6 py-4 text-right font-mono text-slate-600">
                            {item.qty}
                          </td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-slate-800">
                            ¥{item.sales.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Order Detail Drawer (Slide-in) - Bảng chi tiết đơn hàng dạng trượt từ phải vào */}
              {activeTab === "daily" && expandedOrderId && (
                <div className="animate-in slide-in-from-right absolute top-6 right-0 bottom-6 z-20 flex w-1/3 min-w-[350px] flex-col rounded-l-2xl border border-slate-200 bg-white shadow-2xl duration-300">
                  <div className="flex items-center justify-between rounded-tl-2xl border-b border-slate-100 bg-slate-50 p-4">
                    <span className="font-bold text-slate-700">詳細情報 #{expandedOrderId}</span>
                    <button
                      onClick={() => setExpandedOrderId(null)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-200"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    {(() => {
                      const order = processedOrders.find((o) => o.order_id === expandedOrderId);
                      if (!order) return null;
                      return (
                        <div className="space-y-6">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="rounded-lg bg-slate-50 p-3">
                              <div className="text-xs text-slate-400">
                                日時 {/* Ngày giờ đặt hàng */}
                              </div>
                              <div className="font-medium text-slate-800">
                                {formatDateTime(order.order_time, "MM/DD HH:mm")}
                              </div>
                            </div>
                            <div className="rounded-lg bg-slate-50 p-3">
                              <div className="text-xs text-slate-400">
                                合計 {/* Tổng tiền đơn hàng */}
                              </div>
                              <div className="text-lg font-bold text-orange-600">
                                ¥{order.total_amount.toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <div>
                            <div className="mb-2 text-xs font-bold text-slate-400 uppercase">
                              商品リスト {/* Danh sách sản phẩm trong đơn */}
                            </div>
                            <ul className="space-y-2">
                              {order.items.map((item, i) => (
                                <li
                                  key={i}
                                  className="flex items-center justify-between border-b border-dashed border-slate-100 py-2 last:border-0"
                                >
                                  <div>
                                    <div className="text-sm font-bold text-slate-700">
                                      {item.name} {/* Tên sản phẩm */}
                                    </div>
                                    <div className="text-xs text-slate-400">
                                      ¥{item.unit_price} x {item.quantity}{" "}
                                      {/* Đơn giá x số lượng */}
                                    </div>
                                  </div>
                                  <div className="font-mono font-medium text-slate-800">
                                    ¥{(item.unit_price * item.quantity).toLocaleString()}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
