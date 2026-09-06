import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { screenshotDetectionHeadlessTask } from './src/services/backgroundDetection/headlessTask';

AppRegistry.registerComponent(appName, () => App);
AppRegistry.registerHeadlessTask('ScreenshotDetectionTask', () => screenshotDetectionHeadlessTask);
