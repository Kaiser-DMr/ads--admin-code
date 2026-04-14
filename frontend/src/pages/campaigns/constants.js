export const CAMPAIGN_STATUS_LABEL = {
  draft: '草稿',
  pending_review: '待审核',
  pending_start: '待开始',
  active: '投放中',
  paused: '已暂停',
  completed: '已完成',
  terminated: '已终止'
};

export const CAMPAIGN_STATUS_COLOR = {
  draft: 'default',
  pending_review: 'processing',
  pending_start: 'cyan',
  active: 'green',
  paused: 'orange',
  completed: 'blue',
  terminated: 'red'
};

export const CAMPAIGN_ACTION_LABEL = {
  edit: '编辑',
  delete: '删除',
  submit_review: '提交审核',
  withdraw_review: '撤回审核',
  approve: '审核通过',
  reject: '审核驳回',
  activate: '启动活动',
  pause: '暂停活动',
  complete: '完成活动',
  terminate: '终止活动',
  duplicate: '复制活动'
};

export const PLATFORM_OPTIONS = [
  { value: 'all', label: '全平台' },
  { value: 'iOS', label: 'iOS' },
  { value: 'Android', label: 'Android' },
  { value: 'Web', label: 'Web' }
];

export const BUDGET_HEALTH_OPTIONS = [
  { value: '', label: '全部预算状态' },
  { value: 'healthy', label: '预算健康' },
  { value: 'exhausted', label: '预算耗尽' }
];
