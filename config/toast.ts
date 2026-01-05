import { ToasterProps } from "react-hot-toast";

export const toastConfig: ToasterProps = {
  position: "top-right",
  toastOptions: {
    duration: 4000,
    style: {
      background: "#fff",
      color: "#333",
      borderRadius: "8px",
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    },
    success: {
      iconTheme: {
        primary: "#10b981",
        secondary: "#fff",
      },
    },
    error: {
      iconTheme: {
        primary: "#ef4444",
        secondary: "#fff",
      },
    },
  },
};
