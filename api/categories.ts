import { apiRequest } from "./client";
import { buildApiUrl, API_ENDPOINTS } from "./config";
import { Category } from "../types";

interface CategoryDTO {
  category_id: number;
  name: string;
}

function mapCategoryDTOToCategory(dto: CategoryDTO): Category {
  return {
    category_id: String(dto.category_id),
    name: dto.name,
  };
}

export async function getCategories(): Promise<Category[]> {
  const url = buildApiUrl(API_ENDPOINTS.CATEGORIES);
  const data = await apiRequest<CategoryDTO[]>(url);

  return data
    .map(mapCategoryDTOToCategory)
    .sort((a, b) => parseInt(a.category_id) - parseInt(b.category_id));
}
