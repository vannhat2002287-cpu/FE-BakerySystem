import axios from "axios";

const BASE_URL = `${import.meta.env.VITE_BASE_URL}/app`;


const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Thêm request interceptor để debug
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Thêm response interceptor để debug
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    
    return Promise.reject(error);
  }
);
// API cho sản phẩm
export const productAPI = {
  getAllProducts: () => api.get("/products/all"),
  getProductById: (id) => api.get(`/products/${id}`),
  createProduct: (productData) => api.post("/products", productData),
  updateProduct: (id, productData) => api.put(`/products/${id}`, productData),
  deleteProduct: (id) => api.delete(`/products/${id}`),
};

// API cho danh mục
export const categoryAPI = {
  getAllCategories: () => api.get("/category/all"),
};