jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

jest.mock('react-native', () => {
  const React = require('react');
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
    Animated: {
      Value: jest.fn(function (val: any) {
        return {
          setValue: jest.fn(),
          interpolate: jest.fn(() => 0),
        };
      }),
      timing: jest.fn(() => ({
        start: jest.fn((cb?: any) => cb?.()),
      })),
      loop: jest.fn(() => ({
        start: jest.fn(),
        stop: jest.fn(),
      })),
      sequence: jest.fn(() => ({
        start: jest.fn(),
      })),
      Image: 'Image',
      View: 'View',
      createAnimatedComponent: (c: any) => c,
    },
    View: 'View',
    Text: 'Text',
    Image: 'Image',
    TouchableOpacity: 'TouchableOpacity',
    TouchableWithoutFeedback: 'TouchableWithoutFeedback',
    ActivityIndicator: 'ActivityIndicator',
    ScrollView: 'ScrollView',
    FlatList: ({ data, renderItem, ListEmptyComponent }: any) => {
      if (!data || data.length === 0) {
        return ListEmptyComponent ? React.createElement(ListEmptyComponent) : null;
      }
      return React.createElement(
        'View',
        null,
        data.map((item: any, index: number) =>
          React.createElement('View', { key: item.id || index }, renderItem({ item, index }))
        )
      );
    },
    Modal: ({ children, visible }: any) => (visible ? children : null),
  };
});

jest.mock('../theme', () => ({
  useAppTheme: () => ({
    isDark: false,
    colors: {
      background: '#FFFFFF',
      card: '#F8FAFC',
      border: '#E2E8F0',
      primary: '#1A73E8',
      secondary: '#5F6368',
      accent: '#10B981',
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      textPrimary: '#0F172A',
      textSecondary: '#64748B',
      textMuted: '#94A3B8',
      surfaceVariant: '#F1F5F9',
    },
  }),
}));

jest.mock('../services/backgroundDetection/mediaObserver', () => ({
  mediaObserverService: {
    generateThumbnail: jest.fn(async (uri: string, size: number) => {
      return `file:///data/user/0/com.contextvault/cache/thumbnails/thumb_mock_${size}.jpg`;
    }),
    deleteThumbnail: jest.fn(async () => true),
    queryRecentScreenshots: jest.fn(async () => []),
    queryScreenshotsPaged: jest.fn(async () => []),
  },
}));

jest.mock('../database', () => ({
  getDatabase: jest.fn(async () => ({
    executeSql: jest.fn(async () => [{ rows: { length: 0, item: () => null } }]),
  })),
  databaseService: {
    getDatabase: jest.fn(async () => ({
      executeSql: jest.fn(async () => [{ rows: { length: 0, item: () => null } }]),
    })),
    executeQuery: jest.fn(async () => []),
    executeCommand: jest.fn(async () => ({ rowsAffected: 1 })),
  },
}));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { MediaStorePathResolver } from '../utils/MediaStorePathResolver';
import { thumbnailService } from '../services/ThumbnailService';
import { FileUtils } from '../utils/fileUtils';
import { ThumbnailImage } from '../components/ThumbnailImage';
import { ScreenshotCard } from '../components/ScreenshotCard';
import { FolderHeader } from '../components/FolderHeader';
import { Carousel } from '../components/Carousel';
import { ScreenshotModel } from '../models';

describe('ContextVault Sprint P0-B — Screenshot Rendering Engine Suite', () => {
  describe('1. Scoped Storage & OEM Path Resolution (MediaStorePathResolver)', () => {
    it('constructs Scoped Storage Content URI from deviceAssetId', () => {
      const uri = MediaStorePathResolver.resolveContentUri('', '55412');
      expect(uri).toBe('content://media/external/images/media/55412');
    });

    it('preserves valid Content URIs without re-prefixing', () => {
      const existingUri = 'content://media/external/images/media/8892';
      expect(MediaStorePathResolver.resolveContentUri(existingUri)).toBe(existingUri);
    });

    it('resolves candidate list with Scoped Storage Content URI prioritised over raw path', () => {
      const candidates = MediaStorePathResolver.getCandidateUris({
        deviceAssetId: '9901',
        filePath: '/storage/emulated/0/DCIM/Screenshots/Screenshot_2026.png',
        thumbnailUri: 'file:///cache/thumb_9901.jpg',
      });

      expect(candidates[0]).toBe('file:///cache/thumb_9901.jpg');
      expect(candidates[1]).toBe('content://media/external/images/media/9901');
      expect(candidates[2]).toBe('file:///storage/emulated/0/DCIM/Screenshots/Screenshot_2026.png');
    });

    it('identifies screenshot paths across all Android OEM folders', () => {
      const oemPaths = [
        '/storage/emulated/0/DCIM/Screenshots/Screenshot_Samsung.png', // Samsung
        '/storage/emulated/0/Pictures/Screenshots/Screenshot_Pixel.jpg', // Pixel / Motorola
        '/storage/emulated/0/DCIM/Screenshots/Screenshot_Xiaomi.png', // Xiaomi
        '/storage/emulated/0/Pictures/Screenshots/Screenshot_OPPO.png', // OPPO / Realme / OnePlus
        '/storage/emulated/0/DCIM/Screenshots/Screenshot_Vivo.png', // Vivo / iQOO
      ];

      for (const p of oemPaths) {
        expect(MediaStorePathResolver.isLikelyScreenshotPath(p)).toBe(true);
      }
    });

    it('rejects regular camera and downloaded photos from screenshot classification', () => {
      expect(MediaStorePathResolver.isLikelyScreenshotPath('/storage/emulated/0/DCIM/Camera/IMG_20260912.jpg')).toBe(false);
      expect(MediaStorePathResolver.isLikelyScreenshotPath('/storage/emulated/0/Download/document.pdf')).toBe(false);
    });
  });

  describe('2. Hardware-Accelerated Thumbnail Service', () => {
    beforeEach(async () => {
      await thumbnailService.clearCache();
    });

    it('generates a cached thumbnail using Android native hardware decoder', async () => {
      const thumb = await thumbnailService.getOrCreateThumbnail(
        'content://media/external/images/media/12345',
        300,
        'sc_001'
      );
      expect(thumb).toContain('thumb_mock_300');
    });

    it('caches generated thumbnail in memory for subsequent synchronous reads', async () => {
      const testUri = 'content://media/external/images/media/77777';
      const first = await thumbnailService.getOrCreateThumbnail(testUri, 300);
      const second = await thumbnailService.getOrCreateThumbnail(testUri, 300);

      expect(first).toBe(second);
      const stats = await thumbnailService.getCacheStats();
      expect(stats.inMemoryCount).toBeGreaterThanOrEqual(1);
    });

    it('deletes cached thumbnail and purges memory entry', async () => {
      const testUri = 'content://media/external/images/media/88888';
      const thumb = await thumbnailService.getOrCreateThumbnail(testUri, 300);
      expect(thumb).toBeTruthy();

      const deleted = await thumbnailService.deleteThumbnail(thumb);
      expect(deleted).toBe(true);
    });
  });

  describe('3. ThumbnailImage Component', () => {
    it('renders Image component with Scoped Storage Content URI source', async () => {
      let renderer: TestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = TestRenderer.create(
          <ThumbnailImage
            contentUri="content://media/external/images/media/4001"
            size={120}
            borderRadius={8}
          />
        );
      });

      const images = renderer!.root.findAllByType('Image' as any);
      expect(images.length).toBe(1);
      expect(images[0].props.source.uri).toContain('thumb_mock_120');
      expect(images[0].props.source.cache).toBe('force-cache');
    });

    it('renders fallback icon when source URI is completely empty', () => {
      let renderer: TestRenderer.ReactTestRenderer;
      act(() => {
        renderer = TestRenderer.create(
          <ThumbnailImage uri="" fallbackIcon="image-outline" size={100} />
        );
      });

      const images = renderer!.root.findAllByType('Image' as any);
      expect(images.length).toBe(0);

      const icons = renderer!.root.findAllByType('Icon' as any);
      expect(icons.length).toBeGreaterThan(0);
      expect(icons[0].props.name).toBe('image-outline');
    });
  });

  describe('4. ScreenshotCard Component', () => {
    const mockScreenshot: ScreenshotModel = {
      id: 'sc_test_1',
      deviceAssetId: '1001',
      filePath: '/storage/emulated/0/Pictures/Screenshots/Receipt_Walmart.png',
      fileName: 'Receipt_Walmart.png',
      createdAt: '2026-09-17T12:00:00Z',
      fileSize: 1024 * 500, // 500 KB
      width: 1080,
      height: 2400,
      categoryId: 'receipts',
      categoryName: 'Receipts',
      subcategory: 'Groceries',
      confidence: 0.96,
      isFavorite: true,
      isAutoCategorized: true,
      isReviewed: true,
      isSynced: true,
      ocrStatus: 'completed',
      tags: [],
    };

    it('renders thumbnail, file name, and favorite badge', () => {
      let renderer: TestRenderer.ReactTestRenderer;
      act(() => {
        renderer = TestRenderer.create(
          <ScreenshotCard screenshot={mockScreenshot} onPress={jest.fn()} />
        );
      });

      const texts = renderer!.root.findAllByType('Text' as any);
      const fileText = texts.find((t) => t.props.children === 'Receipt_Walmart.png');
      expect(fileText).toBeTruthy();

      const icons = renderer!.root.findAllByType('Icon' as any);
      const heartIcon = icons.find((i) => i.props.name === 'heart');
      expect(heartIcon).toBeTruthy();
    });

    it('renders selection checkbox when in multi-select mode', () => {
      let renderer: TestRenderer.ReactTestRenderer;
      act(() => {
        renderer = TestRenderer.create(
          <ScreenshotCard screenshot={mockScreenshot} isSelectMode isSelected onPress={jest.fn()} />
        );
      });

      const icons = renderer!.root.findAllByType('Icon' as any);
      const checkIcon = icons.find((i) => i.props.name === 'checkmark-circle');
      expect(checkIcon).toBeTruthy();
    });
  });

  describe('5. FolderHeader Component', () => {
    it('displays folder title, formatted count, and total storage size', () => {
      let renderer: TestRenderer.ReactTestRenderer;
      act(() => {
        renderer = TestRenderer.create(
          <FolderHeader
            title="Finance & Taxes"
            count={24}
            totalBytes={1024 * 1024 * 32} // 32 MB
            coverUri="content://media/external/images/media/501"
          />
        );
      });

      const texts = renderer!.root.findAllByType('Text' as any);
      const title = texts.find((t) => t.props.children === 'Finance & Taxes');
      expect(title).toBeTruthy();

      const metaText = texts.find((t) => {
        const textStr = Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children);
        return textStr.includes('24 screenshots') && textStr.includes('32 MB');
      });
      expect(metaText).toBeTruthy();
    });
  });

  describe('6. Carousel Component (Horizontal Dashboard Gallery)', () => {
    it('renders horizontal carousel with screenshot cards', () => {
      const items: ScreenshotModel[] = [
        {
          id: 'sc_c1',
          deviceAssetId: '201',
          filePath: '/storage/emulated/0/DCIM/Screenshots/Shot1.png',
          fileName: 'Shot1.png',
          createdAt: '2026-09-17T12:00:00Z',
          fileSize: 1024 * 200,
          width: 1080,
          height: 2400,
          categoryId: 'work',
          categoryName: 'Work',
          subcategory: '',
          confidence: 0.9,
          isFavorite: false,
          isReviewed: false,
          isSynced: false,
          ocrStatus: 'none',
          tags: [],
        },
      ];

      let renderer: TestRenderer.ReactTestRenderer;
      act(() => {
        renderer = TestRenderer.create(
          <Carousel
            screenshots={items}
            onSelectScreenshot={jest.fn()}
          />
        );
      });

      const texts = renderer!.root.findAllByType('Text' as any);
      const itemTitle = texts.find((t) => t.props.children === 'Shot1.png');
      expect(itemTitle).toBeTruthy();
    });
  });
});
