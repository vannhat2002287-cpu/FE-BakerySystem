import React from "react";

export type LoadingSize = "sm" | "md" | "lg";
export type LoadingVariant = "spinner" | "dots";

interface LoadingProps {
  size?: LoadingSize;
  variant?: LoadingVariant;
  message?: string;
  fullScreen?: boolean;
  className?: string;
  color?: string;
}

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

  const spinnerElement = (
    <div
      className={`animate-spin rounded-full mx-auto ${
        sizeClass.spinner
      } ${color} ${variant === "spinner" ? "" : "hidden"}`}
    />
  );

  const dotsElement = (
    <div
      className={`flex space-x-2 justify-center ${
        variant === "dots" ? "" : "hidden"
      }`}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`${
            size === "sm" ? "h-2 w-2" : size === "md" ? "h-3 w-3" : "h-4 w-4"
          } rounded-full bg-brand-600 animate-pulse`}
          style={{
            animationDelay: `${i * 0.2}s`,
            animationDuration: "1s",
          }}
        />
      ))}
    </div>
  );

  const content = (
    <div className={`${className}`}>
      {variant === "spinner" ? spinnerElement : dotsElement}
      {message && (
        <p className={`mt-4 text-gray-500 ${textSizeClass}`}>{message}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
};

export default Loading;
