import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.querySelectorAll('link[data-nationx-route-style]').forEach(link => link.remove());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
