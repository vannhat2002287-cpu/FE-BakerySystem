export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8098/api/v1";

export const API_ENDPOINTS = {
  PRODUCTS: "/products",
  INVENTORY: "/inventory",
  ORDERS: "/orders",
  FACTORY_REQUESTS: "/factory-requests",
  CATEGORIES: "/categories",
  ANALYTICS: "/analytics",
};

export const buildApiUrl = (
  endpoint: string,
  params?: Record<string, string | number | boolean | null | undefined>
) => {
  const url = new URL(`${API_BASE_URL}${endpoint}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  return url.toString();
};
