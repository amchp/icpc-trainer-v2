## Live Playwright E2E

This suite is opt-in and uses real Codeforces credentials supplied at runtime.

Required environment variables:

- `E2E_CODEFORCES_HANDLE`
- `E2E_CODEFORCES_API_KEY`
- `E2E_CODEFORCES_API_SECRET`

Optional environment variables:

- `E2E_BASE_URL`
- `E2E_API_BASE_URL`
- `E2E_HEADLESS`
- `E2E_SLOW_MO`

Run the suite with:

```sh
bun run test:e2e:live
```

Run headed with:

```sh
bun run test:e2e:live:headed
```

The suite writes transient artifacts to `tests/e2e/.artifacts/`.
