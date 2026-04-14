// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { normalizeRequiresReview } from '../Campaigns';
import CampaignStatusTag from './CampaignStatusTag';
import CampaignFilters from './CampaignFilters';
import CampaignBatchBar from './CampaignBatchBar';
import { CAMPAIGN_STATUS_COLOR, CAMPAIGN_STATUS_LABEL } from './constants';
import { getBudgetUsageRate, getRemainingBudget, getRowActions, mapCampaignFormValues } from './utils';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));
  }

  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = (element) =>
    originalGetComputedStyle ? originalGetComputedStyle(element) : ({ getPropertyValue: () => '' });
});

describe('campaign utils', () => {
  it('calculates budget summary values', () => {
    const row = { total_budget: 1000, spent: 300, status: 'active' };
    expect(getRemainingBudget(row)).toBe(700);
    expect(getBudgetUsageRate(row)).toBe(30);
  });

  it('maps campaign values into form defaults', () => {
    const mapped = mapCampaignFormValues({
      start_date: '2024-01-01',
      end_date: '2024-01-05',
      requires_review: 1,
      auto_activate: false
    });
    expect(mapped.requires_review).toBe(true);
    expect(mapped.auto_activate).toBe(false);
    expect(mapped.dateRange?.[0]?.format('YYYY-MM-DD')).toBe('2024-01-01');
    expect(mapped.dateRange?.[1]?.format('YYYY-MM-DD')).toBe('2024-01-05');
  });

  it('normalizes auto activate values', () => {
    expect(mapCampaignFormValues({ auto_activate: 0 }).auto_activate).toBe(false);
    expect(mapCampaignFormValues({ auto_activate: '0' }).auto_activate).toBe(false);
    expect(mapCampaignFormValues({ auto_activate: 1 }).auto_activate).toBe(true);
    expect(mapCampaignFormValues({ auto_activate: '1' }).auto_activate).toBe(true);
    expect(mapCampaignFormValues({}).auto_activate).toBe(true);
  });

  it('normalizes requires review values for form usage', () => {
    expect(normalizeRequiresReview(1)).toBe(true);
    expect(normalizeRequiresReview('1')).toBe(true);
    expect(normalizeRequiresReview(0)).toBe(false);
    expect(normalizeRequiresReview('0')).toBe(false);
    expect(normalizeRequiresReview(undefined)).toBe(false);
    expect(normalizeRequiresReview(null)).toBe(false);
  });

  it('returns admin review actions for pending review campaigns', () => {
    expect(getRowActions({ status: 'pending_review' }, 'admin')).toEqual(['approve', 'reject', 'withdraw_review']);
  });

  it('does not expose approval to operator users', () => {
    expect(getRowActions({ status: 'pending_review' }, 'operator')).toEqual(['withdraw_review']);
  });

  it('does not expose draft delete to operator users', () => {
    expect(getRowActions({ status: 'draft', requires_review: false }, 'operator')).toEqual(['edit', 'activate']);
    expect(getRowActions({ status: 'draft', requires_review: true }, 'operator')).toEqual(['edit', 'submit_review']);
  });
});

describe('CampaignStatusTag', () => {
  it('renders mapped label and color', () => {
    render(<CampaignStatusTag status="active" />);
    expect(screen.getByText(CAMPAIGN_STATUS_LABEL.active)).toBeInTheDocument();
    const tag = screen.getByText(CAMPAIGN_STATUS_LABEL.active).closest('.ant-tag');
    expect(tag).toHaveClass(`ant-tag-${CAMPAIGN_STATUS_COLOR.active}`);
  });
});

describe('Campaigns page primitives', () => {
  it('shows create action when user can edit', async () => {
    render(
      <CampaignFilters
        value={{
          search: '',
          status: '',
          platform: '',
          requires_review: '',
          budget_health: '',
          date_from: '',
          date_to: ''
        }}
        onChange={() => {}}
        canEdit
      />
    );
    expect(screen.getByRole('button', { name: /新建活动/ })).toBeInTheDocument();
  });

  it('shows batch bar selected count', async () => {
    render(
      <CampaignBatchBar
        count={1}
        loading={false}
      />
    );
    expect(screen.getByText('已选择 1 个活动')).toBeInTheDocument();
  });
});
