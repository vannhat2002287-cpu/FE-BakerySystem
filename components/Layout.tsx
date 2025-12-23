import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, History, Settings, Croissant, Clock, RotateCcw } from 'lucide-react';
import { useStore } from '../store/StoreContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { currentTime, setSimulationTime, resetSimulation, isSimulationMode } = useStore();

  const navItems = [
    { path: '/', icon: ShoppingCart, label: '注文 (POS)' },
    { path: '/dashboard', icon: LayoutDashboard, label: 'ダッシュボード' },
    { path: '/inventory', icon: Package, label: '在庫管理' },
    { path: '/history', icon: History, label: '注文履歴' },
  ];

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    const [hours, minutes] = e.target.value.split(':').map(Number);
    const newDate = new Date(currentTime);
    newDate.setHours(hours);
    newDate.setMinutes(minutes);
    setSimulationTime(newDate);
  };

  const formattedTime = currentTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  // For input value (HH:MM)
  const inputValue = `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`;

  return (
    <div className="flex h-screen w-full bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm z-10">
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <Croissant className="h-8 w-8 text-brand-600 mr-2" />
          <h1 className="font-bold text-xl text-gray-800 tracking-tight">FRESH BAKERY</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                flex items-center px-4 py-3 rounded-xl transition-all duration-200
                ${isActive 
                  ? 'bg-brand-50 text-brand-700 shadow-sm border border-brand-100' 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}
              `}
            >
              <item.icon className="h-5 w-5 mr-3" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Time Simulation Widget */}
        <div className="p-5 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center mb-3">
            <Clock className="w-4 h-4 text-brand-500 mr-2" />
            <h3 className="font-bold text-gray-600 text-sm">システム時間</h3>
            {isSimulationMode && (
              <button onClick={resetSimulation} title="リセット" className="ml-auto p-1 bg-gray-200 rounded-full hover:bg-gray-300 transition-colors">
                <RotateCcw className="w-3 h-3 text-gray-600" />
              </button>
            )}
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm mb-4 flex justify-center items-center">
             <span className="text-4xl font-mono font-bold text-gray-800 tracking-wider">
               {formattedTime}
             </span>
          </div>

          <div className="mb-2">
            <label className="text-xs font-bold text-gray-400 block mb-1">時間シミュレーション</label>
            <div className="relative">
              <input 
                type="time" 
                value={inputValue}
                onChange={handleTimeChange}
                className="w-full bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-brand-500 focus:border-brand-500 block p-2.5"
              />
              <Clock className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-1 mt-3">
             <div className="flex items-center text-xs text-gray-500">
                <div className="w-2 h-2 rounded-full bg-purple-400 mr-2"></div>
                <span>17:00未満: アルコール不可</span>
             </div>
             <div className="flex items-center text-xs text-gray-500">
                <div className="w-2 h-2 rounded-full bg-blue-400 mr-2"></div>
                <span>20:30以降: イートイン不可</span>
             </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
         {children}
      </main>
    </div>
  );
};

export default Layout;