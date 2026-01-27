/**
 * @authors Huynh and Hue
 * @description Trang quản lý tồn kho và lịch sử yêu cầu nhập hàng từ nhà máy.
 * @updates Cập nhật lại UI/UX để đồng bộ với POS & Dashboard (Giao diện Slate).
 */
import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useStore } from "@/store/StoreContext";
import {
  X,
  Factory,
  AlertTriangle,
  TrendingDown,
  RefreshCw,
  Zap,
  Clock,
  CheckCircle2,
  PackageCheck,
  Loader2,
  ArrowRight,
  Search,
  Filter,
  MoreHorizontal,
  Calendar,
  Box,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import {
  getAllFactoryRequests,
  getFactoryRequestsByDate,
  createFactoryRequest,
  updateFactoryRequestStatus,
  FactoryRequest,
  calculateBacklog,
  FactoryRequestResponseDTO,
  mapFactoryRequestDTOToFactoryRequest,
} from "@/api/factoryRequests";
import {
  adjustInventory,
  resetDailyInventory,
  getCurrentBusinessDate,
  hasResetTodayInventory,
  markInventoryResetDone,
} from "@/api/inventory";
import toast from "react-hot-toast";
import { getCategories } from "@/api/categories";
import type { Category, AutoOrderCheckResult } from "@/types";
import {
  AUTO_ORDER_CONFIG,
  checkAllProductsForAutoOrder,
  executeAutoOrderForAll,
} from "@/utils/autoOrder";
import { apiRequest } from "@/api/client";
import { API_ENDPOINTS, buildApiUrl } from "@/api/config";
import { formatDateTime, getLocalBusinessDate, dateHelper } from "@/utils/date";

// --- CÁC HÀM TIỆN ÍCH ---
const addMinutes = (date: Date | string, minutes: number) =>
  dateHelper(date).add(minutes, "minute").toDate();

// Component nhỏ: Thanh tiến độ (Visual Bar) - Phong cách Slate
const ProgressBar: React.FC<{ value: number; max: number; colorClass?: string }> = ({
  value,
  max,
  colorClass = "bg-blue-500",
}) => {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full transition-all duration-500 ease-out ${colorClass}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};

// --- CÁC COMPONENT CON ---

// 1. Hộp thoại xác nhận (Phong cách Slate)
const ConfirmDialog: React.FC<{
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, message, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="animate-in fade-in fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-all duration-200">
      <div className="animate-in zoom-in-95 w-full max-w-sm scale-100 transform rounded-2xl bg-white p-6 shadow-2xl transition-all">
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-orange-50 p-3">
            <AlertTriangle className="h-8 w-8 text-orange-600" />
          </div>
        </div>
        <div className="mb-8 text-center text-lg font-bold text-slate-800">{message}</div>
        <div className="flex gap-3">
          <button
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800"
            onClick={onCancel}
          >
            いいえ
          </button>
          <button
            className="flex-1 rounded-xl bg-orange-600 px-4 py-3 font-bold text-white shadow-lg shadow-orange-200 transition-all hover:-translate-y-0.5 hover:bg-orange-700 hover:shadow-orange-300"
            onClick={onConfirm}
          >
            はい
          </button>
        </div>
      </div>
    </div>
  );
};

// 2. Bảng tồn kho (Phong cách Slate với hiệu ứng Hover)
const InventoryTable: React.FC<{
  data: any[];
  factoryRequests: FactoryRequest[];
  onOpenRequestModal: (
    product_id: string,
    product_name: string,
    stock: number,
    threshold: number
  ) => void;
  handleResetDailyInventory: () => void;
  isResetting: boolean;
  handleAutoOrderCheck: () => void;
  isAutoOrdering: boolean;
}> = ({ data, factoryRequests, onOpenRequestModal, handleResetDailyInventory, isResetting }) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const lower = searchTerm.toLowerCase();
    return data.filter((item) => item.name.toLowerCase().includes(lower));
  }, [data, searchTerm]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Phần đầu (Header) */}
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-white px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-orange-100 p-2">
            <Box className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">在庫一覧</h2>
            <p className="text-xs font-medium text-slate-400">{data.length} アイテム</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end gap-3">
          {/* Ô tìm kiếm */}
          <div className="group relative w-full max-w-xs">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-orange-500" />
            <input
              type="text"
              placeholder="商品名を検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-4 pl-9 text-sm font-bold text-slate-700 transition-all outline-none focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
            />
          </div>

          <div className="mx-1 hidden h-8 w-px bg-slate-200 sm:block"></div>

          <button
            onClick={handleResetDailyInventory}
            disabled={isResetting}
            className={`hidden items-center rounded-xl border px-4 py-2.5 text-xs font-bold transition-all sm:inline-flex ${
              isResetting
                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                : "border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:bg-slate-50 hover:text-orange-600"
            }`}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isResetting ? "animate-spin" : ""}`} />
            {isResetting ? "処理中..." : "在庫リセット"}
          </button>
        </div>
      </div>

      {/* Bảng dữ liệu */}
      <div className="custom-scrollbar relative flex-1 overflow-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50/95 shadow-sm backdrop-blur-sm">
            <tr>
              <th className="w-16 px-6 py-4 text-xs font-bold tracking-wider text-slate-400 uppercase">
                No.
              </th>
              <th className="px-6 py-4 text-xs font-bold tracking-wider text-slate-400 uppercase">
                商品情報
              </th>
              <th className="w-56 px-6 py-4 text-center text-xs font-bold tracking-wider text-slate-400 uppercase">
                在庫状況
              </th>
              <th className="hidden w-40 px-6 py-4 text-center text-xs font-bold tracking-wider text-slate-400 uppercase md:table-cell">
                更新日時
              </th>
              <th className="w-32 px-6 py-4 text-center text-xs font-bold tracking-wider text-slate-400 uppercase">
                アクション
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredData.map((item, index) => {
              const isLow = item.stock <= item.threshold;
              const stockPercent =
                item.threshold > 0 ? (item.stock / (item.threshold * 2)) * 100 : 100;
              const barColor = isLow
                ? "bg-red-500"
                : stockPercent < 50
                  ? "bg-yellow-500"
                  : "bg-green-500";
              const hasActiveReq = factoryRequests.some(
                (r) => r.product_id === item.product_id && r.status === "PENDING"
              );
              const disabledBtn = !isLow || hasActiveReq;

              return (
                <tr
                  key={item.product_id}
                  className={`group transition-all duration-200 hover:bg-slate-50 ${isLow ? "bg-red-50/40" : ""}`}
                >
                  <td className="px-6 py-4 text-center font-mono text-xs font-bold text-slate-400">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all group-hover:shadow-md">
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{item.name}</div>
                        <div className="mt-1 flex items-center text-xs font-medium text-slate-500">
                          発注点: {item.threshold}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="flex items-baseline gap-1">
                        <span
                          className={`text-xl font-black tabular-nums ${isLow ? "text-red-600" : "text-slate-800"}`}
                        >
                          {item.stock}
                        </span>
                        <span className="text-xs font-bold text-slate-400">個</span>
                      </div>
                      {/* ProgressBar removed as requested */}
                      {isLow && (
                        <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                          <TrendingDown className="h-3 w-3" />
                          不足
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="hidden px-6 py-4 text-center font-mono text-xs font-medium text-slate-500 md:table-cell">
                    {item.lastUpdated ? formatDateTime(item.lastUpdated, "M/DD HH:mm") : "—"}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      disabled={disabledBtn}
                      onClick={() =>
                        onOpenRequestModal(item.product_id, item.name, item.stock, item.threshold)
                      }
                      className={`inline-flex h-10 w-full min-w-[90px] items-center justify-center rounded-xl px-3 text-xs font-bold transition-all duration-200 ${
                        !disabledBtn
                          ? "bg-orange-600 text-white shadow-md shadow-orange-200 hover:-translate-y-0.5 hover:bg-orange-700 hover:shadow-lg hover:shadow-orange-300"
                          : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                      }`}
                    >
                      {hasActiveReq ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin text-orange-500" />
                          依頼中
                        </>
                      ) : isLow ? (
                        <>
                          <Factory className="mr-1.5 h-3.5 w-3.5" />
                          依頼
                        </>
                      ) : (
                        "十分"
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredData.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="mb-3 rounded-full bg-slate-100 p-4">
              <Search className="h-8 w-8 opacity-40" />
            </div>
            <p className="font-bold">商品が見つかりません</p>
          </div>
        )}
      </div>
    </div>
  );
};

// 3. Tab Lịch sử (Phong cách Slate)
const HistoryTabContent: React.FC<{
  requests: FactoryRequest[];
  filters: { date: string; sortBy: string; status: string };
  onFiltersChange: (filters: { date?: string; sortBy?: string; status?: string }) => void;
  isLoading: boolean;
  onOpenPartialDelivery: (req: FactoryRequest) => void;
  onCancelRequest: (id: string) => void;
  businessDate: string;
  handleAutoOrderCheck?: () => void;
  isAutoOrdering?: boolean;
}> = ({
  requests,
  filters,
  onFiltersChange,
  isLoading,
  onOpenPartialDelivery,
  onCancelRequest,
  handleAutoOrderCheck,
  isAutoOrdering,
}) => (
  <div className="flex h-full flex-col gap-6">
    {/* Thanh bộ lọc */}
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="group relative">
            <Calendar className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-hover:text-orange-500" />
            <input
              type="date"
              value={filters.date}
              onChange={(e) => onFiltersChange({ date: e.target.value })}
              className="cursor-pointer rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3 pl-9 text-sm font-bold text-slate-700 transition-all outline-none focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
            />
          </div>
          <div className="group relative">
            <Filter className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-hover:text-orange-500" />
            <select
              value={filters.status}
              onChange={(e) => onFiltersChange({ status: e.target.value })}
              className="cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-8 pl-9 text-sm font-bold text-slate-700 transition-all outline-none focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
            >
              <option value="all">すべての状態</option>
              <option value="PENDING">発注中 (Pending)</option>
              <option value="PARTIAL">一部納品 (Partial)</option>
              <option value="DELIVERED">完了 (Done)</option>
              <option value="CANCELLED">キャンセル</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
              <ChevronRight className="h-4 w-4 rotate-90" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden text-sm font-bold text-slate-500 md:block">
            計 <span className="text-lg font-black text-slate-800">{requests.length}</span> 件
          </div>
          <button
            onClick={handleAutoOrderCheck}
            disabled={isAutoOrdering}
            className={`flex items-center rounded-xl px-5 py-2.5 text-xs font-bold shadow-md transition-all ${
              isAutoOrdering
                ? "cursor-not-allowed bg-slate-100 text-slate-400 shadow-none"
                : "bg-gradient-to-br from-purple-600 to-purple-800 text-white shadow-purple-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-300"
            }`}
          >
            <Zap className={`mr-2 h-4 w-4 ${isAutoOrdering ? "animate-pulse" : "fill-white"}`} />
            {isAutoOrdering ? "AIチェック中..." : "自動発注チェック"}
          </button>
        </div>
      </div>
    </div>

    {/* Nội dung dạng lưới */}
    <div className="custom-scrollbar flex-1 overflow-y-auto pr-1">
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="mb-3 h-10 w-10 animate-spin text-orange-500" />
            <p>履歴を読み込み中...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-20 text-slate-400">
            <p>該当する履歴がありません</p>
          </div>
        ) : (
          requests.map((req) => {
            const backlog = calculateBacklog(req);
            // CHỈ cho phép thao tác (Nhập hàng/Hủy) khi đơn đang ở trạng thái PENDING
            const canAction = req.status === "PENDING";
            const progressVal = req.delivered_quantity;
            const progressMax = req.request_quantity;
            const isCompleted = req.status === "DELIVERED";

            return (
              <div
                key={req.request_id}
                className={`group relative flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
                  canAction
                    ? "border-slate-200 hover:border-orange-200"
                    : "border-slate-100 opacity-80 hover:opacity-100"
                }`}
              >
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1 text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(req.created_at, "YYYY/MM/DD HH:mm")}
                    </div>
                    <div
                      className="mt-1 line-clamp-1 text-lg font-bold text-slate-800 transition-colors group-hover:text-orange-600"
                      title={req.product_name}
                    >
                      {req.product_name}
                    </div>
                  </div>

                  <div
                    className={`rounded-xl p-2 ${
                      req.status === "DELIVERED"
                        ? "bg-green-50 text-green-600"
                        : req.status === "PENDING"
                          ? "bg-yellow-50 text-yellow-600"
                          : req.status === "PARTIAL"
                            ? "bg-orange-50 text-orange-600"
                            : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {req.status === "DELIVERED" && <CheckCircle2 className="h-5 w-5" />}
                    {req.status === "PENDING" && <Clock className="h-5 w-5" />}
                    {req.status === "PARTIAL" && <PackageCheck className="h-5 w-5" />}
                    {req.status === "CANCELLED" && <X className="h-5 w-5" />}
                  </div>
                </div>

                <div className="mb-5 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-end justify-between text-sm">
                    <span className="text-xs font-bold text-slate-500">進捗</span>
                    <span className="font-bold text-slate-800">
                      <span className={req.delivered_quantity > 0 ? "text-blue-600" : ""}>
                        {req.delivered_quantity}
                      </span>
                      <span className="mx-1 text-xs text-slate-300">/</span>
                      {req.request_quantity}
                    </span>
                  </div>
                  <ProgressBar
                    value={progressVal}
                    max={progressMax}
                    colorClass={isCompleted ? "bg-green-500" : "bg-blue-500"}
                  />
                </div>

                <div className="mt-auto flex items-center justify-between gap-3">
                  <span
                    className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase ${
                      req.status === "PENDING"
                        ? "bg-yellow-100 text-yellow-700"
                        : req.status === "PARTIAL"
                          ? "bg-orange-100 text-orange-700"
                          : req.status === "DELIVERED"
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {req.status === "PENDING" && "発注中"}
                    {req.status === "PARTIAL" && `残 ${backlog}`}
                    {req.status === "DELIVERED" && "完了"}
                    {req.status === "CANCELLED" && "取消済"}
                  </span>

                  {canAction && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => onCancelRequest(req.request_id)}
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                        title="キャンセル"
                      >
                        <X className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => onOpenPartialDelivery(req)}
                        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-md shadow-blue-200 transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-blue-300"
                      >
                        <PackageCheck className="h-4 w-4" />
                        入庫
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  </div>
);

// 4. Modal Yêu cầu đặt hàng (Cập nhật: Dùng state nội bộ để nhập liệu mượt mà hơn)
const RequestFactoryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  target: {
    product_id: string;
    product_name: string;
    current_stock: number;
    threshold: number;
  } | null;
  initialQty: number;
  onSubmit: (data: { qty: number; eta: string; note: string }) => void;
}> = ({ isOpen, onClose, target, initialQty, onSubmit }) => {
  const [qtyStr, setQtyStr] = useState("");
  const [eta, setEta] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (isOpen) {
      setQtyStr(initialQty.toString());
      setEta(addMinutes(new Date(), 5).toISOString().slice(0, 16));
      setNote("");
    }
  }, [isOpen, initialQty]);

  if (!isOpen || !target) return null;

  const handleSubmit = () => {
    const qty = parseInt(qtyStr, 10);
    if (!qtyStr || isNaN(qty) || qty < 1) {
      toast.error("数量は1以上である必要があります");
      return;
    }
    onSubmit({ qty, eta, note });
  };

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-all">
      <div className="animate-in zoom-in-95 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <div>
            <div className="text-xl font-black text-slate-800">工場へ発注依頼</div>
            <div className="mt-1 text-xs font-bold text-slate-500">
              必要な数量を入力してください
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-slate-100 p-2 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6 flex items-center gap-4 rounded-xl border border-orange-100 bg-orange-50 p-4">
            <div className="rounded-full bg-white p-2 shadow-sm">
              <Factory className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <div className="text-xs font-bold text-orange-800/70 uppercase">対象商品</div>
              <div className="text-lg font-black text-slate-900">{target.product_name}</div>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-4">
            <div className="space-y-1 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <label className="text-[10px] font-bold text-slate-400 uppercase">現在在庫</label>
              <div className="text-2xl font-black text-slate-800">{target.current_stock}</div>
            </div>
            <div className="space-y-1 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <label className="text-[10px] font-bold text-slate-400 uppercase">基準値 (Min)</label>
              <div className="text-2xl font-black text-slate-400">{target.threshold}</div>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-700">依頼数量</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={qtyStr}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "") {
                      setQtyStr("1");
                      return;
                    }
                    if (/^\d+$/.test(val)) {
                      const cleanVal =
                        val.length > 1 && val.startsWith("0") ? val.replace(/^0+/, "") : val;
                      setQtyStr(cleanVal);
                    }
                  }}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg font-bold text-slate-800 transition-all outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                />
                <span className="absolute top-1/2 right-4 -translate-y-1/2 font-bold text-slate-400">
                  個
                </span>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-700">到着予定日時</label>
              <input
                type="datetime-local"
                value={eta}
                onChange={(e) => setEta(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition-all outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-700">
                メモ <span className="font-normal text-slate-400">(任意)</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full resize-none rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition-all outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                rows={2}
                placeholder="例）急ぎでお願いします"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            className="rounded-xl bg-orange-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-200 transition-all hover:-translate-y-0.5 hover:bg-orange-700 hover:shadow-orange-300"
          >
            依頼を送信
          </button>
        </div>
      </div>
    </div>
  );
};

// 5. Modal Tự động đặt hàng (Cập nhật)
const AutoOrderModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  results: AutoOrderCheckResult[];
  onSubmit: () => void;
  isSubmitting: boolean;
}> = ({ isOpen, onClose, results, onSubmit, isSubmitting }) => {
  if (!isOpen) return null;

  const sortedResults = [...results].sort((a, b) => {
    if (a.should_order !== b.should_order) return b.should_order ? 1 : -1;
    return a.current_stock - b.current_stock;
  });
  const productsToOrder = sortedResults.filter((r) => r.should_order);

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="animate-in zoom-in-95 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-purple-100 p-2">
              <Zap className="h-5 w-5 fill-purple-600 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">自動発注チェック結果</h2>
              {/* <p className="text-xs font-bold text-slate-500">AIが在庫不足を検出しました</p> */}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-slate-100 p-2 transition-colors hover:bg-slate-200"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto bg-slate-50 p-6">
          <div className="space-y-3">
            {productsToOrder.map((result) => (
              <div
                key={result.product_id}
                className="flex items-center justify-between rounded-xl border border-orange-200 bg-white p-4 shadow-sm transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="h-3 w-3 animate-pulse rounded-full bg-orange-500 shadow-sm"></div>
                  <div>
                    <div className="font-bold text-slate-800">{result.product_name}</div>
                    <div className="mt-1 flex items-center gap-3 text-xs font-medium text-slate-500">
                      <span className="flex items-center gap-1 rounded border border-slate-200 bg-slate-100 px-2 py-0.5">
                        在庫: <b className="text-slate-800">{result.current_stock}</b>
                      </span>
                      <span className="flex items-center gap-1 rounded border border-slate-200 bg-slate-100 px-2 py-0.5">
                        基準: <b className="text-slate-800">{result.reorder_point}</b>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">
                    推奨発注数
                  </span>
                  <span className="text-xl font-black text-orange-600">
                    {result.suggested_quantity}
                  </span>
                  <span className="ml-1 text-xs font-bold text-orange-600">個</span>
                </div>
              </div>
            ))}
            {productsToOrder.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <p className="font-bold">発注が必要な商品はありません</p>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-400 uppercase">発注対象</span>
              <span className="text-2xl font-black text-slate-800">
                {productsToOrder.length}{" "}
                <span className="text-base font-bold text-slate-500">件</span>
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
              >
                閉じる
              </button>
              <button
                onClick={onSubmit}
                disabled={productsToOrder.length === 0 || isSubmitting}
                className={`flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-bold text-white shadow-lg transition-all ${
                  productsToOrder.length === 0 || isSubmitting
                    ? "cursor-not-allowed bg-slate-300 shadow-none"
                    : "bg-purple-600 shadow-purple-200 hover:-translate-y-0.5 hover:bg-purple-700 hover:shadow-purple-300"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    処理中...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 fill-white" />
                    一括発注を実行
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 6. Modal Nhập hàng (Cập nhật)
const ReceiveGoodsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  target: FactoryRequest | null;
  qty: number;
  note: string;
  onQtyChange: (qty: number) => void;
  onNoteChange: (note: string) => void;
  onSubmit: () => void;
}> = ({ isOpen, onClose, target, qty, note, onQtyChange, onNoteChange, onSubmit }) => {
  const [error, setError] = React.useState("");
  if (!isOpen || !target) return null;

  const backlog = calculateBacklog(target);
  const isQuantityChanged = qty !== backlog;

  const handleSubmit = () => {
    if (isQuantityChanged && (!note || note.trim() === "")) {
      setError("数量が変更されています。理由を入力してください。");
      return;
    }
    setError("");
    onSubmit();
  };

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="animate-in zoom-in-95 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <PackageCheck className="h-5 w-5" />
              入庫処理 (検品)
            </h3>
            <button
              onClick={onClose}
              className="rounded-full bg-white/20 p-1.5 text-white transition-colors hover:bg-white/30"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 text-sm font-medium opacity-90">{target.product_name}</div>
        </div>

        <div className="space-y-6 p-6">
          <div className="flex gap-4">
            <div className="flex-1 rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
              <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                未納品分
              </div>
              <div className="text-2xl font-black text-slate-700">{backlog}</div>
            </div>
            <div className="flex items-center text-slate-300">
              <ArrowRight className="h-6 w-6" />
            </div>
            <div className="flex-1 rounded-xl border border-blue-100 bg-blue-50 p-3 text-center ring-2 ring-blue-100 ring-offset-2">
              <div className="text-[10px] font-bold tracking-wider text-blue-500 uppercase">
                今回入庫
              </div>
              <div className="text-2xl font-black text-blue-700">{qty}</div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold text-slate-700 uppercase">
              実際の入庫数
              {isQuantityChanged && (
                <span className="ml-2 text-[10px] font-normal text-orange-500 normal-case">
                  (変更あり)
                </span>
              )}
            </label>
            <input
              type="number"
              min={0}
              value={qty}
              onChange={(e) => onQtyChange(Number.parseInt(e.target.value) || 0)}
              className={`w-full rounded-xl border-2 px-4 py-3 text-xl font-bold transition-all outline-none ${
                isQuantityChanged
                  ? "border-orange-300 bg-orange-50 text-orange-800 focus:border-orange-500"
                  : "border-slate-200 bg-white text-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
              }`}
            />
          </div>

          <div
            className={`overflow-hidden transition-all duration-300 ${isQuantityChanged ? "max-h-40 opacity-100" : "max-h-20 opacity-60"}`}
          >
            <label className="mb-2 block text-xs font-bold text-slate-700 uppercase">
              備考 / 変更理由
              <span
                className={`ml-1 ${isQuantityChanged ? "text-red-500" : "font-normal text-slate-400"}`}
              >
                {isQuantityChanged ? "(必須)" : "(任意)"}
              </span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder={isQuantityChanged ? "例: 在庫不足のため3個のみ納品" : "変更なし"}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 transition-all outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          {error && (
            <div className="animate-in slide-in-from-top-2 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span className="font-bold">{error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={qty < 0}
            className={`flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-bold text-white shadow-lg transition-all ${
              qty < 0
                ? "cursor-not-allowed bg-slate-400 shadow-none"
                : "bg-blue-600 shadow-blue-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-blue-300"
            }`}
          >
            <PackageCheck className="h-4 w-4" />
            確定する
          </button>
        </div>
      </div>
    </div>
  );
};

// --- TRANG CHÍNH ---

const InventoryPage: React.FC = () => {
  const { products, inventory, updateInventory } = useStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [factoryRequests, setFactoryRequests] = useState<FactoryRequest[]>([]);
  const [isLoadingFactoryRequests, setIsLoadingFactoryRequests] = useState<boolean>(true);
  const [businessDate, setBusinessDate] = useState<string>(getCurrentBusinessDate());
  const [isResetDone, setIsResetDone] = useState<boolean>(hasResetTodayInventory());
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [isAutoOrdering, setIsAutoOrdering] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"inventory" | "history">("inventory");

  // Trạng thái của các Modal
  const [requestModal, setRequestModal] = useState({
    isOpen: false,
    target: null as {
      product_id: string;
      product_name: string;
      current_stock: number;
      threshold: number;
    } | null,
    initialQty: 1,
  });
  const [autoOrderModal, setAutoOrderModal] = useState({
    isOpen: false,
    results: [] as AutoOrderCheckResult[],
  });
  const [receiveGoodsModal, setReceiveGoodsModal] = useState({
    isOpen: false,
    target: null as FactoryRequest | null,
    qty: 0,
    note: "",
  });
  const [historyFilters, setHistoryFilters] = useState({
    status: "all",
    date: getLocalBusinessDate(),
    sortBy: "newest",
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmResetAgain, setConfirmResetAgain] = useState(false);

  // --- Các Effect (Tác vụ khởi chạy/theo dõi) ---
  useEffect(() => {
    const fetchCats = async () => {
      try {
        setCategories(await getCategories());
      } catch (e) {
        console.error(e);
      }
    };
    fetchCats();
  }, []);

  useEffect(() => {
    const fetchFactoryRequests = async () => {
      try {
        setIsLoadingFactoryRequests(true);
        const requests = await getFactoryRequestsByDate(historyFilters.date);
        setFactoryRequests(requests);
      } catch (error) {
        console.error(error);
        setFactoryRequests([]);
      } finally {
        setIsLoadingFactoryRequests(false);
      }
    };
    fetchFactoryRequests();
  }, [historyFilters.date]);

  // --- Các Memo (Dữ liệu được tính toán và ghi nhớ) ---
  const mergedData = useMemo(() => {
    return products
      .filter((p) => p.type !== "drink" && p.type !== "alcohol")
      .map((p) => {
        const inv = inventory.find((i) => i.product_id === p.product_id);
        return {
          ...p,
          stock: inv?.current_quantity || 0,
          threshold: inv?.min_threshold || 0,
          lastUpdated: inv?.last_updated,
        };
      })
      .sort((a, b) => a.stock - b.stock);
  }, [products, inventory]);

  const filteredHistoryRequests = useMemo(() => {
    let filtered = factoryRequests.filter((req) => {
      if (historyFilters.status !== "all" && req.status !== historyFilters.status) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [factoryRequests, historyFilters]);

  // --- Các hàm xử lý sự kiện (Handlers) ---
  // Xử lý thay đổi bộ lọc lịch sử: Cập nhật state filter khi người dùng chọn ngày hoặc trạng thái khác.
  const handleHistoryFilterChange = useCallback(
    (filters: { date?: string; sortBy?: string; status?: string }) => {
      setHistoryFilters((prev) => ({ ...prev, ...filters }));
    },
    []
  );

  // Mở modal yêu cầu nhập hàng thủ công: Tính toán số lượng đề xuất
  const openRequestModal = useCallback(
    async (product_id: string, product_name: string, stock: number, threshold: number) => {
      try {
        // Gọi BE để lấy số lượng đề xuất
        const res = await apiRequest<{ quantity: number }>(
          buildApiUrl(`${API_ENDPOINTS.FACTORY_REQUESTS}/suggested-quantity`, {
            productId: product_id,
          })
        );

        const recommended = res.quantity;

        // Mở modal với số BE trả về
        setRequestModal({
          isOpen: true,
          target: {
            product_id,
            product_name,
            current_stock: stock,
            threshold,
          },
          initialQty: recommended,
        });
      } catch (error) {
        console.error("Failed to get suggested quantity", error);
        // Hiển thị lỗi để kiểm tra thay vì tự động điền 10
        toast.error("推奨数量の取得に失敗しました。エラーを確認してください。");
      }
    },
    []
  );

  // Xử lý gửi yêu cầu nhập hàng mới: Kiểm tra trùng lặp (đã có request pending chưa), gửi API tạo request, và cập nhật danh sách hiển thị.
  const handleCreateFactoryRequest = async (data: { qty: number; eta: string; note: string }) => {
    if (!requestModal.target) return;
    const hasActive = factoryRequests.some(
      (r) =>
        r.product_id === requestModal.target!.product_id &&
        r.status !== "CANCELLED" &&
        r.status !== "DELIVERED"
    );
    if (hasActive) {
      toast.error("同じ商品への依頼が既に存在します。");
      return;
    }
    try {
      const { qty, eta, note } = data;
      let etaIso = eta.includes(":") && eta.split(":").length === 2 ? `${eta}:00` : eta;
      const newReq = await createFactoryRequest(
        requestModal.target!.product_id,
        qty,
        etaIso,
        note?.trim() || undefined
      );
      setFactoryRequests((prev) => [newReq, ...prev]);
      setRequestModal((prev) => ({ ...prev, isOpen: false }));
      toast.success("工場への依頼を作成しました");
    } catch (error) {
      toast.error("作成に失敗しました。");
    }
  };

  // Hủy yêu cầu nhập hàng: Gọi API hủy và cập nhật trạng thái trong danh sách local để UI phản hồi ngay.
  const cancelFactoryRequest = async (request_id: string) => {
    try {
      const updatedReq = await updateFactoryRequestStatus(request_id, "CANCELLED");
      setFactoryRequests((prev) => prev.map((r) => (r.request_id === request_id ? updatedReq : r)));
      toast.success("キャンセルしました。");
    } catch (error) {
      toast.error("キャンセルに失敗しました。");
    }
  };

  // Mở dialog xác nhận reset kho: Chỉ đơn giản là bật cờ hiển thị popup xác nhận để tránh bấm nhầm.
  const handleResetDailyInventory = () => setConfirmOpen(true);

  // Logic thực hiện reset kho đầu ngày:
  // 1. Phân loại sản phẩm (Food, Drink, Alcohol).
  // 2. Gọi API reset cho từng nhóm với số lượng mặc định (Food: theo config, Drink/Alcohol: 99).
  // 3. Cập nhật lại store local để UI phản ánh ngay lập tức.
  // 4. Đánh dấu đã reset xong trong ngày để không nhắc lại.
  const resetLogic = async (isRetry = false) => {
    if (isResetDone && !isRetry) {
      setConfirmResetAgain(true);
      setConfirmOpen(false);
      return;
    }
    setConfirmOpen(false);
    setConfirmResetAgain(false);
    setIsResetting(true);
    try {
      const foodIds = products
        .filter((p) => p.type !== "drink" && p.type !== "alcohol")
        .map((p) => p.product_id);
      const drinkIds = products.filter((p) => p.type === "drink").map((p) => p.product_id);
      const alcoholIds = products.filter((p) => p.type === "alcohol").map((p) => p.product_id);
      await resetDailyInventory(foodIds, AUTO_ORDER_CONFIG.DEFAULT_START_QUANTITY);
      foodIds.forEach((id) => updateInventory(id, AUTO_ORDER_CONFIG.DEFAULT_START_QUANTITY));
      if (drinkIds.length > 0) {
        await resetDailyInventory(drinkIds, 9999);
        drinkIds.forEach((id) => updateInventory(id, 9999));
      }
      if (alcoholIds.length > 0) {
        await resetDailyInventory(alcoholIds, 9999);
        alcoholIds.forEach((id) => updateInventory(id, 9999));
      }
      markInventoryResetDone();
      setIsResetDone(true);
      setBusinessDate(getCurrentBusinessDate());
      toast.success(isRetry ? "再リセット完了！" : "在庫リセット完了！");
    } catch (e) {
      toast.error("リセット失敗");
    } finally {
      setIsResetting(false);
    }
  };

  // Kiểm tra tự động đặt hàng (AI Check):
  // Quét toàn bộ sản phẩm, so sánh tồn kho với ngưỡng min, tạo danh sách đề xuất nhập hàng và mở modal kết quả.
  const handleAutoOrderCheck = async () => {
    setIsAutoOrdering(true);
    try {
      const results = await checkAllProductsForAutoOrder(products, inventory);
      setAutoOrderModal({ isOpen: true, results });
    } catch (error) {
      toast.error("チェック失敗");
    } finally {
      setIsAutoOrdering(false);
    }
  };

  // Thực thi đặt hàng tự động hàng loạt:
  // Lọc các sản phẩm được đánh dấu "should_order" từ kết quả check, gọi hàm xử lý hàng loạt, và cập nhật danh sách request.
  const handleExecuteAutoOrder = async () => {
    const productsNeedingOrder = autoOrderModal.results.filter((r) => r.should_order);
    if (productsNeedingOrder.length === 0) return;
    setIsAutoOrdering(true);
    try {
      const result = await executeAutoOrderForAll(productsNeedingOrder);
      if (result.success.length > 0) {
        setFactoryRequests((prev) => [...result.success, ...prev]);
        toast.success(`${result.success.length}件の発注成功`);
      }
      setAutoOrderModal({ isOpen: false, results: [] });
    } catch (error) {
      toast.error("発注失敗");
    } finally {
      setIsAutoOrdering(false);
    }
  };

  // Mở modal nhập hàng (Partial Delivery):
  // Tính toán số lượng còn thiếu (backlog = yêu cầu - đã giao) để điền sẵn vào ô nhập liệu cho tiện.
  const openReceiveGoodsModal = (req: FactoryRequest) => {
    const remaining = req.request_quantity - req.delivered_quantity;
    setReceiveGoodsModal({
      isOpen: true,
      target: req,
      qty: remaining > 0 ? remaining : 0,
      note: "",
    });
  };

  // Xử lý nhập hàng vào kho (Receive Goods):
  // 1. Gửi số lượng thực nhận lên Backend qua API /receive.
  // 2. Backend sẽ tự động cập nhật số lượng đã lĩnh, tùy biến status (PARTIAL/DELIVERED) và cộng kho.
  // 3. Cập nhật lại danh sách local từ kết quả trả về của API.
  const handleReceiveGoods = async () => {
    const { target, qty } = receiveGoodsModal;
    if (!target) return;
    try {
      // Gọi API nhận hàng thực tế (Mới)
      const res = await apiRequest<FactoryRequestResponseDTO>(
        buildApiUrl(`${API_ENDPOINTS.FACTORY_REQUESTS}/${target.request_id}/receive`, {
          deliveredQuantity: qty,
        }),
        { method: "PATCH" }
      );

      const updatedReq = mapFactoryRequestDTOToFactoryRequest(res);

      // Cập nhật UI
      setFactoryRequests((prev) =>
        prev.map((r) => (r.request_id === target.request_id ? updatedReq : r))
      );

      // Cập nhật lại kho ở local Store để UI Inventory thay đổi ngay
      updateInventory(
        updatedReq.product_id,
        (inventory.find((i) => i.product_id === updatedReq.product_id)?.current_quantity ?? 0) + qty
      );

      toast.success(updatedReq.status === "DELIVERED" ? `入庫完了！` : `入庫記録: ${qty}個`);
      setReceiveGoodsModal({ isOpen: false, target: null, qty: 0, note: "" });
    } catch (error) {
      console.error(error);
      toast.error("入庫処理に失敗しました。");
    }
  };

  return (
    <div className="flex h-full flex-col bg-slate-50/50 p-6 font-sans text-slate-800">
      {/* Tiêu đề trang */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-slate-900">
            <Factory className="h-8 w-8 text-orange-600" />
            在庫管理
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm">
              <span className="text-slate-400">営業日:</span>
              <span className="font-mono text-blue-600">{businessDate}</span>
            </div>
            {isResetDone && (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-xs font-bold text-green-700 shadow-sm">
                <CheckCircle2 className="h-4 w-4" />
                リセット完了
              </span>
            )}
          </div>
        </div>

        {/* Bộ chuyển đổi Tab (Kiểu Segmented Control) */}
        <div className="flex rounded-xl bg-slate-200/50 p-1.5 shadow-inner">
          {(["inventory", "history"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-bold transition-all duration-200 ${
                activeTab === tab
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"
              }`}
            >
              {tab === "inventory" ? <Box className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
              {tab === "inventory" ? "在庫一覧" : "発注履歴"}
            </button>
          ))}
        </div>
      </div>

      {/* Khu vực nội dung chính */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "inventory" ? (
          <InventoryTable
            data={mergedData}
            factoryRequests={factoryRequests}
            onOpenRequestModal={openRequestModal}
            handleResetDailyInventory={handleResetDailyInventory}
            isResetting={isResetting}
            handleAutoOrderCheck={handleAutoOrderCheck}
            isAutoOrdering={isAutoOrdering}
          />
        ) : (
          <HistoryTabContent
            requests={filteredHistoryRequests}
            filters={historyFilters}
            onFiltersChange={handleHistoryFilterChange}
            isLoading={isLoadingFactoryRequests}
            onOpenPartialDelivery={openReceiveGoodsModal}
            onCancelRequest={cancelFactoryRequest}
            businessDate={businessDate}
            handleAutoOrderCheck={handleAutoOrderCheck}
            isAutoOrdering={isAutoOrdering}
          />
        )}
      </div>

      {/* Các Modal */}
      <ConfirmDialog
        open={confirmOpen}
        message="本当に新しい日を開始しますか？"
        onConfirm={() => resetLogic(false)}
        onCancel={() => setConfirmOpen(false)}
      />
      <ConfirmDialog
        open={confirmResetAgain}
        message="既にリセット済みです。再実行しますか？"
        onConfirm={() => resetLogic(true)}
        onCancel={() => setConfirmResetAgain(false)}
      />
      <RequestFactoryModal
        key={requestModal.isOpen ? "modal-open" : "modal-closed"}
        isOpen={requestModal.isOpen}
        onClose={() => setRequestModal((prev) => ({ ...prev, isOpen: false }))}
        target={requestModal.target}
        initialQty={requestModal.initialQty}
        onSubmit={handleCreateFactoryRequest}
      />
      <AutoOrderModal
        isOpen={autoOrderModal.isOpen}
        onClose={() => setAutoOrderModal({ isOpen: false, results: [] })}
        results={autoOrderModal.results}
        onSubmit={handleExecuteAutoOrder}
        isSubmitting={isAutoOrdering}
      />
      <ReceiveGoodsModal
        isOpen={receiveGoodsModal.isOpen}
        onClose={() => setReceiveGoodsModal({ isOpen: false, target: null, qty: 0, note: "" })}
        target={receiveGoodsModal.target}
        qty={receiveGoodsModal.qty}
        note={receiveGoodsModal.note}
        onQtyChange={(qty) => setReceiveGoodsModal((prev) => ({ ...prev, qty }))}
        onNoteChange={(note) => setReceiveGoodsModal((prev) => ({ ...prev, note }))}
        onSubmit={handleReceiveGoods}
      />
    </div>
  );
};

export default InventoryPage;
