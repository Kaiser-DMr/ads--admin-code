import {
  getAuthFieldDefinitions,
  PLATFORM_CONNECTION_METADATA,
  PLATFORM_STATUS_COLOR,
  PLATFORM_STATUS_LABEL,
} from './constants';

export function getAuthTypeOptions(authTypes) {
  return authTypes.map((item) => ({
    value: item.key,
    label: item.supported ? item.label : `${item.label}（暂未支持）`,
    disabled: !item.supported,
  }));
}

export function getFieldDisplayLabel(field) {
  return field?.configured ? '已设置' : '未设置';
}

export function getStatusLabel(status) {
  return PLATFORM_STATUS_LABEL[status] || status || '-';
}

export function getStatusColor(status) {
  return PLATFORM_STATUS_COLOR[status] || 'default';
}

export function enrichConnectionDetail(detail) {
  const fieldDefinitions = getAuthFieldDefinitions(detail.platform, detail.auth_type);
  const fields = Object.fromEntries(
    fieldDefinitions.map((field) => [
      field.key,
      {
        ...field,
        configured: detail.fields?.[field.key]?.configured || false,
        value: detail.fields?.[field.key]?.value ?? '',
      },
    ])
  );

  return {
    ...detail,
    platformLabel: detail.platformLabel || PLATFORM_CONNECTION_METADATA[detail.platform]?.label || detail.platform,
    fields,
  };
}

export function toFormInitialValues(detail) {
  const values = { auth_type: detail.auth_type };
  Object.entries(detail.fields || {}).forEach(([key, field]) => {
    values[key] = field.value ?? '';
  });
  return values;
}

export function buildConnectionPayload(platform, authType, values) {
  const config = {};
  getAuthFieldDefinitions(platform, authType).forEach((field) => {
    config[field.key] = values[field.key] ?? '';
  });
  return { auth_type: authType, config };
}
