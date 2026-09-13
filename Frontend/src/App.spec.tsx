import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '@/App';
import { api } from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';

/**
 * The routing shell, rendered for real.
 *
 * Route components are `React.lazy`, so every page now sits behind a Suspense
 * boundary — which is exactly the kind of wiring that fails silently in a
 * `tsc` run and loudly in a browser. These render the actual tree through the
 * layouts: the auth boundary resolves the sign-in page, and the protected one
 * resolves a dashboard page (and refuses it without a session).
 */
function renderApp(entry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

afterEach(() => {
  // Vitest does not enable globals, so Testing Library cannot register its own
  // teardown; without this the previous test's DOM is still on the page and
  // every query finds two of everything.
  cleanup();
});

beforeEach(() => {
  // jsdom has no canvas implementation and logs "Not implemented" for
  // getContext(); the auth layout's WebGL probe only needs a null answer.
  HTMLCanvasElement.prototype.getContext = () => null;

  useAuthStore.getState().logout();

  // Answer every request locally and successfully: these tests are about the
  // router, the layouts and the Suspense boundaries, not about the transport.
  api.defaults.adapter = async (config) => ({
    data: [],
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  });
});

describe('routing shell', () => {
  it('resolves a lazily loaded auth page', async () => {
    renderApp('/login');

    // The heading is inside the lazy chunk: this only passes once Suspense
    // swaps the fallback for the loaded page.
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Create one' })).toBeTruthy();
  }, 30_000);

  it('redirects an unauthenticated visitor away from the dashboard', async () => {
    renderApp('/dashboard');

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
  }, 30_000);

  it('renders a protected page through the dashboard layout', async () => {
    useAuthStore.getState().setTokens('access-token', 'refresh-token');
    useAuthStore.getState().setUser({
      id: 'u1',
      email: 'ada@example.com',
      username: 'adalovelace',
      name: 'Ada',
      role: 'USER',
      createdAt: '2026-01-01T00:00:00.000Z',
    } as never);

    renderApp('/notes');

    // The layout paints first (the sidebar also says "Notes", hence the role),
    // and the lazy page follows inside it.
    // Generous timeout: loading this route means transforming a markdown editor
    // and a code editor the first time the chunk is imported, which dominates.
    expect(await screen.findByRole('heading', { name: 'Notes' }, { timeout: 20_000 })).toBeTruthy();
    await waitFor(() => expect(screen.getByText('No notes yet')).toBeTruthy(), { timeout: 5_000 });
  }, 30_000);
});
