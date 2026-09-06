import { create } from 'zustand';
import { CategoryModel, DEFAULT_CATEGORIES } from '../models';

interface CategoryState {
  categories: CategoryModel[];
  selectedCategoryId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setCategories: (categories: CategoryModel[]) => void;
  selectCategory: (categoryId: string | null) => void;
  setCategoryCount: (categoryId: string, count: number) => void;
  getCategoryById: (id: string) => CategoryModel | undefined;
  getRootCategories: () => CategoryModel[];
  getSubcategories: (parentId: string) => CategoryModel[];
}

export const useCategoryStore = create<CategoryState>((set, get) => ({
  categories: DEFAULT_CATEGORIES,
  selectedCategoryId: null,
  isLoading: false,
  error: null,

  setCategories: (categories: CategoryModel[]) => set({ categories }),

  selectCategory: (categoryId: string | null) => set({ selectedCategoryId: categoryId }),

  setCategoryCount: (categoryId: string, count: number) => {
    set((state) => ({
      categories: state.categories.map((c) =>
        c.id === categoryId ? { ...c, screenshotCount: count } : c
      ),
    }));
  },

  getCategoryById: (id: string) => {
    return get().categories.find((c) => c.id === id);
  },

  getRootCategories: () => {
    return get().categories.filter((c) => !c.parentId || c.parentId.trim() === '');
  },

  getSubcategories: (parentId: string) => {
    return get().categories.filter((c) => c.parentId === parentId);
  },
}));
