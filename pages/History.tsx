import React, { useState, useMemo } from 'react';
import { useStore } from '../store/StoreContext';
import { ChevronDown, ChevronUp, FileText, Printer } from 'lucide-react';

const HistoryPage: React.FC = () => {
  const { orders } = useStore();
  const [activeTab, setActiveTab] = useState<'daily' | 'product'>('daily');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // --- TAB 1: Daily Summary Logic ---
  // Group orders by date (simple string YYYY-MM-DD)
  const dailySummary = useMemo(() => {
    const map = new Map<string, { date: string, total: number, eatIn: number, takeaway: number, count: number, orders: any[] }>();

    orders.forEach(order => {
      const dateStr = new Date(order.order_time).toLocaleDateString('ja-JP');
      if (!map.has(dateStr)) {
        map.set(dateStr, { date: dateStr, total: 0, eatIn: 0, takeaway: 0, count: 0, orders: [] });
      }
      const entry = map.get(dateStr)!;
      entry.total += order.total_amount;
      entry.count += 1;
      entry.orders.push(order);
      if (order.order_type === 'eat-in') entry.eatIn += order.total_amount;
      else entry.takeaway += order.total_amount;
    });

    return Array.from(map.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders]);

  // --- TAB 2: Product Analysis Logic (ABC Analysis mock) ---
  const productAnalysis = useMemo(() => {
     const map = new Map<string, { id: string, name: string, qty: number, sales: number }>();
     orders.forEach(order => {
       order.items.forEach(item => {
         if (!map.has(item.product_id)) {
           map.set(item.product_id, { id: item.product_id, name: item.name, qty: 0, sales: 0 });
         }
         const entry = map.get(item.product_id)!;
         entry.qty += item.quantity;
         entry.sales += item.unit_price * item.quantity;
       });
     });
     return Array.from(map.values()).sort((a, b) => b.sales - a.sales);
  }, [orders]);


  const toggleOrderExpand = (id: string) => {
    setExpandedOrderId(expandedOrderId === id ? null : id);
  };

  return (
    <div className="p-8 h-full overflow-y-auto bg-gray-50">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">注文履歴・売上分析</h1>

      {/* Tabs */}
      <div className="flex space-x-1 mb-6 border-b border-gray-200">
        <button 
          onClick={() => setActiveTab('daily')}
          className={`px-6 py-3 font-medium text-sm rounded-t-lg transition-colors ${activeTab === 'daily' ? 'bg-white border-t border-l border-r border-gray-200 text-brand-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
        >
          日次レポート
        </button>
        <button 
          onClick={() => setActiveTab('product')}
          className={`px-6 py-3 font-medium text-sm rounded-t-lg transition-colors ${activeTab === 'product' ? 'bg-white border-t border-l border-r border-gray-200 text-brand-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
        >
          商品分析
        </button>
      </div>

      {activeTab === 'daily' && (
        <div className="space-y-6">
          {dailySummary.map((day) => (
            <div key={day.date} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Daily Header */}
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-wrap justify-between items-center">
                 <div>
                   <h3 className="font-bold text-lg text-gray-800 flex items-center">
                     <FileText className="w-5 h-5 mr-2 text-brand-500" />
                     {day.date}
                   </h3>
                   <span className="text-sm text-gray-500 ml-7">{day.count} 件の注文</span>
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
                    <div className="pl-6 border-l border-gray-300">
                      <p className="text-xs text-gray-500 font-bold">総売上</p>
                      <p className="font-bold text-xl text-brand-600">¥{day.total.toLocaleString()}</p>
                    </div>
                 </div>
              </div>
              
              {/* Order List for that day */}
              <div className="divide-y divide-gray-100">
                {day.orders.map((order: any) => (
                   <div key={order.order_id}>
                     <div 
                        onClick={() => toggleOrderExpand(order.order_id)}
                        className="px-6 py-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                     >
                       <div className="flex items-center space-x-4">
                         <span className="text-gray-400 text-sm font-mono">{new Date(order.order_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                         <span className={`px-2 py-0.5 rounded text-xs border ${order.order_type === 'eat-in' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-orange-200 bg-orange-50 text-orange-700'}`}>
                           {order.order_type === 'eat-in' ? '店内' : '持帰'}
                         </span>
                         <span className="text-sm font-medium text-gray-700">{order.order_id}</span>
                       </div>
                       <div className="flex items-center space-x-4">
                         <span className="font-bold text-gray-800">¥{order.total_amount.toLocaleString()}</span>
                         {expandedOrderId === order.order_id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                       </div>
                     </div>
                     
                     {/* Expanded Details */}
                     {expandedOrderId === order.order_id && (
                       <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 text-sm">
                         <ul className="space-y-1 mb-4">
                           {order.items.map((item: any) => (
                             <li key={item.product_id} className="flex justify-between">
                               <span className="text-gray-600">{item.name} x {item.quantity}</span>
                               <span className="text-gray-800">¥{(item.unit_price * item.quantity).toLocaleString()}</span>
                             </li>
                           ))}
                         </ul>
                         <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                           <span className="text-gray-500 text-xs">支払方法: 現金</span>
                           <button className="flex items-center text-brand-600 hover:text-brand-800 text-xs font-bold border border-brand-200 bg-white px-3 py-1 rounded shadow-sm">
                             <Printer className="w-3 h-3 mr-1" /> 領収書印刷
                           </button>
                         </div>
                       </div>
                     )}
                   </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'product' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
           <table className="w-full text-left">
             <thead className="bg-gray-100 border-b border-gray-200">
               <tr>
                 <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">順位</th>
                 <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">商品名</th>
                 <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">販売個数</th>
                 <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">売上金額</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-100 text-sm">
               {productAnalysis.map((item, index) => (
                 <tr key={item.id} className="hover:bg-gray-50">
                   <td className="px-6 py-4 text-gray-500">#{index + 1}</td>
                   <td className="px-6 py-4 font-medium text-gray-800">{item.name}</td>
                   <td className="px-6 py-4 text-right text-gray-600">{item.qty}</td>
                   <td className="px-6 py-4 text-right font-bold text-gray-800">¥{item.sales.toLocaleString()}</td>
                 </tr>
               ))}
               {productAnalysis.length === 0 && (
                 <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400">データがありません</td></tr>
               )}
             </tbody>
           </table>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;