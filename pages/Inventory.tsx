/**
 * @authors Huynh and Hue
 * @description Trang quản lý tồn kho và lịch sử yêu cầu nhập hàng từ nhà máy.
 */
import React, { useMemo, useState, useEffect, useCallback } from "react";
// Modal xác nhận custom hiển thị ở giữa màn hình
const ConfirmDialog: React.FC<{
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, message, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="bg-opacity-30 fixed inset-0 z-50 flex items-center justify-center bg-black backdrop-blur-sm">
      <div className="max-w-[400px] min-w-[320px] rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-2xl">
        <div className="mb-6 text-lg font-bold text-gray-800">{message}</div>
        <div className="flex justify-center gap-4">
          <button
            className="flex-1 rounded-xl bg-gray-100 px-4 py-3 font-bold text-gray-700 transition-colors hover:bg-gray-200"
            onClick={onCancel}
          >
            いいえ
          </button>
          <button
            className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white shadow-md transition-colors hover:bg-blue-700"
            onClick={onConfirm}
          >
            はい
          </button>
        </div>
      </div>
    </div>
  );
};

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
} from "lucide-react";
import {
  getAllFactoryRequests,
  createFactoryRequest,
  updateFactoryRequestStatus,
  FactoryRequest,
  calculateBacklog,
} from "@/api/factoryRequests";
import {
  adjustInventory,
  resetDailyInventory,
  getCurrentBusinessDate,
  hasResetTodayInventory,
  markInventoryResetDone,
} from "@/api/inventory";
import { ApiError } from "@/api/client";
import toast from "react-hot-toast";
import { getCategories } from "@/api/categories";
import type { Category, AutoOrderCheckResult } from "@/types";
import {
  AUTO_ORDER_CONFIG,
  checkAllProductsForAutoOrder,
  executeAutoOrderForAll,
  formatAutoOrderSchedule,
  getNextAutoOrderCheck,
} from "@/utils/autoOrder";

// Hàm tiện ích: Thêm số phút vào một đối tượng Date
const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60 * 1000);

// Hàm tiện ích: Định dạng ISO date string sang chuỗi ngày giờ theo chuẩn Nhật Bản
const formatJa = (iso: string) =>
  new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Ho_Chi_Minh" });

// #region Sub-components (Các component con)

// Component: Bảng hiển thị danh sách tồn kho
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
}> = ({
  data,
  factoryRequests,
  onOpenRequestModal,
  handleResetDailyInventory,
  isResetting,
  handleAutoOrderCheck,
  isAutoOrdering,
}) => (
  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
    <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4">
      <div className="flex w-full items-center justify-between">
        <h2 className="flex items-center text-base font-bold text-gray-700">
          <TrendingDown className="mr-2 h-5 w-5 text-gray-500" />
          在庫一覧
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDailyInventory}
            disabled={isResetting}
            className={`inline-flex items-center rounded-lg px-4 py-2 text-xs font-semibold transition-all ${isResetting ? "cursor-not-allowed bg-gray-100 text-gray-400" : "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md hover:from-green-600 hover:to-green-700"}`}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isResetting ? "animate-spin" : ""}`} />
            {isResetting ? "リセット中..." : "新しい日を開始"}
          </button>
          <button
            onClick={handleAutoOrderCheck}
            disabled={isAutoOrdering}
            className={`inline-flex items-center rounded-lg px-4 py-2 text-xs font-semibold transition-all ${isAutoOrdering ? "cursor-not-allowed bg-gray-100 text-gray-400" : "bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md hover:from-purple-600 hover:to-purple-700"}`}
          >
            <Zap className={`mr-2 h-4 w-4 ${isAutoOrdering ? "animate-pulse" : ""}`} />
            {isAutoOrdering ? "チェック中..." : "自動発注チェック"}
          </button>
        </div>
      </div>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b-2 border-gray-200 bg-gray-100">
            <th className="w-16 border-r border-gray-200 px-4 py-3 text-center text-xs font-bold tracking-wider text-gray-600 uppercase">
              No.
            </th>
            <th className="min-w-[200px] border-r border-gray-200 px-4 py-3 text-left text-xs font-bold tracking-wider text-gray-600 uppercase">
              商品名
            </th>
            <th className="w-32 border-r border-gray-200 px-4 py-3 text-center text-xs font-bold tracking-wider text-gray-600 uppercase">
              在庫数
            </th>
            <th className="w-44 border-r border-gray-200 px-4 py-3 text-center text-xs font-bold tracking-wider text-gray-600 uppercase">
              最終更新
            </th>
            <th className="w-28 px-4 py-3 text-center text-xs font-bold tracking-wider text-gray-600 uppercase">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => {
            const isLow = item.stock <= item.threshold;
            const hasActiveReq = factoryRequests.some(
              (r) =>
                r.product_id === item.product_id &&
                (r.status === "PENDING" || r.status === "PARTIAL")
            );
            const disabledBtn = !isLow || hasActiveReq;
            let btnTitle = "";
            if (hasActiveReq) btnTitle = "既に依頼があります";
            else if (isLow) btnTitle = "工場へ依頼";
            else btnTitle = "基準値以下で依頼可";

            return (
              <tr
                key={item.product_id}
                className={`border-b border-gray-100 transition-colors hover:bg-blue-50 ${index % 2 === 0 ? "bg-white" : "bg-gray-50/50"} ${isLow ? "bg-red-50/50 hover:bg-red-50" : ""}`}
              >
                <td className="border-r border-gray-100 px-4 py-3 text-center font-mono text-sm text-gray-500">
                  {index + 1}
                </td>
                <td className="border-r border-gray-100 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="h-12 w-12 rounded-lg border border-gray-200 bg-gray-100 object-cover shadow-sm"
                    />
                    <div>
                      <div className="font-medium text-gray-800">{item.name}</div>
                      {isLow && (
                        <span className="mt-0.5 inline-flex items-center text-xs text-red-600">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          補充が必要
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="border-r border-gray-100 px-4 py-3 text-right">
                  <span className={`text-xl font-bold ${isLow ? "text-red-600" : "text-gray-800"}`}>
                    {item.stock}
                  </span>
                  <span className="ml-1 text-xs text-gray-500">個</span>
                </td>
                <td className="border-r border-gray-100 px-4 py-3 text-center font-mono text-xs text-gray-500">
                  {item.lastUpdated
                    ? new Date(item.lastUpdated).toLocaleString("ja-JP", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    disabled={disabledBtn}
                    onClick={() =>
                      onOpenRequestModal(item.product_id, item.name, item.stock, item.threshold)
                    }
                    className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                      !disabledBtn
                        ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md hover:from-orange-600 hover:to-orange-700 hover:shadow-lg"
                        : "cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400"
                    }`}
                    title={btnTitle}
                  >
                    {hasActiveReq && (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin text-orange-500" />
                    )}
                    <Factory className="mr-1.5 h-4 w-4" />
                    依頼
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

// Component: Tab hiển thị lịch sử các yêu cầu nhập hàng
const HistoryTabContent: React.FC<{
  requests: FactoryRequest[];
  filters: { date: string; sortBy: string; status: string };
  onFiltersChange: (filters: { date?: string; sortBy?: string; status?: string }) => void;
  isLoading: boolean;
  onOpenPartialDelivery: (req: FactoryRequest) => void;
  onCancelRequest: (id: string) => void;
  businessDate: string;
}> = ({
  requests,
  filters,
  onFiltersChange,
  isLoading,
  onOpenPartialDelivery,
  onCancelRequest,
  businessDate,
}) => (
  <div className="rounded-xl border border-gray-100 bg-white shadow-lg">
    {/* Thanh filter hiện đại */}
    <div className="flex flex-col gap-4 rounded-t-xl border-b border-gray-100 bg-gray-50 p-6 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2">
        <label htmlFor="historyDateFilter" className="text-xs font-semibold text-gray-600">
          日付:
        </label>
        <input
          type="date"
          id="historyDateFilter"
          value={filters.date}
          onChange={(e) => onFiltersChange({ date: e.target.value })}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        />
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="historyStatusFilter" className="text-xs font-semibold text-gray-600">
          状態:
        </label>
        <select
          id="historyStatusFilter"
          value={filters.status}
          onChange={(e) => onFiltersChange({ status: e.target.value })}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="all">すべて</option>
          <option value="DELIVERED">完了</option>
          <option value="PENDING">発注中</option>
          <option value="CANCELLED">キャンセル</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="historySortBy" className="text-xs font-semibold text-gray-600">
          並替:
        </label>
        <select
          id="historySortBy"
          value={filters.sortBy}
          onChange={(e) => onFiltersChange({ sortBy: e.target.value })}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="newest">新しい順</option>
          <option value="oldest">古い順</option>
          <option value="product">商品名順</option>
        </select>
      </div>
      <div className="mt-2 w-full text-right text-base font-bold text-blue-700 md:mt-0">
        合計: <span className="text-xl">{requests.length}</span> 件
      </div>
    </div>

    {/* Danh sách phát注 dạng card hiện đại */}
    <div className="grid max-h-[65vh] gap-4 overflow-y-auto p-6 md:grid-cols-2 lg:grid-cols-3">
      {isLoading ? (
        <div className="col-span-full py-8 text-center text-gray-500">読み込み中...</div>
      ) : requests.length === 0 ? (
        <div className="col-span-full py-8 text-center text-gray-500">履歴がありません</div>
      ) : (
        requests.map((req) => {
          const backlog = calculateBacklog(req);
          // NOTE: Đã bỏ kiểm tra isToday để cho phép nhập hàng từ những ngày trước
          const canAction = req.status === "PENDING" || req.status === "PARTIAL";

          let statusIcon = null;
          if (req.status === "DELIVERED")
            statusIcon = <CheckCircle2 className="mr-1 h-4 w-4 text-green-500" />;
          else if (req.status === "PENDING")
            statusIcon = <Clock className="mr-1 h-4 w-4 text-yellow-500" />;
          else if (req.status === "PARTIAL")
            statusIcon = <PackageCheck className="mr-1 h-4 w-4 text-orange-500" />;
          else if (req.status === "CANCELLED")
            statusIcon = <X className="mr-1 h-4 w-4 text-gray-400" />;

          return (
            <div
              key={req.request_id}
              className={`relative flex min-h-[140px] flex-col justify-between rounded-xl border bg-white p-5 shadow-sm transition-all hover:shadow-lg ${canAction ? "border-blue-200 bg-blue-50/30" : "border-gray-200"}`}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <span
                    className="line-clamp-1 text-base font-bold text-gray-800"
                    title={req.product_name}
                  >
                    {req.product_name}
                  </span>
                  <span className="text-xs text-gray-500">{formatJa(req.created_at)}</span>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase ${
                    req.status === "PENDING"
                      ? "bg-yellow-100 text-yellow-800"
                      : req.status === "PARTIAL"
                        ? "bg-orange-100 text-orange-800"
                        : req.status === "DELIVERED"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {statusIcon}
                  {req.status === "PENDING" && "発注中"}
                  {req.status === "PARTIAL" && `残り${backlog}`}
                  {req.status === "DELIVERED" && "完了"}
                  {req.status === "CANCELLED" && "取消"}
                </span>
              </div>

              <div className="mb-4 flex items-center justify-between rounded-lg border border-gray-100 bg-white/60 p-2">
                <div className="text-center">
                  <div className="text-[10px] font-bold text-gray-400 uppercase">依頼数</div>
                  <div className="text-lg font-bold text-gray-800">{req.request_quantity}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-300" />
                <div className="text-center">
                  <div className="text-[10px] font-bold text-gray-400 uppercase">受取済</div>
                  <div
                    className={`text-lg font-bold ${req.delivered_quantity > 0 ? "text-green-600" : "text-gray-400"}`}
                  >
                    {req.delivered_quantity}
                  </div>
                </div>
              </div>

              {canAction && (
                <div className="mt-auto grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onCancelRequest(req.request_id)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-50 hover:text-red-500"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={() => onOpenPartialDelivery(req)}
                    className="flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg"
                  >
                    <PackageCheck className="mr-1.5 h-3.5 w-3.5" />
                    入庫 (検品)
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  </div>
);

// Component: Modal tạo yêu cầu nhập hàng
const RequestFactoryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  target: { product_name: string; current_stock: number; threshold: number } | null;
  qty: number;
  eta: string;
  note: string;
  onQtyChange: (qty: number) => void;
  onEtaChange: (eta: string) => void;
  onNoteChange: (note: string) => void;
  onSubmit: () => void;
}> = ({
  isOpen,
  onClose,
  target,
  qty,
  eta,
  note,
  onQtyChange,
  onEtaChange,
  onNoteChange,
  onSubmit,
}) => {
  if (!isOpen || !target) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="animate-in fade-in zoom-in-95 w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl duration-200">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4">
          <div>
            <div className="text-lg font-bold text-gray-800">工場へ追加焼成を依頼</div>
            <div className="mt-1 text-xs text-gray-500">
              対象商品: <span className="font-semibold text-gray-700">{target.product_name}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-200"
            aria-label="close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="text-xs font-bold text-gray-500 uppercase">現在在庫</div>
              <div className="mt-1 text-2xl font-bold text-gray-800">{target.current_stock}</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="text-xs font-bold text-gray-500 uppercase">基準値 (Min)</div>
              <div className="mt-1 text-2xl font-bold text-gray-800">{target.threshold}</div>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-700 uppercase">依頼数量</label>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => onQtyChange(Number.parseInt(e.target.value) || 1)}
              className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-lg font-bold text-gray-800 transition-all outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-700 uppercase">到着予定</label>
            <input
              type="datetime-local"
              value={eta}
              onChange={(e) => onEtaChange(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-700 uppercase">メモ（任意）</label>
            <textarea
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
              rows={2}
              placeholder="例）急ぎ、追加で10個お願いします"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100"
          >
            キャンセル
          </button>
          <button
            onClick={onSubmit}
            className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-200 transition-all hover:bg-orange-700 hover:shadow-none"
          >
            依頼を送信
          </button>
        </div>
      </div>
    </div>
  );
};

// Component: Modal kiểm tra đặt hàng tự động
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="animate-in zoom-in-95 max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4">
          <div>
            <div className="flex items-center gap-2 text-lg font-bold text-gray-800">
              <Zap className="h-5 w-5 fill-orange-500 text-orange-500" />
              自動発注チェック結果
            </div>
            <div className="mt-1 text-xs text-gray-500">在庫不足商品を検出しました</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-200"
            aria-label="close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[50vh] space-y-3 overflow-y-auto bg-gray-50/50 p-6">
          {sortedResults.map((result) => (
            <div
              key={result.product_id}
              className={`rounded-xl border p-4 transition-all ${result.should_order ? "border-orange-200 bg-white shadow-sm" : "border-gray-200 bg-gray-100 opacity-60"}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-gray-800">{result.product_name}</div>
                  <div className="mt-1 flex gap-2 text-xs text-gray-500">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5">
                      在庫: {result.current_stock}
                    </span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5">
                      基準: {result.reorder_point}
                    </span>
                  </div>
                </div>
                {result.should_order ? (
                  <div className="text-right">
                    <div className="inline-flex items-center rounded-lg border border-orange-100 bg-orange-50 px-3 py-1.5 text-sm font-bold text-orange-700">
                      発注推奨: {result.suggested_quantity}個
                    </div>
                  </div>
                ) : (
                  <div className="text-xs font-medium text-gray-400">{result.skip_reason}</div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-6 py-4">
          <div className="text-sm font-bold text-gray-600">
            発注対象: <span className="ml-1 text-xl text-orange-600">{productsToOrder.length}</span>{" "}
            件
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100"
            >
              閉じる
            </button>
            <button
              onClick={onSubmit}
              disabled={productsToOrder.length === 0 || isSubmitting}
              className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all ${
                productsToOrder.length === 0 || isSubmitting
                  ? "cursor-not-allowed bg-gray-300 shadow-none"
                  : "bg-orange-600 shadow-orange-200 hover:bg-orange-700 hover:shadow-none"
              }`}
            >
              {isSubmitting ? "処理中..." : "一括発注を実行"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Component: Modal xử lý nhập kho (Check-in hàng)
// Được thiết kế lại để cho phép nhập số lượng thực tế và lý do nếu có chênh lệch
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

  // Tính số lượng còn thiếu cần nhập
  const backlog = calculateBacklog(target);
  const isQuantityChanged = qty !== backlog;

  const handleSubmit = () => {
    // Validation: Nếu nhập số lượng khác với số lượng còn lại, bắt buộc phải có lý do
    if (isQuantityChanged && (!note || note.trim() === "")) {
      setError("数量が変更されています。理由を入力してください。");
      return;
    }
    setError("");
    onSubmit();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="animate-in fade-in zoom-in-95 w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl duration-200">
        <div className="border-b border-gray-100 bg-blue-50/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800">
              <PackageCheck className="h-5 w-5 text-blue-600" />
              入庫処理 (検品)
            </h3>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-1 text-sm font-medium text-blue-700">{target.product_name}</div>
        </div>

        <div className="space-y-6 p-6">
          {/* Thông tin so sánh */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center">
              <div className="text-xs font-bold text-gray-400 uppercase">未納品分</div>
              <div className="text-2xl font-black text-gray-700">{backlog}</div>
            </div>
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-center">
              <div className="text-xs font-bold text-blue-400 uppercase">今回入庫</div>
              <div className="text-2xl font-black text-blue-700">{qty}</div>
            </div>
          </div>

          {/* Input số lượng thực tế */}
          <div>
            <label className="mb-2 block text-xs font-bold text-gray-700 uppercase">
              実際の入庫数 (変更可能)
            </label>
            <div className="relative">
              <input
                type="number"
                min={0}
                value={qty}
                onChange={(e) => onQtyChange(Number.parseInt(e.target.value) || 0)}
                className={`w-full rounded-xl border-2 px-4 py-3 text-xl font-bold transition-colors outline-none ${
                  isQuantityChanged
                    ? "border-orange-300 bg-orange-50 text-orange-800 focus:border-orange-500"
                    : "border-gray-200 bg-white text-gray-800 focus:border-blue-500"
                }`}
              />
              <span className="absolute top-1/2 right-4 -translate-y-1/2 text-sm font-bold text-gray-400">
                個
              </span>
            </div>
            {isQuantityChanged && (
              <div className="mt-2 flex items-center gap-1 text-xs font-bold text-orange-600">
                <AlertTriangle className="h-3 w-3" />
                注文残数と異なります
              </div>
            )}
          </div>

          {/* Input lý do (Chỉ hiện/bắt buộc khi thay đổi số lượng) */}
          <div
            className={`transition-all duration-300 ${isQuantityChanged ? "max-h-40 opacity-100" : "max-h-40 opacity-50 grayscale"}`}
          >
            <label className="mb-2 block text-xs font-bold text-gray-700 uppercase">
              備考 / 変更理由{" "}
              <span className="text-red-500">{isQuantityChanged ? "(必須)" : "(任意)"}</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              disabled={!isQuantityChanged}
              placeholder={isQuantityChanged ? "例: 在庫不足のため3個のみ納品" : "変更なし"}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-400"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-600">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-100"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={qty < 0}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 hover:shadow-none disabled:opacity-50 disabled:shadow-none"
          >
            <PackageCheck className="h-4 w-4" />
            入庫を確定
          </button>
        </div>
      </div>
    </div>
  );
};
//#endregion

// Component chính: Trang quản lý tồn kho
const InventoryPage: React.FC = () => {
  // Lấy dữ liệu global từ Store (Zustand)
  const { products, inventory, updateInventory } = useStore();

  // State local của trang
  const [categories, setCategories] = useState<Category[]>([]);
  const [factoryRequests, setFactoryRequests] = useState<FactoryRequest[]>([]);
  const [isLoadingFactoryRequests, setIsLoadingFactoryRequests] = useState<boolean>(true);
  const [businessDate, setBusinessDate] = useState<string>(getCurrentBusinessDate());
  const [isResetDone, setIsResetDone] = useState<boolean>(hasResetTodayInventory());
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [isAutoOrdering, setIsAutoOrdering] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"inventory" | "history">("inventory");

  // State quản lý các modal
  const [requestModal, setRequestModal] = useState({
    isOpen: false,
    target: null as {
      product_id: string;
      product_name: string;
      current_stock: number;
      threshold: number;
    } | null,
    qty: 10,
    note: "",
    eta: addMinutes(new Date(), 5).toISOString().slice(0, 16),
  });
  const [autoOrderModal, setAutoOrderModal] = useState({
    isOpen: false,
    results: [] as AutoOrderCheckResult[],
  });

  // State cho modal nhập kho (Receive Goods)
  const [receiveGoodsModal, setReceiveGoodsModal] = useState({
    isOpen: false,
    target: null as FactoryRequest | null,
    qty: 0,
    note: "",
  });

  // State quản lý bộ lọc cho tab lịch sử
  const [historyFilters, setHistoryFilters] = useState({
    status: "all",
    date: new Date().toISOString().split("T")[0],
    sortBy: "newest",
  });

  // Fetch dữ liệu ban đầu
  useEffect(() => {
    const fetchCats = async () => {
      try {
        setCategories(await getCategories());
      } catch (e) {
        console.error("Failed to load categories:", e);
      }
    };
    fetchCats();
  }, []);

  useEffect(() => {
    const fetchFactoryRequests = async () => {
      try {
        setIsLoadingFactoryRequests(true);
        const requests = await getAllFactoryRequests();
        setFactoryRequests(requests);
      } catch (error) {
        console.error("Failed to fetch factory requests:", error);
        setFactoryRequests([]);
      } finally {
        setIsLoadingFactoryRequests(false);
      }
    };
    fetchFactoryRequests();
  }, []);

  // #region Memoized Data

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
      const reqDateStr = req.business_date || req.created_at.split("T")[0];
      if (reqDateStr !== historyFilters.date) return false;
      if (historyFilters.status !== "all" && req.status !== historyFilters.status) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      switch (historyFilters.sortBy) {
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "product":
          return a.product_name.localeCompare(b.product_name, "ja");
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }, [factoryRequests, historyFilters]);

  // #endregion

  // #region Handlers

  const handleHistoryFilterChange = useCallback((filters: { date?: string; sortBy?: string }) => {
    setHistoryFilters((prev) => ({ ...prev, ...filters }));
  }, []);

  const openRequestModal = useCallback(
    (product_id: string, product_name: string, stock: number, threshold: number) => {
      const recommended = Math.max(1, threshold * 2 - stock);
      setRequestModal({
        isOpen: true,
        target: { product_id, product_name, current_stock: stock, threshold },
        qty: recommended || 10,
        note: "",
        eta: addMinutes(new Date(), 5).toISOString().slice(0, 16),
      });
    },
    []
  );

  const handleCreateFactoryRequest = async () => {
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
      const { target, qty, eta, note } = requestModal;
      let etaIso = eta.includes(":") && eta.split(":").length === 2 ? `${eta}:00` : eta;
      const newReq = await createFactoryRequest(
        target!.product_id,
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

  const cancelFactoryRequest = async (request_id: string) => {
    try {
      const updatedReq = await updateFactoryRequestStatus(request_id, "CANCELLED");
      setFactoryRequests((prev) => prev.map((r) => (r.request_id === request_id ? updatedReq : r)));
      toast.success("キャンセルしました。");
    } catch (error) {
      toast.error("キャンセルに失敗しました。");
    }
  };

  // Reset logic
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmResetAgain, setConfirmResetAgain] = useState(false);

  const handleResetDailyInventory = () => setConfirmOpen(true);

  const doResetDailyInventory = async () => {
    if (isResetDone) {
      setConfirmResetAgain(true);
      setConfirmOpen(false);
      return;
    }
    setConfirmOpen(false);
    setIsResetting(true);
    try {
      const ids = products
        .filter((p) => p.type !== "drink" && p.type !== "alcohol")
        .map((p) => p.product_id);
      await resetDailyInventory(ids, AUTO_ORDER_CONFIG.DEFAULT_START_QUANTITY);
      ids.forEach((id) => updateInventory(id, AUTO_ORDER_CONFIG.DEFAULT_START_QUANTITY));
      markInventoryResetDone();
      setIsResetDone(true);
      setBusinessDate(getCurrentBusinessDate());
      toast.success("在庫リセット完了！");
    } catch (error) {
      toast.error("リセット失敗");
    } finally {
      setIsResetting(false);
    }
  };

  const doResetAgain = async () => {
    setConfirmResetAgain(false);
    setIsResetting(true);
    try {
      const ids = products
        .filter((p) => p.type !== "drink" && p.type !== "alcohol")
        .map((p) => p.product_id);
      await resetDailyInventory(ids, AUTO_ORDER_CONFIG.DEFAULT_START_QUANTITY);
      ids.forEach((id) => updateInventory(id, AUTO_ORDER_CONFIG.DEFAULT_START_QUANTITY));
      markInventoryResetDone();
      setIsResetDone(true);
      setBusinessDate(getCurrentBusinessDate());
      toast.success("再リセット完了！");
    } catch (error) {
      toast.error("リセット失敗");
    } finally {
      setIsResetting(false);
    }
  };

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

  // --- LOGIC NHẬP KHO (QUAN TRỌNG) ---
  const openReceiveGoodsModal = (req: FactoryRequest) => {
    // Mặc định nhập số lượng còn lại
    const remaining = req.request_quantity - req.delivered_quantity;
    setReceiveGoodsModal({
      isOpen: true,
      target: req,
      qty: remaining > 0 ? remaining : 0,
      note: "",
    });
  };

  const handleReceiveGoods = async () => {
    const { target, qty, note } = receiveGoodsModal;
    if (!target) return;

    try {
      // 1. Cập nhật tồn kho DB và Store (Cộng thẳng số lượng vừa nhập vào kho)
      const currentStock =
        inventory.find((i) => i.product_id === target.product_id)?.current_quantity ?? 0;
      await adjustInventory(target.product_id, currentStock + qty);
      updateInventory(target.product_id, currentStock + qty);

      // 2. Tính toán tổng số lượng đã giao
      const newDeliveredQty = target.delivered_quantity + qty;

      // 3. Quyết định trạng thái: Nếu đã nhận đủ hoặc hơn -> DELIVERED, ngược lại là PARTIAL
      const newStatus = newDeliveredQty >= target.request_quantity ? "DELIVERED" : "PARTIAL";

      // 4. Lưu vào DB (Gửi kèm note nếu API hỗ trợ, hoặc chỉ log)
      // *Lưu ý: API updateFactoryRequestStatus có thể cần update thêm để nhận note nếu backend hỗ trợ.
      // Ở đây giả định ta cập nhật trạng thái và số lượng.
      const updatedReq = await updateFactoryRequestStatus(target.request_id, newStatus);

      // Update local state
      setFactoryRequests((prev) =>
        prev.map((r) =>
          r.request_id === target.request_id
            ? { ...updatedReq, delivered_quantity: newDeliveredQty }
            : r
        )
      );

      toast.success(
        newStatus === "DELIVERED"
          ? `入庫完了！ (全数納品)`
          : `入庫記録: ${qty}個 (残${target.request_quantity - newDeliveredQty})`
      );
      setReceiveGoodsModal({ isOpen: false, target: null, qty: 0, note: "" });
    } catch (error) {
      console.error("Failed to process receive goods:", error);
      toast.error("入庫処理に失敗しました。");
    }
  };

  //#endregion

  const { isNow: isAutoOrderTime, hour: nextCheckHour } = getNextAutoOrderCheck(
    new Date().getHours()
  );

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-8 font-sans">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">在庫管理</h1>
            <div className="mt-2 flex items-center gap-4">
              <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm font-bold text-gray-500">
                営業日: <span className="text-blue-600">{businessDate}</span>
              </span>
              {isResetDone && (
                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700">
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                  リセット済み
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="mt-6 flex border-b border-gray-200">
          {(["inventory", "history"] as const).map((tab) => (
            <button
              key={tab}
              className={`rounded-t-lg px-8 py-3 text-sm font-bold transition-all focus:outline-none ${
                activeTab === tab
                  ? "border-b-2 border-blue-600 bg-white text-blue-600 shadow-sm"
                  : "border-b-2 border-transparent text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "inventory" ? "在庫一覧" : "発注履歴"}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "inventory" && (
        <InventoryTable
          data={mergedData}
          factoryRequests={factoryRequests}
          onOpenRequestModal={openRequestModal}
          handleResetDailyInventory={handleResetDailyInventory}
          isResetting={isResetting}
          handleAutoOrderCheck={handleAutoOrderCheck}
          isAutoOrdering={isAutoOrdering}
        />
      )}

      {activeTab === "history" && (
        <HistoryTabContent
          requests={filteredHistoryRequests}
          filters={historyFilters}
          onFiltersChange={handleHistoryFilterChange}
          isLoading={isLoadingFactoryRequests}
          onOpenPartialDelivery={openReceiveGoodsModal}
          onCancelRequest={cancelFactoryRequest}
          businessDate={businessDate}
        />
      )}

      {/* Dialogs & Modals */}
      <ConfirmDialog
        open={confirmOpen}
        message="本当に新しい日を開始しますか？"
        onConfirm={doResetDailyInventory}
        onCancel={() => setConfirmOpen(false)}
      />
      <ConfirmDialog
        open={confirmResetAgain}
        message="既にリセット済みです。再実行しますか？"
        onConfirm={doResetAgain}
        onCancel={() => setConfirmResetAgain(false)}
      />

      <RequestFactoryModal
        isOpen={requestModal.isOpen}
        onClose={() => setRequestModal((prev) => ({ ...prev, isOpen: false }))}
        {...requestModal}
        onQtyChange={(qty) => setRequestModal((prev) => ({ ...prev, qty }))}
        onEtaChange={(eta) => setRequestModal((prev) => ({ ...prev, eta }))}
        onNoteChange={(note) => setRequestModal((prev) => ({ ...prev, note }))}
        onSubmit={handleCreateFactoryRequest}
      />

      <AutoOrderModal
        isOpen={autoOrderModal.isOpen}
        onClose={() => setAutoOrderModal({ isOpen: false, results: [] })}
        results={autoOrderModal.results}
        onSubmit={handleExecuteAutoOrder}
        isSubmitting={isAutoOrdering}
      />

      {/* Modal Nhập kho (Receive Goods) */}
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
