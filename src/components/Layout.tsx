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
    { path: '/dashboard', icon: LayoutDashboard, label: 'ダッシュボード' },
    { path: '/', icon: ShoppingCart, label: '注文' },
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
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm z-20">
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <Croissant className="h-8 w-8 text-brand-600 mr-2" />
          <h1 className="font-bold text-xl text-gray-800 tracking-tight">FRESH BAKERY</h1>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                ${isActive 
                  ? 'bg-brand-50 text-brand-700 shadow-sm border border-brand-100' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
              `}
            >
              <item.icon className={`h-5 w-5 mr-3 ${location.pathname === item.path ? 'text-brand-600' : 'text-gray-400'}`} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        
        {/* Time Simulation Widget at Bottom */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                <Clock className="w-3 h-3 mr-1.5" />
                システム時間
              </div>
               {isSimulationMode && (
                <button onClick={resetSimulation} title="リセット" className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                  <RotateCcw className="w-3 h-3 text-gray-400" />
                </button>
              )}
            </div>
            
            <div className="text-center py-2 mb-3 bg-gray-50 rounded border border-gray-100 font-mono text-2xl font-bold text-gray-800">
               {formattedTime}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 block">時間シミュレーション</label>
              <input 
                type="time" 
                value={inputValue}
                onChange={handleTimeChange}
                className="w-full bg-white border border-gray-300 text-gray-700 text-xs rounded p-2 focus:ring-1 focus:ring-brand-500 focus:border-brand-500 block"
              />
            </div>
          </div>
           <div className="mt-3 space-y-1 px-1">
             <div className="flex items-center text-[10px] text-gray-400">
                <div className="w-2 h-2 rounded-full bg-purple-400 mr-2"></div>
                17:00未満: アルコール不可
             </div>
             <div className="flex items-center text-[10px] text-gray-400">
                <div className="w-2 h-2 rounded-full bg-blue-400 mr-2"></div>
                20:30以降: イートイン不可
             </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
         <main className="flex-1 overflow-hidden relative">
           {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;