export interface CategoryModel {
  id: string;
  name: string;
  parentId?: string | null;
  iconName: string;
  colorHex: string;
  description?: string;
  isSystem: boolean;
  orderIndex: number;
  screenshotCount?: number;
  subCategories?: CategoryModel[];
}

export const UNSORTED_CATEGORY_ID = 'unsorted';
export const UNSORTED_CATEGORY_NAME = 'Unsorted';

export const UNSORTED_CATEGORY: CategoryModel = {
  id: UNSORTED_CATEGORY_ID,
  name: UNSORTED_CATEGORY_NAME,
  iconName: 'help-circle-outline',
  colorHex: '94A3B8',
  description: 'Screenshots awaiting AI classification',
  isSystem: true,
  orderIndex: 999,
  screenshotCount: 0,
  subCategories: [],
};

export const DEFAULT_CATEGORIES: CategoryModel[] = [
  {
    id: 'receipts-invoices',
    name: 'Receipts & Invoices',
    iconName: 'receipt-outline',
    colorHex: '10B981',
    description: 'Receipts, bills, orders & invoices',
    isSystem: true,
    orderIndex: 1,
    screenshotCount: 0,
    subCategories: [],
  },
  {
    id: 'finance-banking',
    name: 'Finance & Banking',
    iconName: 'wallet-outline',
    colorHex: '3B82F6',
    description: 'Bank statements, UPI, crypto & investments',
    isSystem: true,
    orderIndex: 2,
    screenshotCount: 0,
    subCategories: [],
  },
  {
    id: 'code-tech',
    name: 'Code & Tech',
    iconName: 'code-slash-outline',
    colorHex: '8B5CF6',
    description: 'Code snippets, error logs & terminal',
    isSystem: true,
    orderIndex: 3,
    screenshotCount: 0,
    subCategories: [],
  },
  {
    id: 'social-chat',
    name: 'Social & Chat',
    iconName: 'chatbubble-ellipses-outline',
    colorHex: 'EC4899',
    description: 'WhatsApp, Telegram, Twitter, Instagram & chats',
    isSystem: true,
    orderIndex: 4,
    screenshotCount: 0,
    subCategories: [],
  },
  {
    id: 'documents-ids',
    name: 'Documents & IDs',
    iconName: 'document-text-outline',
    colorHex: 'F59E0B',
    description: 'Passports, IDs, certificates & contracts',
    isSystem: true,
    orderIndex: 5,
    screenshotCount: 0,
    subCategories: [],
  },
  {
    id: 'travel-tickets',
    name: 'Travel & Tickets',
    iconName: 'airplane-outline',
    colorHex: '06B6D4',
    description: 'Boarding passes, train tickets & hotel bookings',
    isSystem: true,
    orderIndex: 6,
    screenshotCount: 0,
    subCategories: [],
  },
  {
    id: 'shopping-wishlist',
    name: 'Shopping & Wishlist',
    iconName: 'bag-handle-outline',
    colorHex: 'F97316',
    description: 'Product carts, wishlists & coupons',
    isSystem: true,
    orderIndex: 7,
    screenshotCount: 0,
    subCategories: [],
  },
  {
    id: 'notes-knowledge',
    name: 'Notes & Knowledge',
    iconName: 'create-outline',
    colorHex: '6366F1',
    description: 'Articles, recipes, notes & research',
    isSystem: true,
    orderIndex: 8,
    screenshotCount: 0,
    subCategories: [],
  },
  {
    id: 'memes-humor',
    name: 'Memes & Humor',
    iconName: 'happy-outline',
    colorHex: 'EAB308',
    description: 'Memes, jokes & funny snapshots',
    isSystem: true,
    orderIndex: 9,
    screenshotCount: 0,
    subCategories: [],
  },
  UNSORTED_CATEGORY,
];
