if (!process.env._SYNC_ENV_DONE) {
  process.env._SYNC_ENV_DONE = '1';
  try {
    require('./scripts/sync-env').syncEnv();
  } catch (e) {
    // Graceful fallback
  }
}

module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@': './src',
        },
      },
    ],
    'react-native-reanimated/plugin',
  ],
};
