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
      card: '#F8FAFC',
      border: '#E2E8F0',
      primary: '#6366F1',
      secondary: '#64748B',
      accent: '#8B5CF6',
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      textPrimary: '#0F172A',
      textSecondary: '#64748B',
      textMuted: '#94A3B8',
    },
  }),
}));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { FileUtils } from '../utils/fileUtils';
import { ScreenshotImageThumbnail } from '../components/ScreenshotImageThumbnail';

describe('ContextVault Screenshot Gallery & Image Preview Suite (P0)', () => {
  describe('FileUtils.normalizeImageUri()', () => {
    it('returns empty string for empty, whitespace, null, or undefined paths', () => {
      expect(FileUtils.normalizeImageUri('')).toBe('');
      expect(FileUtils.normalizeImageUri('   ')).toBe('');
      expect(FileUtils.normalizeImageUri(null as any)).toBe('');
      expect(FileUtils.normalizeImageUri(undefined as any)).toBe('');
    });

    it('preserves Android MediaStore content URIs as-is', () => {
      const contentUri = 'content://media/external/images/media/10042';
      expect(FileUtils.normalizeImageUri(contentUri)).toBe(contentUri);
    });

    it('preserves existing file:// schemes', () => {
      const fileUri = 'file:///storage/emulated/0/DCIM/Screenshots/shot.png';
      expect(FileUtils.normalizeImageUri(fileUri)).toBe(fileUri);
    });

    it('prefixes absolute Unix/Android device paths with file://', () => {
      const unixPath = '/storage/emulated/0/Pictures/Screenshots/Screenshot_20260912.png';
      expect(FileUtils.normalizeImageUri(unixPath)).toBe(`file://${unixPath}`);
    });

    it('normalizes Windows drive paths into valid file:/// URIs with forward slashes', () => {
      const winPathBackslash = 'C:\\ContextVault\\Screenshots\\test.png';
      expect(FileUtils.normalizeImageUri(winPathBackslash)).toBe('file:///C:/ContextVault/Screenshots/test.png');

      const winPathForward = 'D:/Images/screenshot.jpg';
      expect(FileUtils.normalizeImageUri(winPathForward)).toBe('file:///D:/Images/screenshot.jpg');
    });

    it('preserves remote HTTP and HTTPS URLs', () => {
      expect(FileUtils.normalizeImageUri('https://example.com/screenshot.png')).toBe('https://example.com/screenshot.png');
      expect(FileUtils.normalizeImageUri('http://localhost:8000/media/1.jpg')).toBe('http://localhost:8000/media/1.jpg');
    });

    it('preserves Base64 data URIs', () => {
      const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      expect(FileUtils.normalizeImageUri(dataUri)).toBe(dataUri);
    });
  });

  describe('FileUtils.isValidImageUri()', () => {
    it('accurately identifies valid and invalid image URI structures', () => {
      expect(FileUtils.isValidImageUri('content://media/123')).toBe(true);
      expect(FileUtils.isValidImageUri('file:///storage/123.png')).toBe(true);
      expect(FileUtils.isValidImageUri('https://domain.com/img.png')).toBe(true);
      expect(FileUtils.isValidImageUri('data:image/jpeg;base64,abc')).toBe(true);
      expect(FileUtils.isValidImageUri('')).toBe(false);
      expect(FileUtils.isValidImageUri('   ')).toBe(false);
      expect(FileUtils.isValidImageUri('invalid_uri_format')).toBe(false);
    });
  });

  describe('ScreenshotImageThumbnail Component', () => {
    it('renders Image component with normalized file:// URI when given a valid local path', () => {
      let renderer: TestRenderer.ReactTestRenderer;
      act(() => {
        renderer = TestRenderer.create(
          <ScreenshotImageThumbnail filePath="/storage/emulated/0/Pictures/Screenshots/shot1.png" />
        );
      });

      const images = renderer!.root.findAllByType('Image');
      expect(images.length).toBe(1);
      expect(images[0].props.source).toEqual({
        uri: 'file:///storage/emulated/0/Pictures/Screenshots/shot1.png',
        cache: 'force-cache',
      });
      expect(images[0].props.resizeMode).toBe('cover');
    });

    it('renders placeholder fallback icon when filePath is empty', () => {
      let renderer: TestRenderer.ReactTestRenderer;
      act(() => {
        renderer = TestRenderer.create(
          <ScreenshotImageThumbnail filePath="" fallbackIcon="image-outline" />
        );
      });

      const images = renderer!.root.findAllByType('Image');
      expect(images.length).toBe(0);

      const fallbacks = renderer!.root.findAllByProps({ testID: 'thumbnail-fallback' });
      expect(fallbacks.length).toBe(1);
    });

    it('falls back to placeholder when image onError triggers', () => {
      let renderer: TestRenderer.ReactTestRenderer;
      act(() => {
        renderer = TestRenderer.create(
          <ScreenshotImageThumbnail filePath="/non/existent/path.png" />
        );
      });

      // Initially renders Image
      const imageComponent = renderer!.root.findByType('Image');
      expect(imageComponent).toBeTruthy();

      // Trigger onError
      act(() => {
        imageComponent.props.onError();
      });

      // Image should now be replaced with fallback
      const imagesAfterError = renderer!.root.findAllByType('Image');
      expect(imagesAfterError.length).toBe(0);

      const fallbacks = renderer!.root.findAllByProps({ testID: 'thumbnail-fallback' });
      expect(fallbacks.length).toBe(1);
    });

    it('supports custom press handler and accessibility attributes', () => {
      const mockPress = jest.fn();
      let renderer: TestRenderer.ReactTestRenderer;
      act(() => {
        renderer = TestRenderer.create(
          <ScreenshotImageThumbnail
            filePath="/storage/shot.png"
            onPress={mockPress}
          />
        );
      });

      const touchable = renderer!.root.findByType('TouchableOpacity');
      expect(touchable).toBeTruthy();
      expect(touchable.props.accessibilityRole).toBe('button');

      act(() => {
        touchable.props.onPress();
      });
      expect(mockPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('Gallery Grid Masonry & Smart Folder Previews', () => {
    it('computes proportional masonry aspect-ratio height clamped within bounds', () => {
      const columnWidth = 180;
      const calculateHeight = (width?: number, height?: number, index = 0) => {
        if (width && height && width > 0) {
          const ratio = height / width;
          return Math.round(Math.max(130, Math.min(220, (columnWidth - 16) * ratio)));
        }
        return index % 3 === 0 ? 190 : index % 2 === 0 ? 150 : 170;
      };

      // Standard 16:9 vertical screenshot (1080x1920) -> should clamp to max (220)
      expect(calculateHeight(1080, 1920)).toBe(220);

      // Landscape receipt (1080x600) -> proportional within bounds
      expect(calculateHeight(1080, 600)).toBe(130);

      // Square receipt (1000x1000) -> 1:1 ratio
      expect(calculateHeight(1000, 1000)).toBe(164);

      // Unknown dimensions -> alternating staggered heights
      expect(calculateHeight(undefined, undefined, 0)).toBe(190);
      expect(calculateHeight(undefined, undefined, 1)).toBe(170);
      expect(calculateHeight(undefined, undefined, 2)).toBe(150);
    });

    it('correctly associates and extracts folder thumbnails for Smart Folders', () => {
      const sampleScreenshots = [
        { id: '1', categoryId: 'cat_finance', categoryName: 'Finance', filePath: '/storage/finance1.png' },
        { id: '2', categoryId: 'cat_finance', categoryName: 'Finance', filePath: '/storage/finance2.png' },
        { id: '3', categoryId: 'cat_travel', categoryName: 'Travel', filePath: '/storage/travel1.png' },
        { id: '4', categoryId: 'other', categoryName: 'Finance', filePath: '/storage/finance3.png' },
      ];

      const getFolderScreenshots = (folderId: string, folderName: string) => {
        return sampleScreenshots.filter(
          (s) => s.categoryId === folderId || s.categoryName.toLowerCase() === folderName.toLowerCase()
        );
      };

      const financeShots = getFolderScreenshots('cat_finance', 'Finance');
      expect(financeShots.length).toBe(3);
      expect(financeShots.map((s) => s.id)).toEqual(['1', '2', '4']);

      const travelShots = getFolderScreenshots('cat_travel', 'Travel');
      expect(travelShots.length).toBe(1);
      expect(travelShots[0].id).toBe('3');

      const emptyFolderShots = getFolderScreenshots('cat_empty', 'Empty Folder');
      expect(emptyFolderShots.length).toBe(0);
    });
  });
});
