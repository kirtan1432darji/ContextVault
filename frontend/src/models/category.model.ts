export interface CategoryModel {
  id: string;
  name: string;
  parentId?: string | null;
  parentCategoryId?: string | null;
  iconName: string;
  icon?: string;
  colorHex: string;
  color?: string;
  description?: string;
  isSystem: boolean;
  orderIndex: number;
  screenshotCount?: number;
  isFavorite?: boolean;
  path?: string;
  createdOn?: string;
  subCategories?: CategoryModel[];
}

export const UNSORTED_CATEGORY_ID = 'unsorted';
export const UNSORTED_CATEGORY_NAME = 'Unsorted';

export const UNSORTED_CATEGORY: CategoryModel = {
  id: UNSORTED_CATEGORY_ID,
  name: UNSORTED_CATEGORY_NAME,
  parentId: null,
  parentCategoryId: null,
  iconName: 'help-circle-outline',
  colorHex: '94A3B8',
  description: 'Screenshots awaiting AI classification',
  isSystem: true,
  orderIndex: 999,
  screenshotCount: 0,
  isFavorite: false,
  path: '/Unsorted',
  createdOn: new Date().toISOString(),
  subCategories: [],
};

export const DEFAULT_CATEGORIES: CategoryModel[] = [
  {
    id: 'projects',
    name: 'Projects',
    parentId: null,
    parentCategoryId: null,
    iconName: 'briefcase-outline',
    colorHex: '6366F1',
    description: 'Work projects, sprints, tasks & deliverables',
    isSystem: true,
    orderIndex: 1,
    screenshotCount: 0,
    isFavorite: false,
    path: '/Projects',
    createdOn: new Date().toISOString(),
    subCategories: [],
  },
  {
    id: 'finance',
    name: 'Finance',
    parentId: null,
    parentCategoryId: null,
    iconName: 'wallet-outline',
    colorHex: '10B981',
    description: 'Payments, bank statements, UPI & bills',
    isSystem: true,
    orderIndex: 2,
    screenshotCount: 0,
    isFavorite: false,
    path: '/Finance',
    createdOn: new Date().toISOString(),
    subCategories: [],
  },
  {
    id: 'shopping',
    name: 'Shopping',
    parentId: null,
    parentCategoryId: null,
    iconName: 'bag-handle-outline',
    colorHex: 'F97316',
    description: 'Orders, wishlists, shoes, apparel & electronics',
    isSystem: true,
    orderIndex: 3,
    screenshotCount: 0,
    isFavorite: false,
    path: '/Shopping',
    createdOn: new Date().toISOString(),
    subCategories: [],
  },
  {
    id: 'learning',
    name: 'Learning',
    parentId: null,
    parentCategoryId: null,
    iconName: 'school-outline',
    colorHex: '3B82F6',
    description: 'Tutorials, Flutter, React, articles & courses',
    isSystem: true,
    orderIndex: 4,
    screenshotCount: 0,
    isFavorite: false,
    path: '/Learning',
    createdOn: new Date().toISOString(),
    subCategories: [],
  },
  {
    id: 'travel',
    name: 'Travel',
    parentId: null,
    parentCategoryId: null,
    iconName: 'airplane-outline',
    colorHex: '06B6D4',
    description: 'Flights, hotel bookings, itineraries & tickets',
    isSystem: true,
    orderIndex: 5,
    screenshotCount: 0,
    isFavorite: false,
    path: '/Travel',
    createdOn: new Date().toISOString(),
    subCategories: [],
  },
  {
    id: 'social',
    name: 'Social',
    parentId: null,
    parentCategoryId: null,
    iconName: 'chatbubble-ellipses-outline',
    colorHex: 'EC4899',
    description: 'WhatsApp, Telegram, chats & messages',
    isSystem: true,
    orderIndex: 6,
    screenshotCount: 0,
    isFavorite: false,
    path: '/Social',
    createdOn: new Date().toISOString(),
    subCategories: [],
  },
  {
    id: 'documents',
    name: 'Documents',
    parentId: null,
    parentCategoryId: null,
    iconName: 'document-text-outline',
    colorHex: 'F59E0B',
    description: 'IDs, contracts, certificates & forms',
    isSystem: true,
    orderIndex: 7,
    screenshotCount: 0,
    isFavorite: false,
    path: '/Documents',
    createdOn: new Date().toISOString(),
    subCategories: [],
  },
  {
    id: 'tech',
    name: 'Tech',
    parentId: null,
    parentCategoryId: null,
    iconName: 'code-slash-outline',
    colorHex: '8B5CF6',
    description: 'Code snippets, error logs, GitHub & terminal',
    isSystem: true,
    orderIndex: 8,
    screenshotCount: 0,
    isFavorite: false,
    path: '/Tech',
    createdOn: new Date().toISOString(),
    subCategories: [],
  },
  UNSORTED_CATEGORY,
];
