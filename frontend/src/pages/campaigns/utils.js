import dayjs from 'dayjs';

export function formatCurrency(value) {
  return `¥${Number(value || 0).toLocaleString()}`;
}

export function getRemainingBudget(row) {
  return Math.max(Number(row.total_budget || 0) - Number(row.spent || 0), 0);
}

export function getBudgetUsageRate(row) {
  const total = Number(row.total_budget || 0);
  if (!total) return 0;
  return Number((((Number(row.spent || 0) / total) * 100).toFixed(1)));
}

export function formatDateRange(row) {
  if (!row.start_date && !row.end_date) return '-';
  return `${row.start_date || '未设置'} ~ ${row.end_date || '未设置'}`;
}

export function isPendingStart(row) {
  return row.status === 'pending_start';
}

export function mapCampaignFormValues(row) {
  const autoActivateValue = row?.auto_activate;
  const normalizedAutoActivate =
    autoActivateValue === false || autoActivateValue === 0 || autoActivateValue === '0'
      ? false
      : autoActivateValue === true || autoActivateValue === 1 || autoActivateValue === '1' || autoActivateValue === undefined
        ? true
        : Boolean(autoActivateValue);

  return {
    ...row,
    requires_review: Boolean(row?.requires_review),
    auto_activate: normalizedAutoActivate,
    dateRange: row?.start_date && row?.end_date ? [dayjs(row.start_date), dayjs(row.end_date)] : null,
  };
}

export function getRowActions(row, role) {
  if (role === 'viewer') return [];
  if (row.status === 'draft') {
    const actions = row.requires_review ? ['edit', 'submit_review'] : ['edit', 'activate'];
    return role === 'admin' ? [...actions, 'delete'] : actions;
  }
  if (row.status === 'pending_review') return role === 'admin' ? ['approve', 'reject', 'withdraw_review'] : ['withdraw_review'];
  if (row.status === 'pending_start') return ['pause', 'terminate'];
  if (row.status === 'active') return ['pause', 'complete', 'terminate'];
  if (row.status === 'paused') return ['activate', 'terminate'];
  if (row.status === 'completed' || row.status === 'terminated') return ['duplicate'];
  return [];
}
