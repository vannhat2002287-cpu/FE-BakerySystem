import React, { useState } from 'react';
import { useStore } from '../store/StoreContext';
import { Edit2, Save, X, RotateCcw } from 'lucide-react';

const InventoryPage: React.FC = () => {
  const { products, inventory, updateInventory } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);

  const mergedData = products.map(p => {
    const inv = inventory.find(i => i.product_id === p.product_id);
    return {
      ...p,
      stock: inv?.current_quantity || 0,
      threshold: inv?.min_threshold || 0,
      lastUpdated: inv?.last_updated
    };
  });

  const startEdit = (id: string, current: number) => {
    setEditingId(id);
    setEditValue(current);
  };

  const saveEdit = (id: string) => {
    updateInventory(id, editValue);
    setEditingId(null);
  };

  return (
    <div className="p-8 h-full overflow-y-auto">
       <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">在庫管理</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase font-semibold text-gray-500">
            <tr>
              <th className="px-6 py-4">商品名</th>
              <th className="px-6 py-4">カテゴリー</th>
              <th className="px-6 py-4">現在在庫</th>
              <th className="px-6 py-4">基準値 (Min)</th>
              <th className="px-6 py-4">最終更新</th>
              <th className="px-6 py-4">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {mergedData.map(item => {
              // Determine if item should be managed
              const isStockManaged = item.type !== 'drink' && item.type !== 'alcohol';

              return (
              <tr key={item.product_id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <img src={item.image_url} alt="" className="w-10 h-10 rounded object-cover mr-3 bg-gray-100" />
                    <span className="font-medium text-gray-800">{item.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-500">
                   <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                     {item.category_id}
                   </span>
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
                    <span className={`font-bold ${item.stock <= item.threshold ? 'text-red-600' : 'text-gray-700'}`}>
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
                <td className="px-6 py-4">
                  {!isStockManaged ? (
                    <span className="text-xs text-gray-400 italic">管理対象外</span>
                  ) : editingId === item.product_id ? (
                    <div className="flex space-x-2">
                      <button onClick={() => saveEdit(item.product_id)} className="p-1 text-green-600 hover:bg-green-50 rounded">
                        <Save className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(item.product_id, item.stock)} className="flex items-center text-brand-600 hover:text-brand-800 font-medium text-xs">
                      <Edit2 className="w-3 h-3 mr-1" /> 調整
                    </button>
                  )}
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InventoryPage;