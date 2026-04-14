// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
});

afterEach(() => {
  cleanup();
});

describe('App route loading', () => {
  it('redirects guests to the login page', async () => {
    window.history.pushState({}, '', '/reports');
    const { default: App } = await import('./App');
    render(<App />);
    expect(await screen.findByRole('heading', { name: '欢迎回来' })).toBeInTheDocument();
  });

  it('shows the shared fallback before a lazy route resolves', async () => {
    // Expected to fail until Task 2 switches route modules to React.lazy + Suspense.
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ username: 'admin', role: 'admin' }));
    window.history.pushState({}, '', '/reports');

    const { default: App } = await import('./App');
    render(<App />);

    expect(screen.getByText('正在加载页面')).toBeInTheDocument();
  });
});
