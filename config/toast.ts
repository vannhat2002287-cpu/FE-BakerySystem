/**
 * @authors Huynh and Hue
 */

// Cấu hình toast notification (thông báo popup)
import { ToasterProps } from "react-hot-toast";

export const toastConfig: ToasterProps = {
  position: "top-right", // Vị trí hiển thị: góc trên bên phải
  toastOptions: {
    duration: 4000, // Thời gian hiển thị: 4 giây
    style: {
      background: "#fff",
      color: "#333",
      borderRadius: "8px",
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    },
    // Màu icon cho toast thành công (xanh lá)
    success: {
      iconTheme: {
        primary: "#10b981",
        secondary: "#fff",
      },
    },
    // Màu icon cho toast lỗi (đỏ)
    error: {
      iconTheme: {
        primary: "#ef4444",
        secondary: "#fff",
      },
    },
  },
};
