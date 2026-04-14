// @vitest-environment jsdom
import React from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Form } from 'antd';
import { getAuthTypeOptions, getFieldDisplayLabel } from './utils';
import { platformConnectionApi } from '../../api';
import { useAuth } from '../../utils/auth';

vi.mock('../../utils/auth', () => ({
  useAuth: vi.fn(() => ({ user: { role: 'admin' } })),
}));

vi.mock('../../api', () => ({
  platformConnectionApi: {
    list: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    test: vi.fn(),
  },
}));

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
      dispatchEvent: vi.fn(),
    }));
  }

  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = (element) =>
    originalGetComputedStyle ? originalGetComputedStyle(element) : ({ getPropertyValue: () => '' });
});

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ user: { role: 'admin' } });
  platformConnectionApi.list.mockResolvedValue({
    data: [
      {
        platform: 'google',
        platformLabel: 'Google Ads',
        auth_type: 'ads_api',
        authTypeLabel: 'Ads API 凭证',
        status: 'configured',
        updated_at: '2026-04-14 10:00:00',
        availableAuthTypes: [
          { key: 'ads_api', label: 'Ads API 凭证', supported: true },
          { key: 'oauth2', label: 'OAuth 2.0', supported: false },
        ],
      },
    ],
  });
  platformConnectionApi.get.mockResolvedValue({
    data: {
      platform: 'google',
      platformLabel: 'Google Ads',
      auth_type: 'ads_api',
      status: 'configured',
      availableAuthTypes: [
        { key: 'ads_api', label: 'Ads API 凭证', supported: true },
        { key: 'oauth2', label: 'OAuth 2.0', supported: false },
      ],
      fields: {
        clientId: { configured: true, value: 'client-id' },
        clientSecret: { configured: true },
      },
    },
  });
});

describe('platform connection helpers', () => {
  it('marks unsupported auth types as disabled', () => {
    const options = getAuthTypeOptions([
      { key: 'ads_api', label: 'Ads API 凭证', supported: true },
      { key: 'oauth2', label: 'OAuth 2.0', supported: false },
    ]);

    expect(options).toEqual([
      { value: 'ads_api', label: 'Ads API 凭证', disabled: false },
      { value: 'oauth2', label: 'OAuth 2.0（暂未支持）', disabled: true },
    ]);
  });

  it('shows configured label for masked secret fields', () => {
    expect(getFieldDisplayLabel({ configured: true })).toBe('已设置');
    expect(getFieldDisplayLabel({ configured: false })).toBe('未设置');
  });
});

describe('page access messaging', () => {
  it('shows no-access text for non-admin roles', async () => {
    const authModule = await import('../../utils/auth');
    authModule.useAuth.mockReturnValue({ user: { role: 'operator' } });

    const PlatformConnections = (await import('../PlatformConnections')).default;
    render(<PlatformConnections />);

    expect(screen.getByText('无权限访问此页面')).toBeInTheDocument();
  });

  it('shows platform connection entries for admins', async () => {
    const PlatformConnections = (await import('../PlatformConnections')).default;
    render(<PlatformConnections />);

    expect(await screen.findByText('Google Ads')).toBeInTheDocument();
    expect(screen.getByText('集中管理各平台授权凭证')).toBeInTheDocument();
    expect(platformConnectionApi.list).toHaveBeenCalledTimes(1);
  });
});

describe('platform connection drawer', () => {
  it('shows configured placeholder for masked secret fields', async () => {
    const PlatformConnectionDrawer = (await import('./PlatformConnectionDrawer')).default;

    function DrawerHarness() {
      const [form] = Form.useForm();

      return (
        <PlatformConnectionDrawer
          open
          saving={false}
          testing={false}
          form={form}
          detail={{
            platform: 'google',
            platformLabel: 'Google Ads',
            auth_type: 'ads_api',
            status: 'configured',
            availableAuthTypes: [
              { key: 'ads_api', label: 'Ads API 凭证', supported: true },
              { key: 'oauth2', label: 'OAuth 2.0', supported: false },
            ],
            fields: {
              clientSecret: { label: 'Client Secret', secret: true, configured: true },
            },
          }}
          onClose={() => {}}
          onSave={() => {}}
          onTest={() => {}}
        />
      );
    }

    render(<DrawerHarness />);

    expect(screen.getByPlaceholderText('已设置，如需更换请重新填写')).toBeInTheDocument();
  });
});
