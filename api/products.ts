import { apiRequest } from "./client";
import { buildApiUrl, API_ENDPOINTS } from "./config";
import { Product } from "../types";

// DTO từ Backend
interface ProductDTO {
  product_id: number;
  name: string;
  price: number;
  type: "food" | "drink" | "alcohol" | "merchandise";
  is_alcoholic: boolean;
  category_id: number;
  image_url: string;
  is_active: boolean;
}

// Chuyển DTO sang format Frontend
function mapProductDTOToProduct(dto: ProductDTO): Product {
  return {
    product_id: String(dto.product_id),
    name: dto.name,
    price: dto.price,
    type: dto.type,
    is_alcoholic: dto.is_alcoholic,
    category_id: String(dto.category_id),
    image_url: dto.image_url,
    is_active: dto.is_active,
  };
}

// Params cho hàm getProducts
export interface GetProductsParams {
  category_id?: string;
  search?: string;
  is_active?: boolean;
}

// Lấy danh sách sản phẩm (có thể lọc)
export async function getProducts(params?: GetProductsParams): Promise<Product[]> {
  const queryParams: Record<string, string | number | boolean> = {};

  if (params?.category_id) {
    queryParams.category_id = params.category_id;
  }
  if (params?.search) {
    queryParams.search = params.search;
  }
  if (params?.is_active !== undefined) {
    queryParams.is_active = params.is_active;
  }

  const url = buildApiUrl(API_ENDPOINTS.PRODUCTS, queryParams);
  const data = await apiRequest<ProductDTO[]>(url);

  return data.map(mapProductDTOToProduct);
}

// Lấy chi tiết sản phẩm theo ID
export async function getProductById(productId: string): Promise<Product> {
  const url = buildApiUrl(`${API_ENDPOINTS.PRODUCTS}/${productId}`);
  const data = await apiRequest<ProductDTO>(url);

  return mapProductDTOToProduct(data);
}
