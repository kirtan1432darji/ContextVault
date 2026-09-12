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

  const envData = parseEnv(path.resolve(rootDir, selectedFile));
  const output = {
    apiBaseUrl: envData.API_BASE_URL || 'http://10.122.196.152:8000',
    environment: envData.ENVIRONMENT || (isProdTarget ? 'production' : 'local_release'),
    resolvedFrom: selectedFile,
    updatedAt: new Date().toISOString(),
  };

  const targetPath = path.resolve(rootDir, 'src', 'config', 'env.generated.json');
  fs.writeFileSync(targetPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`[sync-env] Synchronized environment from ${selectedFile}:`, output);
  return output;
}

if (require.main === module) {
  syncEnv();
}

module.exports = { syncEnv };
