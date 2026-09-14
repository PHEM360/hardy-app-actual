import {
  DEFAULT_SHARED_CATEGORY_SETTINGS,
  sortCategoriesOtherLast,
  type SharedCategorySettings,
} from "@/types/app";

/** Prefer the saved list (including empty). Only fall back to defaults when the field was never written. */
export function normalizeSharedCategories(
  settings: Partial<SharedCategorySettings> | undefined,
): SharedCategorySettings {
  return {
    incomeCategories: sortCategoriesOtherLast(
      Array.isArray(settings?.incomeCategories)
        ? settings.incomeCategories.map((item) => String(item).trim()).filter(Boolean)
        : DEFAULT_SHARED_CATEGORY_SETTINGS.incomeCategories,
    ),
    expenseCategories: sortCategoriesOtherLast(
      Array.isArray(settings?.expenseCategories)
        ? settings.expenseCategories.map((item) => String(item).trim()).filter(Boolean)
        : DEFAULT_SHARED_CATEGORY_SETTINGS.expenseCategories,
    ),
    documentCategories: sortCategoriesOtherLast(
      Array.isArray(settings?.documentCategories)
        ? settings.documentCategories.map((item) => String(item).trim()).filter(Boolean)
        : DEFAULT_SHARED_CATEGORY_SETTINGS.documentCategories,
    ),
  };
}
