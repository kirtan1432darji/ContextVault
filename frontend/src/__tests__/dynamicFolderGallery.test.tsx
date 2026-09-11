jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

jest.mock('react-native', () => {
  return {
    useColorScheme: jest.fn(() => 'light'),
    StyleSheet: {
      create: (styles: any) => styles,
      hairlineWidth: 1,
      absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    },
    Platform: {
      OS: 'android',
      select: (obj: any) => obj.android ?? obj.default,
    },
    Dimensions: {
      get: jest.fn(() => ({ width: 400, height: 800 })),
    },
    View: 'View',
    Text: 'Text',
    Image: 'Image',
    TouchableOpacity: 'TouchableOpacity',
    TouchableWithoutFeedback: 'TouchableWithoutFeedback',
    ActivityIndicator: 'ActivityIndicator',
    ScrollView: 'ScrollView',
    Modal: ({ children, visible }: any) => (visible ? children : null),
  };
});

jest.mock('../theme', () => ({
  useAppTheme: () => ({
    isDark: false,
    colors: {
      background: '#FFFFFF',
      card: '#FFFFFF',
      border: '#E5E7EB',
      primary: '#1A73E8',
      secondary: '#5F6368',
      accent: '#188038',
      success: '#188038',
      warning: '#F29900',
      error: '#D93025',
      textPrimary: '#202124',
      textSecondary: '#5F6368',
      textMuted: '#80868B',
    },
  }),
}));

import { useCategoryStore } from '../store/category.store';
import { useScreenshotStore } from '../store/screenshot.store';
import { CategoryModel, ScreenshotModel } from '../models';

describe('ContextVault Sprint P0-2 — Dynamic AI Folder Gallery Suite', () => {
  const mockCategories: CategoryModel[] = [
    {
      id: 'cat_projects',
      name: 'Projects',
      parentId: null,
      parentCategoryId: null,
      iconName: 'briefcase',
      colorHex: '6366F1',
      description: 'Work and Projects',
      isSystem: false,
      orderIndex: 1,
      screenshotCount: 5,
      isFavorite: false,
    },
    {
      id: 'cat_nhdc',
      name: 'NHDC',
      parentId: 'cat_projects',
      parentCategoryId: 'cat_projects',
      iconName: 'folder',
      colorHex: '6366F1',
      description: 'NHDC Client Work',
      isSystem: false,
      orderIndex: 2,
      screenshotCount: 3,
      isFavorite: false,
    },
    {
      id: 'cat_payroll',
      name: 'Payroll',
      parentId: 'cat_nhdc',
      parentCategoryId: 'cat_nhdc',
      iconName: 'cash',
      colorHex: '6366F1',
      description: 'Salary and Payslips',
      isSystem: false,
      orderIndex: 3,
      screenshotCount: 2,
      isFavorite: false,
    },
    {
      id: 'cat_shopping',
      name: 'Shopping',
      parentId: null,
      parentCategoryId: null,
      iconName: 'cart',
      colorHex: 'F97316',
      description: 'Shopping wishlist',
      isSystem: false,
      orderIndex: 4,
      screenshotCount: 1,
      isFavorite: false,
    },
  ];

  const mockScreenshots: ScreenshotModel[] = [
    {
      id: 'shot_1',
      deviceAssetId: 'asset_1',
      filePath: '/storage/emulated/0/Pictures/Screenshots/project_plan.png',
      fileName: 'project_plan.png',
      createdAt: '2026-09-10T10:00:00.000Z',
      width: 1080,
      height: 2400,
      fileSize: 102400,
      categoryId: 'cat_projects',
      categoryName: 'Projects',
      subcategory: 'Architecture',
      confidence: 0.95,
      isAutoCategorized: true,
      isFavorite: false,
      isReviewed: true,
      isSynced: true,
      ocrStatus: 'completed',
      ocrText: 'Project Architecture Blueprint Sprint 1',
      tags: [],
    },
    {
      id: 'shot_2',
      deviceAssetId: 'asset_2',
      filePath: '/storage/emulated/0/Pictures/Screenshots/nhdc_milestone.png',
      fileName: 'nhdc_milestone.png',
      createdAt: '2026-09-11T12:00:00.000Z',
      width: 1080,
      height: 2400,
      fileSize: 154000,
      categoryId: 'cat_nhdc',
      categoryName: 'NHDC',
      subcategory: 'Milestones',
      confidence: 0.92,
      isAutoCategorized: true,
      isFavorite: false,
      isReviewed: true,
      isSynced: true,
      ocrStatus: 'completed',
      ocrText: 'NHDC Deliverable Schedule Milestone 2',
      tags: [],
    },
    {
      id: 'shot_3',
      deviceAssetId: 'asset_3',
      filePath: '/storage/emulated/0/Pictures/Screenshots/payslip_august.png',
      fileName: 'payslip_august.png',
      createdAt: '2026-09-12T08:00:00.000Z',
      width: 1080,
      height: 2400,
      fileSize: 204800,
      categoryId: 'cat_payroll',
      categoryName: 'Payroll',
      subcategory: 'Payroll',
      confidence: 0.98,
      isAutoCategorized: true,
      isFavorite: true,
      isReviewed: true,
      isSynced: true,
      ocrStatus: 'completed',
      ocrText: 'NHDC Net Salary Payslip August Earnings Deductions',
      tags: [],
    },
  ];

  beforeEach(() => {
    useCategoryStore.getState().setCategories(mockCategories);
    useScreenshotStore.getState().setScreenshots(mockScreenshots);
  });

  describe('1. Recursive Descendant Category Resolution', () => {
    it('resolves leaf node category IDs correctly', () => {
      const descendants = useCategoryStore.getState().getDescendantCategoryIds('cat_payroll');
      expect(descendants).toEqual(['cat_payroll']);
    });

    it('resolves middle node category IDs and all its children', () => {
      const descendants = useCategoryStore.getState().getDescendantCategoryIds('cat_nhdc');
      expect(descendants).toContain('cat_nhdc');
      expect(descendants).toContain('cat_payroll');
      expect(descendants.length).toBe(2);
    });

    it('resolves root category IDs across multi-tier hierarchy (Projects -> NHDC -> Payroll)', () => {
      const descendants = useCategoryStore.getState().getDescendantCategoryIds('cat_projects');
      expect(descendants).toContain('cat_projects');
      expect(descendants).toContain('cat_nhdc');
      expect(descendants).toContain('cat_payroll');
      expect(descendants.length).toBe(3);
    });

    it('resolves isolated root category without children', () => {
      const descendants = useCategoryStore.getState().getDescendantCategoryIds('cat_shopping');
      expect(descendants).toEqual(['cat_shopping']);
    });
  });

  describe('2. Nested Folders Screenshot Display', () => {
    it('includes all screenshots across nested folders when querying root folder', () => {
      const rootDescendants = new Set(
        useCategoryStore.getState().getDescendantCategoryIds('cat_projects')
      );
      const allScreenshots = useScreenshotStore.getState().screenshots;

      const folderScreenshots = allScreenshots.filter((s) =>
        rootDescendants.has(s.categoryId)
      );

      expect(folderScreenshots.length).toBe(3);
      expect(folderScreenshots.map((s) => s.fileName)).toEqual([
        'project_plan.png',
        'nhdc_milestone.png',
        'payslip_august.png',
      ]);
    });

    it('filters screenshots strictly for intermediate subfolder', () => {
      const nhdcDescendants = new Set(
        useCategoryStore.getState().getDescendantCategoryIds('cat_nhdc')
      );
      const allScreenshots = useScreenshotStore.getState().screenshots;

      const folderScreenshots = allScreenshots.filter((s) =>
        nhdcDescendants.has(s.categoryId)
      );

      expect(folderScreenshots.length).toBe(2);
      expect(folderScreenshots.map((s) => s.fileName)).toEqual([
        'nhdc_milestone.png',
        'payslip_august.png',
      ]);
    });

    it('filters screenshots strictly for leaf subfolder', () => {
      const payrollDescendants = new Set(
        useCategoryStore.getState().getDescendantCategoryIds('cat_payroll')
      );
      const allScreenshots = useScreenshotStore.getState().screenshots;

      const folderScreenshots = allScreenshots.filter((s) =>
        payrollDescendants.has(s.categoryId)
      );

      expect(folderScreenshots.length).toBe(1);
      expect(folderScreenshots[0].fileName).toBe('payslip_august.png');
    });
  });

  describe('3. Dynamic Tree Construction & Hierarchy', () => {
    it('builds recursive category tree with correct levels and children', () => {
      const tree = useCategoryStore.getState().getCategoryTree();
      const projectsNode = tree.find((n) => n.id === 'cat_projects');

      expect(projectsNode).toBeDefined();
      expect(projectsNode!.level).toBe(0);
      expect(projectsNode!.children.length).toBe(1);

      const nhdcNode = projectsNode!.children[0];
      expect(nhdcNode.id).toBe('cat_nhdc');
      expect(nhdcNode.level).toBe(1);
      expect(nhdcNode.children.length).toBe(1);

      const payrollNode = nhdcNode.children[0];
      expect(payrollNode.id).toBe('cat_payroll');
      expect(payrollNode.level).toBe(2);
      expect(payrollNode.children.length).toBe(0);
    });
  });

  describe('4. Real-time Reactive Updates', () => {
    it('reactively updates screenshots list and folder counts when a new screenshot is added', () => {
      const newShot: ScreenshotModel = {
        id: 'shot_4',
        deviceAssetId: 'asset_4',
        filePath: '/storage/emulated/0/Pictures/Screenshots/nhdc_invoice.png',
        fileName: 'nhdc_invoice.png',
        createdAt: new Date().toISOString(),
        width: 1080,
        height: 2400,
        fileSize: 128000,
        categoryId: 'cat_nhdc',
        categoryName: 'NHDC',
        subcategory: 'Invoice',
        confidence: 0.94,
        isAutoCategorized: true,
        isFavorite: false,
        isReviewed: true,
        isSynced: true,
        ocrStatus: 'completed',
        ocrText: 'NHDC Invoice payment #456',
        tags: [],
      };

      // Add to store
      useScreenshotStore.getState().addOrUpdateScreenshot(newShot);

      // Verify screenshot store updated
      const updatedScreenshots = useScreenshotStore.getState().screenshots;
      expect(updatedScreenshots.length).toBe(4);

      // Verify root folder now resolves 4 screenshots
      const rootDescendants = new Set(
        useCategoryStore.getState().getDescendantCategoryIds('cat_projects')
      );
      const rootShots = updatedScreenshots.filter((s) =>
        rootDescendants.has(s.categoryId)
      );
      expect(rootShots.length).toBe(4);
      expect(rootShots.some((s) => s.id === 'shot_4')).toBe(true);

      // Update count in category store
      useCategoryStore.getState().setCategoryCount('cat_projects', 6);
      const updatedCat = useCategoryStore.getState().getCategoryById('cat_projects');
      expect(updatedCat?.screenshotCount).toBe(6);
    });
  });
});
