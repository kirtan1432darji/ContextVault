const fs = require('fs');
const path = require('path');

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return env;
}

function syncEnv() {
  const rootDir = path.resolve(__dirname, '..');
  const isProdTarget = process.env.APP_ENV === 'production';
  
  let selectedFile = '.env.development';
  if (isProdTarget) {
    selectedFile = '.env.production';
  } else if (fs.existsSync(path.resolve(rootDir, '.env.production.local'))) {
    selectedFile = '.env.production.local';
  }

  const dotEnvData = parseEnv(path.resolve(rootDir, '.env'));
  const fileEnvData = parseEnv(path.resolve(rootDir, selectedFile));
  const localEnvData = parseEnv(path.resolve(rootDir, '.env.local'));
  const envData = { ...dotEnvData, ...fileEnvData, ...localEnvData };
  const qwenApiKey = envData.QWEN_API_KEY || envData.DASHSCOPE_API_KEY || '';

  const output = {
    apiBaseUrl: envData.API_BASE_URL || 'http://10.187.86.152:8000',
    environment: envData.ENVIRONMENT || (isProdTarget ? 'production' : 'local_release'),
    visionProvider: 'local',
    visionServerUrl: envData.VISION_SERVER_URL || `${envData.API_BASE_URL || 'http://10.187.86.152:8000'}/api/vision`,
    visionTimeout: parseInt(envData.VISION_TIMEOUT || '120', 10),
    qwenApiKey: qwenApiKey,
    resolvedFrom: selectedFile,
    updatedAt: new Date().toISOString(),
  };

  const targetPath = path.resolve(rootDir, 'src', 'config', 'env.generated.json');
  if (fs.existsSync(targetPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
      if (
        existing.apiBaseUrl === output.apiBaseUrl &&
        existing.environment === output.environment &&
        existing.visionProvider === output.visionProvider &&
        existing.visionServerUrl === output.visionServerUrl &&
        existing.visionTimeout === output.visionTimeout &&
        existing.openAiApiKey === output.openAiApiKey &&
        existing.resolvedFrom === output.resolvedFrom
      ) {
        return existing;
      }
    } catch (_) {}
  }

  fs.writeFileSync(targetPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`[sync-env] Synchronized environment from ${selectedFile}:`, output);
  return output;
}

if (require.main === module) {
  syncEnv();
}

module.exports = { syncEnv };
