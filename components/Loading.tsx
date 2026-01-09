// Component Loading - hiển thị trạng thái đang tải
import React from "react";

export type LoadingSize = "sm" | "md" | "lg";
export type LoadingVariant = "spinner" | "dots"; // spinner: vòng xoay, dots: 3 chấm nhấp nháy

interface LoadingProps {
  size?: LoadingSize; // Kích thước
  variant?: LoadingVariant; // Kiểu hiển thị
  message?: string; // Thông báo kèm theo
  fullScreen?: boolean; // Có che toàn màn hình không
  className?: string;
  color?: string;
}

// Cấu hình class theo size
const sizeClasses: Record<LoadingSize, { spinner: string; text: string }> = {
  sm: {
    spinner: "h-6 w-6 border-b-2",
    text: "text-sm",
  },
  md: {
    spinner: "h-12 w-12 border-b-2",
    text: "text-base",
  },
  lg: {
    spinner: "h-16 w-16 border-b-2",
    text: "text-lg",
  },
};

const Loading: React.FC<LoadingProps> = ({
  size = "md",
  variant = "dots",
  message,
  fullScreen = false,
  className = "",
  color = "border-brand-600",
}) => {
  const sizeClass = sizeClasses[size];
  const textSizeClass = sizeClass.text;

  // Kiểu spinner: vòng tròn xoay
  const spinnerElement = (
    <div
      className={`mx-auto animate-spin rounded-full ${
        sizeClass.spinner
      } ${color} ${variant === "spinner" ? "" : "hidden"}`}
    />
  );

  // Kiểu dots: 3 chấm nhấp nháy lần lượt
  const dotsElement = (
    <div className={`flex justify-center space-x-2 ${variant === "dots" ? "" : "hidden"}`}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`${
            size === "sm" ? "h-2 w-2" : size === "md" ? "h-3 w-3" : "h-4 w-4"
          } bg-brand-600 animate-pulse rounded-full`}
          style={{
            animationDelay: `${i * 0.2}s`,
            animationDuration: "1s",
          }}
        />
      ))}
    </div>
  );

  // Nội dung loading (spinner/dots + message)
  const content = (
    <div className={`${className}`}>
      {variant === "spinner" ? spinnerElement : dotsElement}
      {message && <p className={`mt-4 text-gray-500 ${textSizeClass}`}>{message}</p>}
    </div>
  );

  // Nếu fullScreen: overlay che toàn màn hình
  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return content;
};

export default Loading;
