import React, { useMemo } from 'react';
import { useStore } from '../store/StoreContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { TrendingUp, ShoppingBag, AlertTriangle, JapaneseYen, Trophy } from 'lucide-react';

const Dashboard: React.FC = () => {
  const { orders, inventory, products } = useStore();

  const today = new Date().toDateString();
  const todaysOrders = orders.filter(o => new Date(o.order_time).toDateString() === today);
  
  const dailySales = todaysOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const orderCount = todaysOrders.length;
  
  const lowStockItems = inventory.filter(i => {
    const product = products.find(p => p.product_id === i.product_id);
    // Exclude drinks and alcohol from low stock alert
    if (product && (product.type === 'drink' || product.type === 'alcohol')) {
      return false;
    }
    return i.current_quantity <= i.min_threshold;
  });

  // Chart Data Preparation
  const hourlyData = useMemo(() => {
    // Show all 24 hours (0 - 23)
    const data = new Array(24).fill(0).map((_, i) => ({ hour: i, sales: 0 })); 
    
    todaysOrders.forEach(o => {
      const hour = new Date(o.order_time).getHours();
      if (hour >= 0 && hour < 24) {
        data[hour].sales += o.total_amount;
      }
    });
    return data.map(d => ({ ...d, name: `${d.hour}:00` }));
  }, [todaysOrders]);

  const typeData = useMemo(() => {
    let eatIn = 0;
    let takeaway = 0;
    todaysOrders.forEach(o => {
      if (o.order_type === 'eat-in') eatIn += o.total_amount;
      else takeaway += o.total_amount;
    });
    return [
      { name: '店内 (Eat-in)', value: eatIn },
      { name: '持ち帰り (Takeaway)', value: takeaway },
    ];
  }, [todaysOrders]);

  // Top Selling Products Logic
  const popularProducts = useMemo(() => {
    const salesMap = new Map<string, number>();
    
    todaysOrders.forEach(order => {
      order.items.forEach(item => {
        const current = salesMap.get(item.product_id) || 0;
        salesMap.set(item.product_id, current + item.quantity);
      });
    });

    return Array.from(salesMap.entries())
      .map(([id, qty]) => {
        const product = products.find(p => p.product_id === id);
        return {
          id,
          name: product?.name || 'Unknown',
          count: qty
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [todaysOrders, products]);

  const COLORS = ['#ea5f0c', '#fb923c'];

  return (
    <div className="p-8 h-full overflow-y-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">ダッシュボード (本日: {new Date().toLocaleDateString('ja-JP')})</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-brand-100 rounded-lg text-brand-600 mr-4">
            <JapaneseYen className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">本日の売上</p>
            <p className="text-2xl font-bold text-gray-800">¥{dailySales.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-blue-100 rounded-lg text-blue-600 mr-4">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">注文件数</p>
            <p className="text-2xl font-bold text-gray-800">{orderCount} 件</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-green-100 rounded-lg text-green-600 mr-4">
            <TrendingUp className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">客単価</p>
            <p className="text-2xl font-bold text-gray-800">
              ¥{orderCount > 0 ? Math.floor(dailySales / orderCount).toLocaleString() : 0}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-red-100 rounded-lg text-red-600 mr-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">在庫アラート</p>
            <p className="text-2xl font-bold text-gray-800">{lowStockItems.length} 商品</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-700 mb-4">時間別売上推移 (24時間)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} interval={2} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `¥${value}`} />
                <Tooltip 
                  formatter={(value: number) => [`¥${value.toLocaleString()}`, '売上']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                <Bar dataKey="sales" fill="#ea5f0c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-700 mb-4">売上構成比</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `¥${value.toLocaleString()}`} />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Popular Products Ranking */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white">
           <h3 className="font-bold text-gray-700 text-lg">
             人気商品ランキング
           </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/50 text-xs font-semibold text-gray-400">
              <tr>
                <th className="px-6 py-3">順位</th>
                <th className="px-6 py-3">商品名</th>
                <th className="px-6 py-3 text-right">販売数</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {popularProducts.length === 0 ? (
                 <tr>
                   <td colSpan={3} className="px-6 py-8 text-center text-gray-400">データがありません</td>
                 </tr>
              ) : (
                popularProducts.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-400 font-medium">#{index + 1}</td>
                    <td className="px-6 py-4 font-bold text-gray-800 text-base">{item.name}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-brand-600 font-bold text-lg">{item.count}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;