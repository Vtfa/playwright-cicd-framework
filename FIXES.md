# 🛠️ Recommended Fixes & Improvements

This document tracks fixes and best-practice enhancements for the **`frfr`** Playwright test automation project.

---

## 📋 Quick Checklist

- [ ] **1. Run Auth/Sign-up tests in Guest Mode** (prevent session bleed)
- [ ] **2. Configure `baseURL` in `playwright.config.ts`** and use relative paths
- [ ] **3. Add Assertions & Rename `tests/saas.spec.ts` → `tests/auth.spec.ts`**
- [ ] **4. Add npm Scripts to `package.json`**
- [ ] **5. Fix Typos and Remove Unused Imports**

---

## 1. ⚠️ Run Auth / Sign-up Tests in Guest Mode

### The Issue
In `playwright.config.ts`, `storageState: 'playwright/.auth/user.json'` is configured for all major browser projects (`chromium`, `firefox`, `webkit`).
When tests inside `tests/saas.spec.ts` run (testing account creation and login), the browser is **already authenticated**. Visiting `/login` or `/signup` while logged in can cause automatic redirects or session invalidation.

### The Fix
In your login/signup test file (`tests/auth.spec.ts`), explicitly reset the storage state so tests always run as an unauthenticated guest:

```ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { SignUpPage } from '../pages/SignUpPage';

// 🔹 Force this entire file to run unauthenticated
test.use({ storageState: { cookies: [], origins: [] } });

test('create account', async ({ page }) => {
    // ...
});

test('log into account', async ({ page }) => {
    // ...
});
```

---

## 2. 🌐 Set `baseURL` in `playwright.config.ts`

### The Issue
In `pages/LoginPage.ts` and `pages/SignUpPage.ts`, full URLs are hardcoded:
- `await this.page.goto('https://storedemo.testdino.com/login');`
- `await this.page.goto('https://storedemo.testdino.com/signup');`

### The Fix
1. In `playwright.config.ts`, uncomment and define `baseURL`:
```ts
export default defineConfig({
  use: {
    baseURL: 'https://storedemo.testdino.com',
    trace: 'on-first-retry',
  },
  // ...
});
```

2. Update page objects to use relative routes:
```ts
// pages/LoginPage.ts
async goto() {
    await this.page.goto('/login');
}

// pages/SignUpPage.ts
async goto() {
    await this.page.goto('/signup');
}
```

---

## 3. 🧪 Add Assertions and Rename `tests/saas.spec.ts`

### The Issue
- The file is currently named `saas.spec.ts`, whereas `ROADMAP.md` calls it `auth.spec.ts`.
- `test('log into account', ...)` executes the login action but contains **no assertions**. If login fails or silently hangs, the test still reports green.

### The Fix
Rename `tests/saas.spec.ts` to `tests/auth.spec.ts` and add explicit assertions:

```ts
test('log into account', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('zecaurubu@yopmail.com', 'zeca123');

    // 🔹 Assert redirection away from login or presence of logged-in UI
    await expect(page).not.toHaveURL(/.*login/);
});
```

---

## 4. 📦 Add NPM Scripts to `package.json`

### The Issue
`package.json` has an empty `"scripts": {}` section, requiring manual execution of raw CLI commands.

### The Fix
Add the standard Playwright script shortcuts:

```json
"scripts": {
  "test": "playwright test",
  "test:ui": "playwright test --ui",
  "test:headed": "playwright test --headed",
  "test:report": "playwright show-report",
  "test:auth": "playwright test tests/auth.spec.ts"
}
```

Now you can run:
- `npm test`
- `npm run test:ui` (interactive UI mode)
- `npm run test:headed`
- `npm run test:report`

---

## 5. ✏️ Typos & Code Cleanups

1. **`pages/SignUpPage.ts`**:
   - Rename `sucessToast` → `successToast` (missing second 'c').
2. **`pages/LoginPage.ts`**:
   - Remove unused `expect` import on line 1 (`import { type Locator, type Page } from '@playwright/test';`).
3. **`tests/auth.setup.ts`**:
   - Fix typo in test title: `setup('autheticate', ...)` → `setup('authenticate', ...)`.
