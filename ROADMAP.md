# Test Automation Roadmap: TestDino Store Demo

A hands-on Page Object Model (POM) learning roadmap for **[https://storedemo.testdino.com](https://storedemo.testdino.com)** using **Playwright** and **TypeScript**.

---

## 📁 Project Architecture

```text
frfr/
├── .github/
│   └── workflows/
│       └── playwright.yml        # CI/CD Pipeline (GitHub Actions)
├── pages/
│   ├── components/
│   │   ├── Header.ts             # Global navigation bar component
│   │   └── CartDrawer.ts         # Slide-out shopping cart drawer component
│   ├── LoginPage.ts              # /login
│   ├── SignupPage.ts             # /signup
│   ├── ProductsPage.ts           # /products (catalog & search)
│   └── ProductDetailPage.ts      # /product/:slug (details & purchasing)
├── playwright/
│   └── .auth/
│       └── user.json             # Saved authentication state (JWT/cookies)
├── tests/
│   ├── auth.setup.ts             # Setup project: logs in & creates user.json
│   ├── auth.spec.ts              # Login & signup tests (run as guest)
│   ├── products.spec.ts          # Search and product discovery tests
│   └── cart.spec.ts              # Cart & checkout tests (run authenticated)
├── playwright.config.ts          # Multi-project config, dependencies & storageState
└── tsconfig.json                 # TypeScript compiler options
```

---

## 🧩 Page Objects to Build

> 🎯 **Your Learning Mission**: Use Playwright Codegen (`npx playwright codegen https://storedemo.testdino.com`) or Browser DevTools to inspect and choose the best locators for each element!

---

### 1. `Header` Component (`pages/components/Header.ts`)
*Shared navigation bar present at the top of every page.*

* **Elements to locate:**
  * Logo image/link
  * Navigation links (*Home*, *About Us*, *Contact Us*, *All Products*)
  * Shopping cart icon button
  * Cart item count badge
  * Wishlist icon button
  * User profile icon
* **Methods to implement:**
  * `openCart()`
  * `getCartCount(): Promise<number>`
  * `goToProducts()`
  * `clickUserIcon()`

---

### 2. `CartDrawer` Component (`pages/components/CartDrawer.ts`)
*The fly-out cart panel that opens when clicking the cart icon or adding an item.*

* **Elements to locate:**
  * Drawer container/dialog
  * Drawer header title
  * Close cart button (*"Close cart"* or close icon)
  * Cart item rows (title, price, quantity)
  * Proceed to checkout button
* **Methods to implement:**
  * `close()`
  * `proceedToCheckout()`
  * `assertItemPresent(productName: string)`

---

### 3. `LoginPage` (`pages/LoginPage.ts`) ✅
*Route: `/login`*

* **Elements to locate:**
  * Email input field
  * Password input field
  * Sign in / Submit button
  * Link to the Sign Up page
  * Error message container (for failed logins)
* **Methods to implement:**
  * `goto()`
  * `login(email: string, pass: string)`
  * `goToSignup()`
  * `getErrorMessage(): Promise<string>`

---

### 4. `SignupPage` (`pages/SignupPage.ts`)
*Route: `/signup`*

* **Elements to locate:**
  * First name input field
  * Last name input field
  * Email input field
  * Password input field
  * "Terms & Conditions" checkbox
  * Sign up submit button
  * Link back to Login
* **Methods to implement:**
  * `goto()`
  * `register(userData: UserData)`

---

### 5. `ProductsPage` (`pages/ProductsPage.ts`)
*Route: `/products`*

* **Elements to locate:**
  * Search input field
  * Filter button
  * Product card containers
  * Product title headings
  * Product price labels
  * Quick "Add to cart" buttons on each product card
  * Wishlist toggle buttons
* **Methods to implement:**
  * `goto()`
  * `search(query: string)`
  * `selectProduct(productName: string)`
  * `quickAddToCart(productName: string)`

---

### 6. `ProductDetailPage` (`pages/ProductDetailPage.ts`)
*Route: `/product/:slug`*

* **Elements to locate:**
  * Product title / heading
  * Product price
  * Product description text
  * Quantity selector / input
  * "ADD TO CART" button
  * "BUY NOW" button
  * Detail tabs (*Description*, *Additional Information*, *Reviews*)
* **Methods to implement:**
  * `addToCart()`
  * `buyNow()`
  * `setQuantity(qty: number)`
  * `switchTab(tabName: string)`

---

## 🚀 Learning & Implementation Checklist

### Phase 1: Authentication & Core POM
- [x] **Step 1**: Build `pages/LoginPage.ts` and refactor `tests/auth.setup.ts` to use it.
- [ ] **Step 2**: Build `pages/SignupPage.ts`.
- [ ] **Step 3**: Create `tests/auth.spec.ts` (guest mode) to test:
  - Valid login & redirect
  - Invalid password error handling
  - Registration validations (e.g. submitting without checking Terms & Conditions)
  - *(Remember: use `test.use({ storageState: { cookies: [], origins: [] } })` to run as guest).*

### Phase 2: Catalog & Search
- [ ] **Step 4**: Build `pages/components/Header.ts`.
- [ ] **Step 5**: Build `pages/ProductsPage.ts`.
- [ ] **Step 6**: Create `tests/products.spec.ts` to test:
  - Searching for a specific product name
  - Verifying the grid filters correctly

### Phase 3: Product Details & Cart Workflows
- [ ] **Step 7**: Build `pages/ProductDetailPage.ts`.
- [ ] **Step 8**: Build `pages/components/CartDrawer.ts`.
- [ ] **Step 9**: Create `tests/cart.spec.ts` (using saved session) to test:
  - Opening a product and clicking "Add to Cart"
  - Verifying the cart drawer opens with the correct item and price
  - Verifying the cart badge count in the Header increments

---

## ⚙️ Phase 4: CI/CD & GitHub Actions Reference

### The Official Workflow (`.github/workflows/playwright.yml`)

```yaml
name: Playwright Tests
on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v6
    - uses: actions/setup-node@v6
      with:
        node-version: lts/*
    - name: Install dependencies
      run: npm ci
    - name: Install Playwright Browsers
      run: npx playwright install --with-deps
    - name: Run Playwright tests
      run: npx playwright test
    - uses: actions/upload-artifact@v4
      if: ${{ !cancelled() }}
      with:
        name: playwright-report
        path: playwright-report/
        retention-days: 30
```

### What are `actions/checkout@v6` & `actions/setup-node@v6`?
* **Actions**: Pre-packaged, open-source plugins maintained by GitHub that perform common CI tasks (cloning repositories, setting up runtimes).
* **The `@v...` Tag**: The **version number** of the plugin. Using newer major versions (like `@v6` or `@v4`) ensures support for modern Node.js environments and latest security patches.
  * `actions/checkout@v6`: Clones the repository onto the test runner.
  * `actions/setup-node@v6`: Configures the Node.js runtime and npm.
  * `actions/upload-artifact@v4`: Uploads the test report so you can download and view it in the GitHub Actions UI.

### Why Playwright Recommends Against Browser Binary Caching
* **Restoration speed vs Download speed**: Browser binaries are huge (500MB+). Unpacking the cache in GitHub Actions takes almost the same time as downloading from the high-speed CDN.
* **Linux OS dependencies cannot be cached**: On Linux runners, browsers need OS libraries (`libgbm`, `libgtk-3`, etc.) installed via `apt-get` (`--with-deps`). These cannot be cached by GitHub Actions, meaning system package installation must run anyway.
* **Official Recommendation**: Keep `npx playwright install --with-deps` clean without caching browser binaries.
