import { afterEach, describe, expect, it, vi } from 'vitest';

import { checkRelease } from './check-release';

const MANIFEST = {
  name: '@vazen-ai/toml',
  repository: { url: 'git+https://github.com/vazen-ai/toml.git' },
  version: '0.2.0',
};
const REGISTRY = {
  'dist-tags': { latest: '0.1.0' },
  name: '@vazen-ai/toml',
  versions: { '0.1.0': {} },
};

afterEach(() => vi.unstubAllGlobals());

describe('checkRelease', () => {
  it('publishes a newer version, but never republishes an existing version', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(REGISTRY)),
    );
    await expect(checkRelease(MANIFEST)).resolves.toEqual({
      publish: true,
      version: '0.2.0',
    });
    await expect(
      checkRelease({ ...MANIFEST, version: '0.1.0' }),
    ).resolves.toEqual({ publish: false, version: '0.1.0' });
  });

  it.each([
    '0.0.0',
    '0.0.0-development.0',
    '0.2.0-rc.1',
    '0.2.0+build',
    '01.2.0',
    '0.2.0\n',
    '0.2.0\npublish=true',
  ])('refuses version %s before contacting npm', async (version) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(checkRelease({ ...MANIFEST, version })).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses a different package or source repository', async () => {
    await expect(
      checkRelease({ ...MANIFEST, name: 'another-package' }),
    ).rejects.toThrow();
    await expect(
      checkRelease({
        ...MANIFEST,
        repository: { url: 'git+https://github.com/example/toml.git' },
      }),
    ).rejects.toThrow();
  });

  it.each([401, 404, 429, 503])(
    'does not mistake HTTP %s for an available version',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('', { status })),
      );
      await expect(checkRelease(MANIFEST)).rejects.toThrow(`HTTP ${status}`);
    },
  );

  it('fails on a network error or malformed registry response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    await expect(checkRelease(MANIFEST)).rejects.toThrow('offline');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({})),
    );
    await expect(checkRelease(MANIFEST)).rejects.toThrow();
  });

  it('refuses to move latest backwards and compares version components numerically', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ ...REGISTRY, 'dist-tags': { latest: '0.9.0' } }),
      ),
    );
    await expect(checkRelease(MANIFEST)).rejects.toThrow('must be newer');
    await expect(
      checkRelease({ ...MANIFEST, version: '0.10.0' }),
    ).resolves.toEqual({ publish: true, version: '0.10.0' });
  });
});
