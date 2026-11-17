import { test } from 'node:test';
import assert from 'node:assert';
import { detectIsMobile } from './useIsMobile.ts';

test('Mobile Detection - Default in Node test environment', () => {
  if (typeof window === 'undefined') {
    assert.strictEqual(detectIsMobile(), false);
  }
});

test('Mobile Detection - Window Mocking & User-Agent', () => {
  const origWindow = (globalThis as any).window;
  const origNavigator = (globalThis as any).navigator;

  let mockUa = 'Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36';

  (globalThis as any).window = {
    innerWidth: 375,
    location: { search: '' },
    dispatchEvent: () => true,
  };

  Object.defineProperty(globalThis, 'navigator', {
    value: {
      get userAgent() {
        return mockUa;
      },
    },
    configurable: true,
    writable: true,
  });

  (globalThis as any).sessionStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };

  assert.strictEqual(detectIsMobile(), true);

  // Desktop width and Desktop User-Agent
  (globalThis as any).window.innerWidth = 1280;
  mockUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  assert.strictEqual(detectIsMobile(), false);

  // Small screen on desktop (e.g. narrow window or DevTools simulation)
  (globalThis as any).window.innerWidth = 480;
  assert.strictEqual(detectIsMobile(), true);

  // Explicit URL parameter override ?view=desktop on small screen
  (globalThis as any).window.location.search = '?view=desktop';
  assert.strictEqual(detectIsMobile(), false);

  // Explicit URL parameter override ?view=mobile on wide screen
  (globalThis as any).window.innerWidth = 1440;
  (globalThis as any).window.location.search = '?view=mobile';
  assert.strictEqual(detectIsMobile(), true);

  // Restore
  if (origWindow !== undefined) {
    (globalThis as any).window = origWindow;
  } else {
    delete (globalThis as any).window;
  }
  if (origNavigator !== undefined) {
    Object.defineProperty(globalThis, 'navigator', { value: origNavigator, configurable: true, writable: true });
  }
  delete (globalThis as any).sessionStorage;
});
