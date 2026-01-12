/**
 * @authors Huynh and Hue
 */

// Trang quản lý tồn kho và yêu cầu nhập hàng từ nhà máy
import React, { useMemo, useState, useEffect } from "react";
import { useStore } from "@/store/StoreContext";
import { Edit2, Save, X, Factory, PackageCheck, ClipboardList } from "lucide-react";
import {
  getAllFactoryRequests,
  createFactoryRequest,
  updateFactoryRequestStatus,
  FactoryRequest,
} from "@/api/factoryRequests";
import { adjustInventory } from "@/api/inventory";
import { ApiError } from "@/api/client";
import toast from "react-hot-toast";
import Loading from "@/components/Loading";
import { getCategories } from "@/api/categories";
import type { Category } from "@/types";

// Cộng thêm phút vào Date (tính ETA mặc định)
const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60 * 1000);

const InventoryPage: React.FC = () => {
  // Lấy dữ liệu từ Store
  const { products, inventory, updateInventory } = useStore();

  // Danh mục sản phẩm
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    let mounted = true;
    const fetchCats = async () => {
      try {
        const data = await getCategories();
        if (mounted) setCategories(data);
      } catch (e) {
        console.error("Failed to load categories:", e);
      }
    };
    fetchCats();
    return () => {
      mounted = false;
    };
  }, []);

  // Map category_id → tên danh mục
  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.category_id, c.name])),
    [categories]
  );

  // ===== State chỉnh sửa tồn kho (Inline Edit) =====
  const [editingId, setEditingId] = useState<string | null>(null); // ID sản phẩm đang sửa
  const [editValue, setEditValue] = useState<number>(0); // Giá trị tạm

  // ===== State yêu cầu nhà máy =====
  const [factoryRequests, setFactoryRequests] = useState<FactoryRequest[]>([]); // Danh sách yêu cầu
  const [isLoadingFactoryRequests, setIsLoadingFactoryRequests] = useState<boolean>(true);
  const [requestModalOpen, setRequestModalOpen] = useState(false); // Đóng/mở modal
  const [requestTarget, setRequestTarget] = useState<{
    // Sản phẩm được chọn cho modal
    product_id: string;
    product_name: string;
    current_stock: number;
    threshold: number;
  } | null>(null);

  // State form modal
  const [requestQty, setRequestQty] = useState<number>(10); // Số lượng yêu cầu
  const [requestNote, setRequestNote] = useState<string>(""); // Ghi chú
  const [requestEta, setRequestEta] = useState<string>(() =>
    // ETA mặc định 5 phút
    addMinutes(new Date(), 5).toISOString().slice(0, 16)
  );

  // Kết hợp products + inventory để hiển thị bảng
  const mergedData = useMemo(() => {
    return products.map((p) => {
      const inv = inventory.find((i) => i.product_id === p.product_id);
      return {
        ...p,
        stock: inv?.current_quantity || 0,
        threshold: inv?.min_threshold || 0,
        lastUpdated: inv?.last_updated,
      };
    });
  }, [products, inventory]);

  // Bắt đầu chỉnh sửa inline
  const startEdit = (id: string, current: number) => {
    setEditingId(id);
    setEditValue(current);
  };

  useEffect(() => {
    const fetchFactoryRequests = async () => {
      try {
        setIsLoadingFactoryRequests(true);
        const requests = await getAllFactoryRequests();
        setFactoryRequests(requests);
      } catch (error) {
        console.error("Failed to fetch factory requests:", error);
        if (error instanceof ApiError) {
          console.error("API Error:", error.status, error.response);
        }
        setFactoryRequests([]);
      } finally {
        setIsLoadingFactoryRequests(false);
      }
    };

    fetchFactoryRequests();
  }, []);

  // Lưu chỉnh sửa và gọi API
  const saveEdit = async (id: string) => {
    try {
      await adjustInventory(id, editValue);
      // Refresh inventory from StoreContext (it will fetch from API)
      updateInventory(id, editValue);
      setEditingId(null);
    } catch (error) {
      console.error("Failed to update inventory:", error);
      if (error instanceof ApiError) {
        const errorMessage =
          typeof error.response === "string"
            ? error.response
            : error.response?.message || error.message;
        toast.error(`在庫の更新に失敗しました: ${errorMessage}`);
      } else {
        toast.error("サーバーに接続できません。再度お試しください。");
      }
    }
  };

  // Mở modal tạo yêu cầu mới
  const openRequestModal = (
    product_id: string,
    product_name: string,
    stock: number,
    threshold: number
  ) => {
    setRequestTarget({
      product_id,
      product_name,
      current_stock: stock,
      threshold,
    });

    // Gợi ý số lượng: (threshold * 2) - stock, tối thiểu 1
    const recommended = Math.max(1, threshold * 2 - stock);

    setRequestQty(recommended || 10);
    setRequestNote("");
    setRequestEta(addMinutes(new Date(), 5).toISOString().slice(0, 16));
    setRequestModalOpen(true);
  };

  // Tạo yêu cầu nhập hàng mới
  const handleCreateFactoryRequest = async () => {
    if (!requestTarget) return;

    // Prevent duplicate active requests for the same product
    const hasActive = factoryRequests.some(
      (r) =>
        r.product_id === requestTarget.product_id &&
        r.status !== "CANCELLED" &&
        r.status !== "DELIVERED"
    );
    if (hasActive) {
      toast.error(
        "同じ商品への依頼が既に存在します。キャンセルまたは納品されるまで新しい依頼は作成できません。"
      );
      return;
    }

    try {
      const qty = Number.isFinite(requestQty) ? Math.max(1, requestQty) : 1;

      // Convert datetime-local format to ISO string without timezone
      // Backend expects LocalDateTime format: "yyyy-MM-ddTHH:mm:ss"
      // datetime-local format is already "yyyy-MM-ddTHH:mm", just add ":00" for seconds
      let etaIso = requestEta;
      if (!etaIso.includes(":")) {
        // Fallback: if format is wrong, use Date object
        const date = new Date(requestEta);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        etaIso = `${year}-${month}-${day}T${hours}:${minutes}:00`;
      } else if (etaIso.split(":").length === 2) {
        // If format is "yyyy-MM-ddTHH:mm", add ":00" for seconds
        etaIso = `${etaIso}:00`;
      }

      const newReq = await createFactoryRequest(
        requestTarget.product_id,
        qty,
        etaIso,
        requestNote?.trim() || undefined
      );

      setFactoryRequests((prev) => [newReq, ...prev]); // Thêm vào đầu danh sách
      setRequestModalOpen(false);
      setRequestTarget(null);
      toast.success("工場への依頼を作成しました");
    } catch (error) {
      console.error("Failed to create factory request:", error);
      if (error instanceof ApiError) {
        const errorMessage =
          typeof error.response === "string"
            ? error.response
            : error.response?.message || error.message;
        toast.error(`工場依頼の作成に失敗しました: ${errorMessage}`);
      } else {
        toast.error("サーバーに接続できません。再度お試しください。");
      }
    }
  };

  // Hủy yêu cầu (status → CANCELLED)
  const cancelFactoryRequest = async (request_id: string) => {
    try {
      const updatedReq = await updateFactoryRequestStatus(request_id, "CANCELLED");
      setFactoryRequests((prev) => prev.map((r) => (r.request_id === request_id ? updatedReq : r)));
      toast.success("工場への依頼をキャンセルしました。");
    } catch (error) {
      console.error("Failed to cancel factory request:", error);
      if (error instanceof ApiError) {
        const errorMessage =
          typeof error.response === "string"
            ? error.response
            : error.response?.message || error.message;
        toast.error(`工場依頼のキャンセルに失敗しました: ${errorMessage}`);
      } else {
        toast.error("サーバーに接続できません。再度お試しください。");
      }
    }
  };

  // Xác nhận nhận hàng và cập nhật tồn kho
  const markDeliveredAndApplyStock = async (req: FactoryRequest) => {
    try {
      const latest = mergedData.find((m) => m.product_id === req.product_id);
      const currentStock = latest?.stock ?? 0;
      const newStock = currentStock + req.request_quantity;

      // Update inventory via API
      await adjustInventory(req.product_id, newStock);

      // Update local state
      updateInventory(req.product_id, newStock);

      // Update factory request status via API
      const updatedReq = await updateFactoryRequestStatus(req.request_id, "DELIVERED");
      setFactoryRequests((prev) =>
        prev.map((r) => (r.request_id === req.request_id ? updatedReq : r))
      );
      toast.success("納品を確認し、在庫を更新しました！");
    } catch (error) {
      console.error("Failed to mark delivered and apply stock:", error);
      if (error instanceof ApiError) {
        const errorMessage =
          typeof error.response === "string"
            ? error.response
            : error.response?.message || error.message;
        toast.error(`納品処理に失敗しました: ${errorMessage}`);
      } else {
        toast.error("サーバーに接続できません。再度お試しください。");
      }
    }
  };

  // Format ngày giờ theo timezone VN
  const formatJa = (iso: string) =>
    new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Ho_Chi_Minh" });

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">在庫管理</h1>
          <p className="mt-1 text-xs text-gray-500">
            店舗在庫が基準値を下回ったら、工場へ追加焼成を依頼（徒歩約5分で納品）
          </p>
        </div>

        {/* Badge đếm yêu cầu PENDING - Ẩn tạm để mở rộng sau */}
        {/* <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-600">
            <ClipboardList className="mr-2 h-4 w-4" />
            依頼中: {factoryRequests.filter((r) => r.status === "PENDING").length}
          </span>
        </div> */}
      </div>

      {/* Bỏ grid 3 cột, chỉ dùng 1 cột full width vì ẩn phần 工場依頼一覧 */}
      <div className="grid grid-cols-1 gap-6">
        {/* ===== Bảng Tồn kho (Inventory Table) - Full Width ===== */}
        <div>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-4">商品名</th>
                  <th className="hidden px-6 py-4">カテゴリー</th>
                  <th className="px-6 py-4">在庫</th>
                  <th className="px-6 py-4">最終更新</th>
                  <th className="px-6 py-4">工場依頼</th>
                  <th className="px-6 py-4">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mergedData.map((item) => {
                  // Chỉ quản lý tồn kho cho bánh (không phải drink/alcohol)
                  const isStockManaged = item.type !== "drink" && item.type !== "alcohol";
                  // Cảnh báo khi tồn kho <= ngưỡng
                  const isLow = isStockManaged && item.stock <= item.threshold;

                  return (
                    <tr key={item.product_id} className="transition-colors hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <img
                            src={item.image_url}
                            alt=""
                            className="mr-3 h-10 w-10 rounded bg-gray-100 object-cover"
                          />
                          <div>
                            <div className="font-medium text-gray-800">{item.name}</div>
                          </div>
                        </div>
                      </td>

                      <td className="hidden px-6 py-4 text-gray-500">
                        <span className="rounded bg-gray-100 px-2 py-1 text-xs">
                          {categoryMap[item.category_id] ?? item.category_id ?? "-"}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        {editingId === item.product_id ? (
                          <div className="flex items-center">
                            <input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                              className="border-brand-300 ring-brand-500 w-20 rounded border p-1 text-center ring-1 outline-none"
                            />
                          </div>
                        ) : (
                          <span className={`font-bold ${isLow ? "text-red-600" : "text-gray-700"}`}>
                            {item.stock}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-xs text-gray-400">
                        {item.lastUpdated
                          ? new Date(item.lastUpdated).toLocaleString("ja-JP", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </td>

                      {/* Nút yêu cầu nhà máy */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {!isStockManaged ? (
                          <span className="text-xs text-gray-400 italic">対象外</span>
                        ) : (
                          (() => {
                            const hasActiveReq = factoryRequests.some(
                              (r) =>
                                r.product_id === item.product_id &&
                                r.status !== "CANCELLED" &&
                                r.status !== "DELIVERED"
                            );
                            const disabledBtn = !isLow || hasActiveReq;
                            return (
                              <button
                                disabled={disabledBtn}
                                onClick={() =>
                                  openRequestModal(
                                    item.product_id,
                                    item.name,
                                    item.stock,
                                    item.threshold
                                  )
                                }
                                className={[
                                  "inline-flex items-center rounded-lg border px-3 py-2 text-xs font-semibold transition",
                                  !disabledBtn
                                    ? "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                                    : "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400",
                                ].join(" ")}
                                title={
                                  hasActiveReq
                                    ? "既に依頼があります。キャンセルまたは納品されるまで新しい依頼は作成できません。"
                                    : isLow
                                      ? "工場へ追加焼成を依頼"
                                      : "基準値以下になったら依頼できます"
                                }
                              >
                                <Factory className="mr-2 h-4 w-4" />
                                依頼
                              </button>
                            );
                          })()
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingId === item.product_id ? (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => saveEdit(item.product_id)}
                              className="rounded p-1 text-green-600 hover:bg-green-50"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="rounded p-1 text-gray-400 hover:bg-gray-100"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(item.product_id, item.stock)}
                            className="text-brand-600 hover:text-brand-800 flex items-center text-xs font-medium"
                          >
                            <Edit2 className="mr-1 h-3 w-3" /> 調整
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ===== Cột Phải: Danh sách Lịch sử Yêu cầu (Request List) - Ẩn tạm để mở rộng sau ===== */}
        {/* <div className="xl:col-span-1">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div className="flex items-center font-semibold text-gray-800">
                <ClipboardList className="mr-2 h-4 w-4" />
                工場依頼一覧
              </div>
              <span className="text-xs text-gray-500">徒歩約5分で納品</span>
            </div>

            <div className="max-h-[520px] space-y-3 overflow-y-auto p-4">
              {isLoadingFactoryRequests ? (
                <div className="flex items-center justify-center py-8">
                  <Loading size="sm" message="Loading requests..." />
                </div>
              ) : factoryRequests.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                  依頼はまだありません。
                  <br />
                  在庫が基準値以下になると「工場へ依頼」ボタンが有効になります。
                </div>
              ) : (
                factoryRequests.map((req) => (
                  <div
                    key={req.request_id}
                    className="rounded-xl border border-gray-200 p-4 transition hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-800">
                          {req.product_name}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          数量:{" "}
                          <span className="font-semibold text-gray-700">
                            {req.request_quantity}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          依頼: {formatJa(req.created_at)}
                        </div>
                        {req.note && (
                          <div className="mt-2 text-xs text-gray-500">メモ: {req.note}</div>
                        )}
                      </div>

                      <div className="text-xs">
                        {req.status === "PENDING" && (
                          <span className="rounded border border-orange-200 bg-orange-50 px-2 py-1 text-orange-700">
                            依頼中
                          </span>
                        )}
                        {req.status === "DELIVERED" && (
                          <span className="rounded border border-green-200 bg-green-50 px-2 py-1 text-green-700">
                            納品済
                          </span>
                        )}
                        {req.status === "CANCELLED" && (
                          <span className="rounded border border-gray-200 bg-gray-100 px-2 py-1 text-gray-500">
                            キャンセル
                          </span>
                        )}
                      </div>
                    </div>

                    {req.status === "PENDING" && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => markDeliveredAndApplyStock(req)}
                          className="inline-flex flex-1 items-center justify-center rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 transition hover:bg-green-100"
                        >
                          <PackageCheck className="mr-2 h-4 w-4" />
                          受領（在庫に反映）
                        </button>
                        <button
                          onClick={() => cancelFactoryRequest(req.request_id)}
                          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-100"
                        >
                          キャンセル
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div> */}
      </div>

      {/* ===== Modal Tạo Yêu cầu Mới ===== */}
      {requestModalOpen && requestTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <div className="text-lg font-bold text-gray-800">工場へ追加焼成を依頼</div>
                <div className="mt-1 text-xs text-gray-500">
                  対象商品:{" "}
                  <span className="font-semibold text-gray-700">{requestTarget.product_name}</span>
                </div>
              </div>
              <button
                onClick={() => setRequestModalOpen(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label="close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs text-gray-500">現在在庫</div>
                  <div className="mt-1 text-xl font-bold text-gray-800">
                    {requestTarget.current_stock}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs text-gray-500">基準値 (Min)</div>
                  <div className="mt-1 text-xl font-bold text-gray-800">
                    {requestTarget.threshold}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">依頼数量</label>
                <input
                  type="number"
                  min={1}
                  value={requestQty}
                  onChange={(e) => setRequestQty(parseInt(e.target.value) || 1)}
                  className="focus:ring-brand-500 mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2"
                />
                <div className="mt-1 text-[11px] text-gray-500">
                  ※ 工場は店舗から徒歩約5分。すぐ焼成・納品を依頼します。
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">
                  到着予定（デフォルト：5分後）
                </label>
                <input
                  type="datetime-local"
                  value={requestEta}
                  onChange={(e) => setRequestEta(e.target.value)}
                  className="focus:ring-brand-500 mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">メモ（任意）</label>
                <textarea
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  className="focus:ring-brand-500 mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2"
                  rows={3}
                  placeholder="例）急ぎ、追加で10個お願いします"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setRequestModalOpen(false)}
                className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                キャンセル
              </button>
              <button
                onClick={handleCreateFactoryRequest}
                className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100"
              >
                依頼を送信
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;
