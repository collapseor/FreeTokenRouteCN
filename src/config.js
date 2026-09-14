const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function loadConfig() {
  const configPath = path.join(process.cwd(), 'config.yaml');
  let fileConfig = {};

  if (fs.existsSync(configPath)) {
    fileConfig = yaml.load(fs.readFileSync(configPath, 'utf8')) || {};
  }

  const config = {
    server: {
      port: fileConfig.server?.port || 3000,
      auth: fileConfig.server?.auth || false,
      apiKey: fileConfig.server?.api_key || '',
    },
    providers: {},
    logging: {
      level: fileConfig.logging?.level || 'info',
    },
  };

  // Load provider configs from file
  if (fileConfig.providers) {
    for (const [name, providerConfig] of Object.entries(fileConfig.providers)) {
      config.providers[name] = { ...providerConfig };
    }
  }

  // Override with env vars: FTRCN_<PROVIDER>_API_KEY
  for (const name of Object.keys(config.providers)) {
    const envKey = `FTRCN_${name.toUpperCase()}_API_KEY`;
    if (process.env[envKey]) {
      config.providers[name].api_key = process.env[envKey];
    }
  }

  return config;
}

module.exports = { loadConfig };
