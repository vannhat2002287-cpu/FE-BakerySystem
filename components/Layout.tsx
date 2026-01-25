/**
 * @authors Huynh and Hue
 */

// Layout chính của ứng dụng - bao gồm Sidebar và vùng nội dung
import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  History,
  Settings,
  Croissant,
  Clock,
  RotateCcw,
} from "lucide-react";
import { useStore } from "../store/StoreContext";
import { formatDateTime } from "@/utils/date";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { currentTime, setSimulationTime, resetSimulation, isSimulationMode } = useStore();

  // Danh sách menu điều hướng
  const navItems = [
    { path: "/dashboard", icon: LayoutDashboard, label: "ダッシュボード" },
    { path: "/", icon: ShoppingCart, label: "注文" },
    { path: "/inventory", icon: Package, label: "在庫管理" },
    { path: "/history", icon: History, label: "注文履歴" },
  ];

  // Xử lý thay đổi giờ giả lập
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    const [hours, minutes] = e.target.value.split(":").map(Number);
    const newDate = new Date(currentTime);
    newDate.setHours(hours);
    newDate.setMinutes(minutes);
    setSimulationTime(newDate);
  };

  const formattedTime = formatDateTime(currentTime, "HH:mm");

  return (
    <div className="flex h-screen w-full bg-gray-50">
      {/* Sidebar - thanh điều hướng bên trái */}
      <aside className="z-20 flex w-64 flex-col border-r border-gray-200 bg-white shadow-sm">
        {/* Logo và tên cửa hàng */}
        <div className="flex h-16 items-center border-b border-gray-100 px-6">
          <Croissant className="text-brand-600 mr-2 h-8 w-8" />
          <h1 className="text-xl font-bold tracking-tight text-gray-800">FRESH BAKERY</h1>
        </div>

        {/* Menu điều hướng */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-brand-50 text-brand-700 border-brand-100 border shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                } `
              }
            >
              <item.icon
                className={`mr-3 h-5 w-5 ${location.pathname === item.path ? "text-brand-600" : "text-gray-400"}`}
              />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Widget hiển thị giờ hệ thống */}
        <div className="border-t border-gray-100 bg-gray-50/50 p-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            {/* Header: tiêu đề + nút reset */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center text-xs font-bold tracking-wider text-gray-500 uppercase">
                <Clock className="mr-1.5 h-3 w-3" />
                システム時間
              </div>
              {/* Nút reset về giờ thực (chỉ hiện khi đang giả lập) */}
              {isSimulationMode && (
                <button
                  onClick={resetSimulation}
                  title="リセット"
                  className="rounded-full p-1 transition-colors hover:bg-gray-100"
                >
                  <RotateCcw className="h-3 w-3 text-gray-400" />
                </button>
              )}
            </div>

            {/* Hiển thị giờ hiện tại (font lớn) */}
            <div className="mb-3 rounded border border-gray-100 bg-gray-50 py-2 text-center font-mono text-2xl font-bold text-gray-800">
              {formattedTime}
            </div>

            {/* Input chọn giờ giả lập (đang comment) */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-gray-400">
                {/* 時間シミュレーション */}
              </label>
              {/* <input
                type="time"
                value={inputValue}
                onChange={handleTimeChange}
                className="focus:ring-brand-500 focus:border-brand-500 block w-full rounded border border-gray-300 bg-white p-2 text-xs text-gray-700 focus:ring-1"
              /> */}
            </div>
          </div>
          {/* Chú thích quy định thời gian */}
          <div className="mt-3 space-y-1 px-1">
            {/* Quy định: trước 17h không bán rượu */}
            <div className="flex items-center text-[12px] text-gray-400">
              <div className="mr-2 h-2 w-2 rounded-full bg-purple-400"></div>
              17:00未満: アルコール不可
            </div>
            {/* Quy định: sau 20:30 không bán eat-in */}
            <div className="flex items-center text-[12px] text-gray-400">
              <div className="mr-2 h-2 w-2 rounded-full bg-blue-400"></div>
              20:30以降: イートイン不可
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <main className="relative flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
