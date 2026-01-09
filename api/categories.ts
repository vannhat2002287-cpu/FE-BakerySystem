import { apiRequest } from "./client";
import { buildApiUrl, API_ENDPOINTS } from "./config";
import { Category } from "../types";

// DTO từ Backend
interface CategoryDTO {
  category_id: number;
  name: string;
}

// Chuyển DTO sang format Frontend
function mapCategoryDTOToCategory(dto: CategoryDTO): Category {
  return {
    category_id: String(dto.category_id),
    name: dto.name,
  };
}

// Lấy danh sách danh mục (sắp xếp theo ID)
export async function getCategories(): Promise<Category[]> {
  const url = buildApiUrl(API_ENDPOINTS.CATEGORIES);
  const data = await apiRequest<CategoryDTO[]>(url);

  return data
    .map(mapCategoryDTOToCategory)
    .sort((a, b) => Number.parseInt(a.category_id) - Number.parseInt(b.category_id));
}
