import 'react-native';

declare module 'react-native' {
  namespace StyleSheet {
    interface AbsoluteFillStyle {
      position: 'absolute';
      left: 0;
      right: 0;
      top: 0;
      bottom: 0;
    }
    export const absoluteFillObject: AbsoluteFillStyle;
  }
}
