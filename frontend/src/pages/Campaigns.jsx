import React, { useEffect, useState } from 'react';
import { Button, Card, Dropdown, Form, Input, Modal, Space, Table, Tag, Typography, message } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { campaignApi } from '../api';
import { useAuth } from '../utils/auth';
import CampaignFilters from './campaigns/CampaignFilters';
import CampaignBatchBar from './campaigns/CampaignBatchBar';
import CampaignFormDrawer from './campaigns/CampaignFormDrawer';
import CampaignStatusTag from './campaigns/CampaignStatusTag';
import { CAMPAIGN_ACTION_LABEL, PLATFORM_OPTIONS } from './campaigns/constants';
import {
  formatCurrency,
  formatDateRange,
  getBudgetUsageRate,
  getRemainingBudget,
  getRowActions,
  mapCampaignFormValues
} from './campaigns/utils';

const defaultFilters = {
  search: '',
  status: '',
  platform: '',
  requires_review: '',
  budget_health: '',
  date_from: '',
  date_to: ''
};

const reasonTitles = {
  reject: '驳回原因',
  pause: '暂停原因',
  terminate: '终止原因',
  batch_pause: '批量暂停原因',
  batch_terminate: '批量终止原因'
};

const defaultFormValues = {
  name: '',
  platform: 'all',
  total_budget: null,
  daily_budget: null,
  requires_review: false,
  auto_activate: true,
  dateRange: null
};

export function normalizeRequiresReview(value) {
  if (value === true || value === 1 || value === '1') return true;
  if (value === false || value === 0 || value === '0' || value == null) return false;
  return Boolean(value);
}

function buildQuery(params, filters) {
  const query = {
    page: params.page,
    pageSize: params.pageSize
  };
  if (filters.search) query.search = filters.search.trim();
  if (filters.status) query.status = filters.status;
  if (filters.platform) query.platform = filters.platform;
  if (filters.requires_review !== '') query.requires_review = filters.requires_review;
  if (filters.budget_health) query.budget_health = filters.budget_health;
  if (filters.date_from) query.date_from = filters.date_from;
  if (filters.date_to) query.date_to = filters.date_to;
  return query;
}

function formatPlatform(value) {
  return PLATFORM_OPTIONS.find((option) => option.value === value)?.label || value || '-';
}

export default function Campaigns() {
  const { user } = useAuth();
  const canEdit = ['admin', 'operator'].includes(user?.role);

  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState(defaultFilters);
  const [params, setParams] = useState({ page: 1, pageSize: 10 });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [reasonModal, setReasonModal] = useState({ open: false, action: '', ids: [], row: null });
  const [form] = Form.useForm();
  const [reasonForm] = Form.useForm();
  const clearSelection = () => {
    setSelectedRowKeys([]);
    setSelectedRows([]);
  };

  const fetchData = async (nextParams = params, nextFilters = filters) => {
    setLoading(true);
    try {
      const { data: res } = await campaignApi.list(buildQuery(nextParams, nextFilters));
      setData(res.list);
      setTotal(res.total);
    } catch (err) {
      message.error(err.response?.data?.message || '获取活动列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue(defaultFormValues);
    setDrawerOpen(true);
  };

  const openEdit = (row) => {
    const mapped = mapCampaignFormValues(row);
    const normalizedRequiresReview = normalizeRequiresReview(row?.requires_review);
    setEditing(row);
    form.setFieldsValue({
      ...defaultFormValues,
      ...mapped,
      requires_review: normalizedRequiresReview,
      total_budget: mapped.total_budget ?? mapped.budget ?? null,
      daily_budget: mapped.daily_budget ?? null
    });
    setDrawerOpen(true);
  };

  const openDuplicate = (row) => {
    const mapped = mapCampaignFormValues(row);
    const normalizedRequiresReview = normalizeRequiresReview(row?.requires_review);
    setEditing(null);
    form.setFieldsValue({
      ...defaultFormValues,
      ...mapped,
      requires_review: normalizedRequiresReview,
      name: `${row.name} - 副本`,
      total_budget: mapped.total_budget ?? mapped.budget ?? null,
      daily_budget: mapped.daily_budget ?? null
    });
    setDrawerOpen(true);
  };

  const handleDrawerSubmit = async (values) => {
    const { dateRange, ...rest } = values;
    const payload = {
      ...rest,
      start_date: dateRange?.[0]?.format('YYYY-MM-DD') || null,
      end_date: dateRange?.[1]?.format('YYYY-MM-DD') || null
    };
    setDrawerLoading(true);
    try {
      if (editing) {
        await campaignApi.update(editing.id, payload);
        message.success('活动已更新');
      } else {
        await campaignApi.create(payload);
        message.success('活动已创建');
      }
      setDrawerOpen(false);
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || '保存失败');
    } finally {
      setDrawerLoading(false);
    }
  };

  const openReasonModal = (action, options = {}) => {
    reasonForm.resetFields();
    setReasonModal({ open: true, action, ...options });
  };

  const closeReasonModal = () => {
    setReasonModal({ open: false, action: '', ids: [], row: null });
  };

  const handleReasonSubmit = async () => {
    let values;
    try {
      values = await reasonForm.validateFields();
    } catch (err) {
      return;
    }
    const reason = values.reason?.trim() || '';
    try {
      if (reasonModal.action === 'reject') {
        await campaignApi.reject(reasonModal.row.id, { reason });
        message.success('已驳回');
      } else if (reasonModal.action === 'pause') {
        await campaignApi.pause(reasonModal.row.id, { reason });
        message.success('已暂停');
      } else if (reasonModal.action === 'terminate') {
        await campaignApi.terminate(reasonModal.row.id, { reason });
        message.success('已终止');
      } else if (reasonModal.action === 'batch_pause') {
        const { data: res } = await campaignApi.batchPause(reasonModal.ids, reason);
        handleBatchResult(res);
      } else if (reasonModal.action === 'batch_terminate') {
        const { data: res } = await campaignApi.batchTerminate(reasonModal.ids, reason);
        handleBatchResult(res);
      }
      closeReasonModal();
      setSelectedRowKeys([]);
      setSelectedRows([]);
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || '操作失败');
    }
  };

  const handleBatchResult = (res) => {
    const results = res?.results || [];
    const successCount = results.filter((item) => item.ok).length;
    const failCount = results.length - successCount;
    if (failCount > 0) {
      message.warning(`批量操作完成：成功 ${successCount} 项，失败 ${failCount} 项`);
    } else {
      message.success('批量操作成功');
    }
  };

  const handleRowAction = async (action, row) => {
    try {
      if (action === 'edit') return openEdit(row);
      if (action === 'duplicate') return openDuplicate(row);
      if (action === 'delete') {
        return Modal.confirm({
          title: '确认删除该活动？',
          icon: <ExclamationCircleOutlined />,
          content: '删除后无法恢复',
          onOk: async () => {
            try {
              await campaignApi.remove(row.id);
              message.success('已删除');
              fetchData();
            } catch (err) {
              message.error(err.response?.data?.message || '删除失败');
            }
          }
        });
      }
      if (action === 'submit_review') {
        await campaignApi.submitReview(row.id);
        message.success('已提交审核');
      } else if (action === 'withdraw_review') {
        await campaignApi.withdrawReview(row.id);
        message.success('已撤回审核');
      } else if (action === 'approve') {
        await campaignApi.approve(row.id);
        message.success('已审核通过');
      } else if (action === 'reject') {
        openReasonModal('reject', { row });
        return;
      } else if (action === 'activate') {
        await campaignApi.activate(row.id);
        message.success('已启动');
      } else if (action === 'pause') {
        openReasonModal('pause', { row });
        return;
      } else if (action === 'complete') {
        await campaignApi.complete(row.id);
        message.success('已完成');
      } else if (action === 'terminate') {
        openReasonModal('terminate', { row });
        return;
      }
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || '操作失败');
    }
  };

  const handleBatchAction = async (action) => {
    if (!selectedRowKeys.length) return;
    try {
      if (action === 'submit_review') {
        const { data: res } = await campaignApi.batchSubmitReview(selectedRowKeys);
        handleBatchResult(res);
      } else if (action === 'activate') {
        const { data: res } = await campaignApi.batchActivate(selectedRowKeys);
        handleBatchResult(res);
      } else if (action === 'pause') {
        openReasonModal('batch_pause', { ids: selectedRowKeys });
        return;
      } else if (action === 'terminate') {
        openReasonModal('batch_terminate', { ids: selectedRowKeys });
        return;
      }
      setSelectedRowKeys([]);
      setSelectedRows([]);
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || '批量操作失败');
    }
  };

  const columns = [
    {
      title: '活动名称',
      dataIndex: 'name',
      ellipsis: true,
      width: 180,
      render: (value) => <span className="campaign-name-cell">{value}</span>
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (value) => <CampaignStatusTag status={value} />
    },
    {
      title: '审核',
      dataIndex: 'requires_review',
      width: 100,
      render: (value) =>
        value ? <Tag color="processing">需要审核</Tag> : <Tag color="default">无需审核</Tag>
    },
    { title: '平台', dataIndex: 'platform', width: 90, render: formatPlatform },
    {
      title: '总预算',
      dataIndex: 'total_budget',
      width: 120,
      render: (value) => <span className="campaign-budget-cell">{formatCurrency(value)}</span>
    },
    {
      title: '日预算',
      dataIndex: 'daily_budget',
      width: 120,
      render: (value) => <span className="campaign-budget-cell">{formatCurrency(value)}</span>
    },
    { title: '消耗', dataIndex: 'spent', width: 110, render: formatCurrency },
    {
      title: '剩余预算',
      width: 120,
      render: (_, row) => formatCurrency(getRemainingBudget(row))
    },
    {
      title: '预算进度',
      width: 110,
      render: (_, row) => `${getBudgetUsageRate(row)}%`
    },
    {
      title: '投放周期',
      width: 180,
      render: (_, row) => <span className="campaign-plan-cell">{formatDateRange(row)}</span>
    },
    {
      title: '操作',
      width: 120,
      fixed: 'right',
      render: (_, row) => {
        const actions = getRowActions(row, user?.role);
        if (!actions.length) return <Typography.Text type="secondary">-</Typography.Text>;
        const items = actions.map((action) => ({
          key: action,
          label: CAMPAIGN_ACTION_LABEL[action] || action,
          danger: ['delete', 'terminate'].includes(action)
        }));
        return (
          <Dropdown
            menu={{
              items,
              onClick: ({ key }) => handleRowAction(key, row)
            }}
          >
            <Button size="small">操作</Button>
          </Dropdown>
        );
      }
    }
  ];

  return (
    <div className="page-shell campaigns-shell">
      <Card className="page-section-card campaign-filter-card">
        <CampaignFilters
          value={filters}
          onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
          onSearch={() => {
            const nextParams = { ...params, page: 1 };
            clearSelection();
            setParams(nextParams);
            fetchData(nextParams, filters);
          }}
          onReset={() => {
            setFilters(defaultFilters);
            const nextParams = { ...params, page: 1 };
            clearSelection();
            setParams(nextParams);
            fetchData(nextParams, defaultFilters);
          }}
          onCreate={openCreate}
          canEdit={canEdit}
        />
      </Card>

      <CampaignBatchBar
        count={selectedRowKeys.length}
        loading={loading}
        onSubmitReview={() => handleBatchAction('submit_review')}
        onActivate={() => handleBatchAction('activate')}
        onPause={() => handleBatchAction('pause')}
        onTerminate={() => handleBatchAction('terminate')}
      />

      <Card className="page-section-card campaign-table-card">
        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1400 }}
          rowSelection={
            canEdit
              ? {
                  selectedRowKeys,
                  onChange: (keys, rows) => {
                    setSelectedRowKeys(keys);
                    setSelectedRows(rows);
                  }
                }
              : undefined
          }
          pagination={{
            total,
            current: params.page,
            pageSize: params.pageSize,
            onChange: (page, pageSize) => {
              const nextParams = { ...params, page, pageSize };
              clearSelection();
              setParams(nextParams);
              fetchData(nextParams, filters);
            }
          }}
        />
      </Card>

      <CampaignFormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleDrawerSubmit}
        loading={drawerLoading}
        form={form}
        editing={editing}
      />

      <Modal
        title={reasonTitles[reasonModal.action] || '补充原因'}
        open={reasonModal.open}
        onOk={handleReasonSubmit}
        onCancel={closeReasonModal}
        destroyOnClose
      >
        <Form form={reasonForm} layout="vertical">
          <Form.Item
            name="reason"
            label="原因说明"
            rules={[
              {
                required: reasonModal.action === 'reject',
                message: '请填写原因说明'
              }
            ]}
          >
            <Input.TextArea rows={3} placeholder="请填写原因（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
