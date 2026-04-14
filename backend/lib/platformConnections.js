const db = require('../db');

const PLATFORM_CONNECTION_DEFINITIONS = {
  baidu: {
    label: '百度营销',
    supportedAuthTypes: ['account_password_token'],
    authTypes: {
      account_password_token: {
        label: '账号 + 密码 + Token',
        fields: [
          { key: 'username', label: '用户名', secret: false, required: true },
          { key: 'password', label: '密码', secret: true, required: true },
          { key: 'token', label: '开发者 Token', secret: true, required: true }
        ]
      },
      oauth2: { label: 'OAuth 2.0', fields: [], supported: false }
    }
  },
  kuaishou: {
    label: '快手磁力金牛',
    supportedAuthTypes: ['app_access_token'],
    authTypes: {
      app_access_token: {
        label: 'App 凭证 + Access Token',
        fields: [
          { key: 'appId', label: 'App ID', secret: false, required: true },
          { key: 'appSecret', label: 'App Secret', secret: true, required: true },
          { key: 'accessToken', label: 'Access Token', secret: true, required: true }
        ]
      },
      oauth2: { label: 'OAuth 2.0', fields: [], supported: false }
    }
  },
  jliang: {
    label: '巨量引擎',
    supportedAuthTypes: ['marketing_token'],
    authTypes: {
      marketing_token: {
        label: 'Marketing API Token',
        fields: [
          { key: 'appId', label: 'App ID', secret: false, required: true },
          { key: 'accessToken', label: 'Access Token', secret: true, required: true },
          { key: 'advertiserId', label: '广告主 ID', secret: false, required: true }
        ]
      },
      oauth2: { label: 'OAuth 2.0', fields: [], supported: false }
    }
  },
  google: {
    label: 'Google Ads',
    supportedAuthTypes: ['ads_api'],
    authTypes: {
      ads_api: {
        label: 'Ads API 凭证',
        fields: [
          { key: 'clientId', label: 'Client ID', secret: false, required: true },
          { key: 'clientSecret', label: 'Client Secret', secret: true, required: true },
          { key: 'developerToken', label: 'Developer Token', secret: true, required: true },
          { key: 'customerId', label: 'Customer ID', secret: false, required: true }
        ]
      },
      oauth2: { label: 'OAuth 2.0', fields: [], supported: false }
    }
  }
};

function parseConfig(configJson) {
  if (!configJson) return {};
  try {
    return JSON.parse(configJson);
  } catch {
    return {};
  }
}

function serializeConnectionDetail(row) {
  const definition = PLATFORM_CONNECTION_DEFINITIONS[row.platform];
  const config = parseConfig(row.config_json);
  const authDefinition = definition.authTypes[row.auth_type];
  const fields = Object.fromEntries(
    authDefinition.fields.map((field) => [
      field.key,
      field.secret
        ? { configured: Boolean(config[field.key]) }
        : { configured: Boolean(config[field.key]), value: config[field.key] ?? '' }
    ])
  );

  return {
    platform: row.platform,
    platformLabel: definition.label,
    auth_type: row.auth_type,
    status: row.status,
    updated_at: row.updated_at,
    updated_by: row.updated_by,
    fields
  };
}

function listAvailableAuthTypes(platform) {
  const definition = PLATFORM_CONNECTION_DEFINITIONS[platform];
  return Object.entries(definition.authTypes).map(([key, value]) => ({
    key,
    label: value.label,
    supported: definition.supportedAuthTypes.includes(key)
  }));
}

function validateConnectionPayload(platform, authType, config, previousConfig = {}) {
  const definition = PLATFORM_CONNECTION_DEFINITIONS[platform];
  if (!definition) throw new Error('不支持的平台');
  if (!definition.authTypes[authType]) throw new Error('无效的授权方式');
  if (!definition.supportedAuthTypes.includes(authType)) throw new Error('当前授权方式暂未支持');

  const merged = { ...previousConfig };
  const missing = [];

  for (const field of definition.authTypes[authType].fields) {
    const nextValue = config[field.key];
    if (field.secret) {
      if (typeof nextValue === 'string' && nextValue.trim()) merged[field.key] = nextValue.trim();
    } else if (typeof nextValue === 'string') {
      merged[field.key] = nextValue.trim();
    } else if (nextValue !== undefined && nextValue !== null) {
      merged[field.key] = nextValue;
    }

    if (field.required && !merged[field.key]) missing.push(field.key);
  }

  return { merged, missing };
}

function serializeConnectionSummary(row) {
  const definition = PLATFORM_CONNECTION_DEFINITIONS[row.platform];
  return {
    platform: row.platform,
    platformLabel: definition.label,
    auth_type: row.auth_type,
    authTypeLabel: definition.authTypes[row.auth_type]?.label || row.auth_type,
    status: row.status,
    updated_at: row.updated_at,
    updated_by: row.updated_by,
    availableAuthTypes: listAvailableAuthTypes(row.platform)
  };
}

function getSavedConnection(platform) {
  return db.prepare('SELECT * FROM platform_connections WHERE platform = ?').get(platform);
}

function buildEnvFallback(platform) {
  if (platform === 'baidu') {
    return {
      username: process.env.BAIDU_USERNAME || '',
      password: process.env.BAIDU_PASSWORD || '',
      token: process.env.BAIDU_DEV_TOKEN || '',
      apiBase: 'https://api.baidu.com/json/sms/service'
    };
  }
  if (platform === 'kuaishou') {
    return {
      appId: process.env.KUAISHOU_APP_ID || '',
      appSecret: process.env.KUAISHOU_APP_SECRET || '',
      accessToken: process.env.KUAISHOU_ACCESS_TOKEN || '',
      apiBase: 'https://ad.e.kuaishou.com/rest/openapi/v1'
    };
  }
  if (platform === 'jliang') {
    return {
      appId: process.env.JLIANG_APP_ID || '',
      appSecret: process.env.JLIANG_APP_SECRET || '',
      accessToken: process.env.JLIANG_ACCESS_TOKEN || '',
      advertiserId: process.env.JLIANG_ADVERTISER_ID || '',
      apiBase: 'https://ad.oceanengine.com/open_api/2'
    };
  }
  return {
    clientId: process.env.GOOGLE_ADS_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET || '',
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
    customerId: process.env.GOOGLE_ADS_CUSTOMER_ID || '',
    apiBase: 'https://googleads.googleapis.com/v18'
  };
}

function resolveRuntimeConnection(platform) {
  const saved = getSavedConnection(platform);
  if (!saved) return { source: 'env', config: buildEnvFallback(platform) };
  return { source: 'saved', config: { ...buildEnvFallback(platform), ...parseConfig(saved.config_json) } };
}

module.exports = {
  PLATFORM_CONNECTION_DEFINITIONS,
  parseConfig,
  serializeConnectionDetail,
  listAvailableAuthTypes,
  validateConnectionPayload,
  serializeConnectionSummary,
  resolveRuntimeConnection
};
