export const PLATFORM_CONNECTION_METADATA = {
  baidu: {
    label: '百度营销',
    authTypes: {
      account_password_token: {
        label: '账号 + 密码 + Token',
        fields: [
          { key: 'username', label: '用户名', secret: false },
          { key: 'password', label: '密码', secret: true },
          { key: 'token', label: '开发者 Token', secret: true },
        ],
      },
      oauth2: { label: 'OAuth 2.0', fields: [] },
    },
  },
  kuaishou: {
    label: '快手磁力金牛',
    authTypes: {
      app_access_token: {
        label: 'App 凭证 + Access Token',
        fields: [
          { key: 'appId', label: 'App ID', secret: false },
          { key: 'appSecret', label: 'App Secret', secret: true },
          { key: 'accessToken', label: 'Access Token', secret: true },
        ],
      },
      oauth2: { label: 'OAuth 2.0', fields: [] },
    },
  },
  jliang: {
    label: '巨量引擎',
    authTypes: {
      marketing_token: {
        label: 'Marketing API Token',
        fields: [
          { key: 'appId', label: 'App ID', secret: false },
          { key: 'accessToken', label: 'Access Token', secret: true },
          { key: 'advertiserId', label: '广告主 ID', secret: false },
        ],
      },
      oauth2: { label: 'OAuth 2.0', fields: [] },
    },
  },
  google: {
    label: 'Google Ads',
    authTypes: {
      ads_api: {
        label: 'Ads API 凭证',
        fields: [
          { key: 'clientId', label: 'Client ID', secret: false },
          { key: 'clientSecret', label: 'Client Secret', secret: true },
          { key: 'developerToken', label: 'Developer Token', secret: true },
          { key: 'customerId', label: 'Customer ID', secret: false },
        ],
      },
      oauth2: { label: 'OAuth 2.0', fields: [] },
    },
  },
};

export const PLATFORM_STATUS_LABEL = {
  unconfigured: '未配置',
  configured: '已配置',
  invalid: '配置异常',
};

export const PLATFORM_STATUS_COLOR = {
  unconfigured: 'default',
  configured: 'success',
  invalid: 'error',
};

export function getAuthFieldDefinitions(platform, authType) {
  return PLATFORM_CONNECTION_METADATA[platform]?.authTypes?.[authType]?.fields || [];
}
