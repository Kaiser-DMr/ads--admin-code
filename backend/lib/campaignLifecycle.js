const ACTIVE_STATUSES = new Set(['active', 'pending_start', 'paused']);
const CLOSED_STATUSES = new Set(['completed', 'terminated']);

function nowIso() {
  return new Date().toISOString();
}

function toDateKey(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function isDateOnOrBefore(dateText, compareTo = new Date()) {
  const target = toDateKey(dateText);
  const base = toDateKey(compareTo);
  if (!target || !base) return false;
  return target <= base;
}

function isDateOnOrAfter(dateText, compareTo = new Date()) {
  const target = toDateKey(dateText);
  const base = toDateKey(compareTo);
  if (!target || !base) return false;
  return target >= base;
}

function isDateBefore(dateText, compareTo = new Date()) {
  const target = toDateKey(dateText);
  const base = toDateKey(compareTo);
  if (!target || !base) return false;
  return target < base;
}

function dateReached(dateText, now = new Date()) {
  return isDateOnOrBefore(dateText, now);
}

function validateBudget({ total_budget, daily_budget }) {
  const total = Number(total_budget);
  const daily = Number(daily_budget);
  if (!(total > 0)) return '总预算必须大于 0';
  if (!(daily > 0)) return '日预算必须大于 0';
  if (daily > total) return '日预算不能超过总预算';
  return null;
}

function validateDates({ start_date, end_date }) {
  if (!start_date || !end_date) return null;
  const startKey = toDateKey(start_date);
  const endKey = toDateKey(end_date);
  if (!startKey || !endKey) return '日期格式不正确';
  if (endKey < startKey) return '结束日期不能早于开始日期';
  return null;
}

function deriveCreateStatus() {
  return 'draft';
}

function deriveResumeStatus(campaign, now = new Date()) {
  if (!campaign.start_date) return 'active';
  return dateReached(campaign.start_date, now) ? 'active' : 'pending_start';
}

function deriveRowActions(campaign, role) {
  if (!role || role === 'viewer') return [];
  const status = campaign.status;
  if (status === 'draft') {
    return campaign.requires_review ? ['edit', 'submit_review', 'delete'] : ['edit', 'activate', 'delete'];
  }
  if (status === 'pending_review') {
    return role === 'admin' ? ['approve', 'reject', 'withdraw_review'] : ['withdraw_review'];
  }
  if (status === 'pending_start') {
    return ['pause', 'terminate'];
  }
  if (status === 'active') {
    return ['pause', 'complete', 'terminate'];
  }
  if (status === 'paused') {
    return ['resume', 'terminate'];
  }
  if (status === 'completed' || status === 'terminated') {
    return ['duplicate'];
  }
  return [];
}

module.exports = {
  ACTIVE_STATUSES,
  CLOSED_STATUSES,
  nowIso,
  toDateKey,
  isDateOnOrBefore,
  isDateOnOrAfter,
  isDateBefore,
  dateReached,
  validateBudget,
  validateDates,
  deriveCreateStatus,
  deriveResumeStatus,
  deriveRowActions
};
