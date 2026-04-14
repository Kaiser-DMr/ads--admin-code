// @vitest-environment jsdom
import React from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

function createLocalStorageMock() {
  let store = {};
  return {
    clear() {
      store = {};
    },
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    removeItem(key) {
      delete store[key];
    },
    setItem(key, value) {
      store[key] = String(value);
    },
  };
}

function deferredModule(label) {
  let resolve;
  const promise = new Promise((nextResolve) => {
    resolve = () => nextResolve({ default: () => <div>{label}</div> });
  });
  return { promise, resolve };
}

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
  if (!window.localStorage || typeof window.localStorage.clear !== 'function') {
    const mock = createLocalStorageMock();
    Object.defineProperty(window, 'localStorage', {
      value: mock,
      configurable: true,
      enumerable: true,
      writable: true,
    });
    globalThis.localStorage = mock;
  }
});

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  vi.unmock('./pages/Dashboard');
  vi.unmock('./pages/Campaigns');
  vi.unmock('./pages/Creatives');
  vi.unmock('./pages/Reports');
  vi.unmock('./pages/Users');
  vi.unmock('./pages/PlatformConnections');
});

describe('App route loading', () => {
  it('redirects guests to the login page', async () => {
    window.history.pushState({}, '', '/reports');
    const { default: App } = await import('./App');
    render(<App />);
    expect(await screen.findByText('欢迎回来')).toBeInTheDocument();
  });

  it('shows the shared fallback before a lazy route resolves', async () => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ username: 'admin', role: 'admin' }));
    window.history.pushState({}, '', '/reports');

    const reportsModule = deferredModule('reports-page-loaded');
    vi.doMock('./pages/Reports', () => reportsModule.promise);
    vi.doMock('./pages/Dashboard', () => Promise.resolve({ default: () => <div>dashboard-page</div> }));
    vi.doMock('./pages/Campaigns', () => Promise.resolve({ default: () => <div>campaigns-page</div> }));
    vi.doMock('./pages/Creatives', () => Promise.resolve({ default: () => <div>creatives-page</div> }));
    vi.doMock('./pages/Users', () => Promise.resolve({ default: () => <div>users-page</div> }));
    vi.doMock('./pages/PlatformConnections', () => Promise.resolve({ default: () => <div>platform-connections-page</div> }));

    const { default: App } = await import('./App');
    render(<App />);

    expect(screen.getByText('正在加载页面')).toBeInTheDocument();

    reportsModule.resolve();

    expect(await screen.findByText('reports-page-loaded')).toBeInTheDocument();
  });
});
