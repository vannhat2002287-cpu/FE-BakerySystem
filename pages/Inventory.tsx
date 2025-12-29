import React, { useMemo, useState } from 'react';
import { useStore } from '../store/StoreContext';
import { Edit2, Save, X, Factory, PackageCheck, ClipboardList } from 'lucide-react';

// Định nghĩa các trạng thái có thể có của một yêu cầu nhập hàng
type FactoryRequestStatus = 'PENDING' | 'DELIVERED' | 'CANCELLED';

// Định nghĩa cấu trúc dữ liệu cho một yêu cầu nhập hàng từ nhà máy
type FactoryRequest = {
  request_id: string;
  product_id: string;
  product_name: string;
  request_quantity: number;
  created_at: string;      // Thời gian tạo (ISO string)
  eta_at: string;          // Thời gian dự kiến giao hàng (ISO string)
  note?: string;           // Ghi chú tùy chọn
  status: FactoryRequestStatus;
};

// Hàm tiện ích: Cộng thêm phút vào thời gian hiện tại (Dùng để tính ETA mặc định)
const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60 * 1000);

/**
 * Component InventoryPage
 * Mục đích: Quản lý hiển thị tồn kho, chỉnh sửa số lượng tồn kho thủ công,
 * và quản lý quy trình yêu cầu nhập hàng bổ sung từ nhà máy (Factory Request).
 */
const InventoryPage: React.FC = () => {
  // Lấy dữ liệu và hàm cập nhật từ Global Store
  const { products, inventory, updateInventory } = useStore();

  // ===== Phần 1: State cho chức năng chỉnh sửa tồn kho thủ công (Inline Edit) =====
  // editingId: Lưu ID sản phẩm đang được chỉnh sửa. Nếu null nghĩa là không có dòng nào đang sửa.
  const [editingId, setEditingId] = useState<string | null>(null);
  // editValue: Lưu giá trị tạm thời của ô input khi người dùng đang nhập liệu.
  const [editValue, setEditValue] = useState<number>(0);

  // ===== Phần 2: State cho chức năng Yêu cầu Nhà máy (Factory Request) =====
  // factoryRequests: Danh sách các yêu cầu đã tạo (Lưu cục bộ trong component này).
  const [factoryRequests, setFactoryRequests] = useState<FactoryRequest[]>([]);
  // requestModalOpen: Trạng thái đóng/mở của Modal yêu cầu nhập hàng.
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  // requestTarget: Lưu thông tin sản phẩm đang được chọn để tạo yêu cầu (để hiển thị lên Modal).
  const [requestTarget, setRequestTarget] = useState<{
    product_id: string;
    product_name: string;
    current_stock: number;
    threshold: number;
  } | null>(null);

  // State cho Form trong Modal
  const [requestQty, setRequestQty] = useState<number>(10);
  const [requestNote, setRequestNote] = useState<string>('');
  // Mặc định thời gian giao hàng là 5 phút sau khi tạo (Giả lập khoảng cách gần)
  const [requestEta, setRequestEta] = useState<string>(() => addMinutes(new Date(), 5).toISOString().slice(0, 16)); // Format: "YYYY-MM-DDTHH:mm"

  /**
   * useMemo - mergedData:
   * Mục đích: Kết hợp dữ liệu tĩnh (Product) và dữ liệu động (Inventory) thành một mảng duy nhất.
   * Lý do: Để hiển thị đầy đủ thông tin (Ảnh, Tên, Tồn kho, Mức cảnh báo) trên cùng một bảng.
   * Chỉ tính toán lại khi `products` hoặc `inventory` thay đổi để tối ưu hiệu năng.
   */
  const mergedData = useMemo(() => {
    return products.map(p => {
      const inv = inventory.find(i => i.product_id === p.product_id);
      return {
        ...p,
        stock: inv?.current_quantity || 0,
        threshold: inv?.min_threshold || 0,
        lastUpdated: inv?.last_updated
      };
    });
  }, [products, inventory]);

  // Bắt đầu chỉnh sửa thủ công: Lưu ID và giá trị hiện tại vào state tạm
  const startEdit = (id: string, current: number) => {
    setEditingId(id);
    setEditValue(current);
  };

  // Lưu chỉnh sửa thủ công: Gọi action updateInventory của Store và đóng chế độ sửa
  const saveEdit = (id: string) => {
    updateInventory(id, editValue);
    setEditingId(null);
  };

  // ===== Các hàm xử lý logic cho Yêu cầu Nhà máy =====

  // Mở Modal: Thiết lập dữ liệu ban đầu cho form
  const openRequestModal = (product_id: string, product_name: string, stock: number, threshold: number) => {
    setRequestTarget({ product_id, product_name, current_stock: stock, threshold });
    
    // Logic gợi ý số lượng: 
    // Công thức: (Mức cảnh báo * 2) - Tồn kho hiện tại.
    // Mục đích: Đề xuất số lượng nạp kho hợp lý để kho không bị đầy quá hoặc thiếu quá.
    // Tối thiểu là 1, mặc định fallback là 10.
    const recommended = Math.max(1, threshold * 2 - stock);
    
    setRequestQty(recommended || 10);
    setRequestNote('');
    setRequestEta(addMinutes(new Date(), 5).toISOString().slice(0, 16)); // Reset lại ETA là 5 phút từ bây giờ
    setRequestModalOpen(true);
  };

  // Tạo yêu cầu mới: Đóng gói dữ liệu và thêm vào danh sách
  const createFactoryRequest = () => {
    if (!requestTarget) return;

    const qty = Number.isFinite(requestQty) ? Math.max(1, requestQty) : 1;

    const newReq: FactoryRequest = {
      request_id: `FR-${Date.now()}`, // Tạo ID giả lập dựa trên timestamp
      product_id: requestTarget.product_id,
      product_name: requestTarget.product_name,
      request_quantity: qty,
      created_at: new Date().toISOString(),
      eta_at: new Date(requestEta).toISOString(),
      note: requestNote?.trim() || undefined,
      status: 'PENDING' // Trạng thái ban đầu là Đang chờ
    };

    setFactoryRequests(prev => [newReq, ...prev]); // Thêm vào đầu danh sách
    setRequestModalOpen(false);
    setRequestTarget(null);
  };

  // Hủy yêu cầu: Chỉ đổi trạng thái, không xóa khỏi danh sách để giữ lịch sử
  const cancelFactoryRequest = (request_id: string) => {
    setFactoryRequests(prev =>
      prev.map(r => (r.request_id === request_id ? { ...r, status: 'CANCELLED' } : r))
    );
  };

  /**
   * Xử lý nhận hàng (DELIVERED):
   * Mục đích: Xác nhận hàng đã về và cập nhật số lượng tồn kho thực tế.
   * Logic: 
   * 1. Tìm tồn kho mới nhất từ `mergedData` (để đảm bảo tính chính xác realtime).
   * 2. Cộng dồn số lượng yêu cầu vào tồn kho hiện tại.
   * 3. Cập nhật trạng thái yêu cầu thành 'DELIVERED'.
   */
  const markDeliveredAndApplyStock = (req: FactoryRequest) => {
    const latest = mergedData.find(m => m.product_id === req.product_id);
    const currentStock = latest?.stock ?? 0;

    // Cập nhật Store toàn cục
    updateInventory(req.product_id, currentStock + req.request_quantity);

    // Cập nhật trạng thái yêu cầu cục bộ
    setFactoryRequests(prev =>
      prev.map(r => (r.request_id === req.request_id ? { ...r, status: 'DELIVERED' } : r))
    );
  };

  // Hàm format ngày tháng sang chuẩn Nhật Bản để hiển thị giao diện
  const formatJa = (iso: string) => new Date(iso).toLocaleString('ja-JP');

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">在庫管理</h1>
          <p className="text-xs text-gray-500 mt-1">
            店舗在庫が基準値を下回ったら、工場へ追加焼成を依頼（徒歩約5分で納品）
          </p>
        </div>

        {/* Thống kê nhanh số lượng yêu cầu đang chờ */}
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-600">
            <ClipboardList className="w-4 h-4 mr-2" />
            依頼中: {factoryRequests.filter(r => r.status === 'PENDING').length}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ===== Cột Trái: Bảng Tồn kho (Inventory Table) ===== */}
        <div className="xl:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase font-semibold text-gray-500">
                <tr>
                  <th className="px-6 py-4">商品名</th>
                  <th className="px-6 py-4">カテゴリー</th>
                  <th className="px-6 py-4">現在在庫</th>
                  <th className="px-6 py-4">基準値 (Min)</th>
                  <th className="px-6 py-4">最終更新</th>
                  <th className="px-6 py-4">工場依頼</th>
                  <th className="px-6 py-4">操作</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {mergedData.map(item => {
                  // Logic nghiệp vụ: Chỉ quản lý tồn kho cho Bánh (Food).
                  // Đồ uống (drink) và Rượu (alcohol) được pha chế tại chỗ hoặc quản lý riêng nên không hiện ở đây.
                  const isStockManaged = item.type !== 'drink' && item.type !== 'alcohol';

                  // Cờ báo động: Tồn kho thực tế <= Mức tối thiểu
                  const isLow = isStockManaged && item.stock <= item.threshold;

                  return (
                    <tr key={item.product_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <img
                            src={item.image_url}
                            alt=""
                            className="w-10 h-10 rounded object-cover mr-3 bg-gray-100"
                          />
                          <div>
                            <div className="font-medium text-gray-800">{item.name}</div>
                            {isLow && (
                              <div className="text-[11px] text-red-600 mt-0.5">在庫が基準値以下です</div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-gray-500">
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs">{item.category_id}</span>
                      </td>

                      <td className="px-6 py-4">
                        {!isStockManaged ? (
                          <span className="text-gray-400 font-mono text-lg">-</span>
                        ) : editingId === item.product_id ? (
                          <div className="flex items-center">
                            <input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                              className="w-20 border border-brand-300 rounded p-1 text-center outline-none ring-1 ring-brand-500"
                            />
                          </div>
                        ) : (
                          <span className={`font-bold ${isLow ? 'text-red-600' : 'text-gray-700'}`}>
                            {item.stock}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-gray-400">
                        {isStockManaged ? item.threshold : '-'}
                      </td>

                      <td className="px-6 py-4 text-xs text-gray-400">
                        {isStockManaged && item.lastUpdated ? new Date(item.lastUpdated).toLocaleString('ja-JP') : '-'}
                      </td>

                      {/* ===== Cột: Nút Yêu cầu Nhà máy ===== */}
                      <td className="px-6 py-4">
                        {!isStockManaged ? (
                          <span className="text-xs text-gray-400 italic">対象外</span>
                        ) : (
                          <button
                            // Chỉ cho phép yêu cầu khi tồn kho thấp (isLow)
                            disabled={!isLow}
                            onClick={() => openRequestModal(item.product_id, item.name, item.stock, item.threshold)}
                            className={[
                              'inline-flex items-center px-3 py-2 rounded-lg text-xs font-semibold border transition',
                              isLow
                                ? 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
                                : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                            ].join(' ')}
                            title={isLow ? '工場へ追加焼成を依頼' : '基準値以下になったら依頼できます'}
                          >
                            <Factory className="w-4 h-4 mr-2" />
                            工場へ依頼
                          </button>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {!isStockManaged ? (
                          <span className="text-xs text-gray-400 italic">管理対象外</span>
                        ) : editingId === item.product_id ? (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => saveEdit(item.product_id)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(item.product_id, item.stock)}
                            className="flex items-center text-brand-600 hover:text-brand-800 font-medium text-xs"
                          >
                            <Edit2 className="w-3 h-3 mr-1" /> 調整
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

        {/* ===== Cột Phải: Danh sách Lịch sử Yêu cầu (Request List) ===== */}
        <div className="xl:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="font-semibold text-gray-800 flex items-center">
                <ClipboardList className="w-4 h-4 mr-2" />
                工場依頼一覧
              </div>
              <span className="text-xs text-gray-500">徒歩約5分で納品</span>
            </div>

            <div className="p-4 space-y-3 max-h-[520px] overflow-y-auto">
              {factoryRequests.length === 0 ? (
                <div className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-4">
                  依頼はまだありません。<br />
                  在庫が基準値以下になると「工場へ依頼」ボタンが有効になります。
                </div>
              ) : (
                factoryRequests.map(req => (
                  <div
                    key={req.request_id}
                    className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-800">{req.product_name}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          数量: <span className="font-semibold text-gray-700">{req.request_quantity}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          依頼: {formatJa(req.created_at)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          到着予定: {formatJa(req.eta_at)}
                        </div>
                        {req.note && (
                          <div className="text-xs text-gray-500 mt-2">
                            メモ: {req.note}
                          </div>
                        )}
                      </div>

                      {/* Badge hiển thị trạng thái */}
                      <div className="text-xs">
                        {req.status === 'PENDING' && (
                          <span className="px-2 py-1 rounded bg-orange-50 text-orange-700 border border-orange-200">
                            依頼中
                          </span>
                        )}
                        {req.status === 'DELIVERED' && (
                          <span className="px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200">
                            納品済
                          </span>
                        )}
                        {req.status === 'CANCELLED' && (
                          <span className="px-2 py-1 rounded bg-gray-100 text-gray-500 border border-gray-200">
                            キャンセル
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons: Chỉ hiện khi trạng thái là PENDING */}
                    {req.status === 'PENDING' && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => markDeliveredAndApplyStock(req)}
                          className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition"
                        >
                          <PackageCheck className="w-4 h-4 mr-2" />
                          受領（在庫に反映）
                        </button>
                        <button
                          onClick={() => cancelFactoryRequest(req.request_id)}
                          className="px-3 py-2 rounded-lg text-xs font-semibold bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition"
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
        </div>
      </div>

      {/* ===== Modal Tạo Yêu cầu Mới ===== */}
      {requestModalOpen && requestTarget && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-gray-800">工場へ追加焼成を依頼</div>
                <div className="text-xs text-gray-500 mt-1">
                  対象商品: <span className="font-semibold text-gray-700">{requestTarget.product_name}</span>
                </div>
              </div>
              <button
                onClick={() => setRequestModalOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                aria-label="close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <div className="text-xs text-gray-500">現在在庫</div>
                  <div className="text-xl font-bold text-gray-800 mt-1">{requestTarget.current_stock}</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <div className="text-xs text-gray-500">基準値 (Min)</div>
                  <div className="text-xl font-bold text-gray-800 mt-1">{requestTarget.threshold}</div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">依頼数量</label>
                <input
                  type="number"
                  min={1}
                  value={requestQty}
                  onChange={(e) => setRequestQty(parseInt(e.target.value) || 1)}
                  className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
                />
                <div className="text-[11px] text-gray-500 mt-1">
                  ※ 工場は店舗から徒歩約5分。すぐ焼成・納品を依頼します。
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">到着予定（デフォルト：5分後）</label>
                <input
                  type="datetime-local"
                  value={requestEta}
                  onChange={(e) => setRequestEta(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">メモ（任意）</label>
                <textarea
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
                  rows={3}
                  placeholder="例）急ぎ、追加で10個お願いします"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setRequestModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100"
              >
                キャンセル
              </button>
              <button
                onClick={createFactoryRequest}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100"
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