# 🛠️ Hands-On CI/CD Implementation Guide for `frfr`

This document is a **practical, step-by-step implementation guide** tailored specifically for your `frfr` project. It contains the exact code to add, a line-by-line breakdown of how each piece works, the underlying rationale, and an interview script you can use to explain your architecture with confidence.

---

## 📋 Table of Contents
1. [Current State vs. Desired CI/CD Architecture](#1-current-state-vs-desired-cicd-architecture)
2. [Step 1: Configure Playwright for CI (`playwright.config.ts`)](#step-1-configure-playwright-for-ci-playwrightconfigts)
3. [Step 2: Tag Tests with `@smoke` & `@regression`](#step-2-tag-tests-with-smoke--regression)
4. [Step 3: Build Workflow 1 — Fast PR Gatekeeper (`pr-smoke.yml`)](#step-3-build-workflow-1--fast-pr-gatekeeper-pr-smokeyml)
5. [Step 4: Build Workflow 2 — Nightly & Manual Regression (`regression.yml`)](#step-4-build-workflow-2--nightly--manual-regression-regressionyml)
6. [Step 5: Local Testing Before Pushing to GitHub](#step-5-local-testing-before-pushing-to-github)
7. [Step 6: Pushing to GitHub & Observing the Pipeline](#step-6-pushing-to-github--observing-the-pipeline)
8. [Step 7: The Interview Script (Word-for-Word Walkthrough)](#step-7-the-interview-script-word-for-word-walkthrough)

---

## 1. Current State vs. Desired CI/CD Architecture

| Feature | Current State (`playwright.yml`) | Target Implementation |
|---|---|---|
| **Trigger Strategy** | Runs everything on every push | **Tiered:** Fast PR check on PRs + Nightly/Manual for full regression |
| **Execution Speed** | Downloads all browsers on every run (~2–3 mins) | **Optimized:** Fast targeted install (Chromium only on PRs, <1 min) + npm caching (avoiding browser cache anti-pattern) |
| **Test Scope on PR** | Runs all browsers & all tests | **Targeted:** Runs `@smoke` on Chromium only (<2 mins total) |
| **Scaling** | Single runner only | **Sharded:** Splits regression across parallel matrix runners |
| **Reporting** | Raw zip file artifact | **Actionable:** Inline GitHub PR annotations + consolidated HTML report |

---

## Step 1: Configure Playwright for CI (`playwright.config.ts`)

In `playwright.config.ts`, we need to make sure the reporters and retry policies are optimized for CI environments.

### What to Update:
Open `playwright.config.ts` and ensure your `use` and `reporter` sections look like this:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  
  // 🔹 Retry failed tests 2 times on CI, but 0 times locally
  retries: process.env.CI ? 2 : 0,
  
  // 🔹 Use 2 workers on CI (matching GitHub runner vCPUs), undefined locally (uses all cores)
  workers: process.env.CI ? 2 : undefined,

  // 🔹 Reporters: 'html' for the full report, 'github' for inline PR annotations
  reporter: process.env.CI 
    ? [['html', { open: 'never' }], ['github']]
    : [['html', { open: 'on-failure' }]],

  use: {
    // 🔹 Define baseURL so tests use relative paths ('/login')
    baseURL: 'https://storedemo.testdino.com',

    // 🔹 Record traces ONLY when retrying a failed test
    trace: 'on-first-retry',
    
    // 🔹 Capture screenshots only on failure to save disk space
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'setup', 
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'], 
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
```

### 💡 Why this matters for an interview:
- **`process.env.CI ? 2 : 0`**: Explain to the interviewer that you *never* mask flaky tests during local development (0 retries). But in CI, minor network blips or cloud latency could fail a build, so 2 retries ensure resilience without hiding bugs.
- **`['github']` reporter**: Tells Playwright to write GitHub Actions workflow commands (`::error file=...::`). When a test fails in a PR, GitHub displays a red box directly on the exact line of code in the PR review window!
- **`trace: 'on-first-retry'`**: Capturing traces on all tests creates hundreds of megabytes of zip files. Setting it to `on-first-retry` ensures zero overhead on passing tests, while providing 100% forensic data (DOM snapshots, network logs) on failed tests.

---

## Step 2: Tag Tests with `@smoke` & `@regression`

In your test files (e.g. `tests/saas.spec.ts` or `tests/auth.spec.ts`), add tags into test titles.

### Example in `tests/saas.spec.ts` (or `tests/auth.spec.ts`):
```ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { SignUpPage } from '../pages/SignUpPage';

// For guest/auth tests, clear any global storageState:
test.use({ storageState: { cookies: [], origins: [] } });

// 🔹 SMOKE TEST: Critical path user login
test('log into account @smoke', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('zecaurubu@yopmail.com', 'zeca123');
    
    // Assertion: User is redirected away from login
    await expect(page).not.toHaveURL(/.*login/);
});

// 🔹 REGRESSION TEST: Account creation with dynamic email
test('create account @regression', async ({ page }) => {
    const signUpPage = new SignUpPage(page);
    await signUpPage.goto();

    const uniqueEmail = `zeca_${Date.now()}@email.com`;
    await signUpPage.signUp('zeca', 'urubu', uniqueEmail, '123123123');
});
```

### 💡 Why this matters for an interview:
- **Test Categorization Principle**: Smoke tests verify that the application's most critical paths are working (e.g. user can log in, add to cart). Regression tests verify edge cases, form validations, and secondary flows.
- This enables your CI pipeline to run only `@smoke` on PRs to unblock developers in under 2 minutes.

---

## Step 3: Build Workflow 1 — Fast PR Gatekeeper (`pr-smoke.yml`)

Create a new file at `.github/workflows/pr-smoke.yml`.

### The File Content:
```yaml
name: PR Smoke Gatekeeper

on:
  pull_request:
    branches: [ main, master ]

# Cancel in-progress runs on the same PR branch if a new commit is pushed
concurrency:
  group: pr-${{ github.ref }}
  cancel-in-progress: true

jobs:
  smoke-test:
    name: Run Smoke Tests (Chromium)
    timeout-minutes: 10
    runs-on: ubuntu-latest

    steps:
      # 1. Checkout the repository code
      - name: Checkout Code
        uses: actions/checkout@v6

      # 2. Set up Node.js environment (with npm cache)
      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: lts/*
          cache: 'npm'

      # 3. Clean install npm dependencies
      - name: Install Dependencies
        run: npm ci

      # 4. Fast targeted install: Chromium and its OS dependencies only
      - name: Install Playwright Chromium
        run: npx playwright install --with-deps chromium

      # 5. Execute only @smoke tests on Chromium
      - name: Run Smoke Tests
        run: npx playwright test --project=chromium --grep @smoke
        env:
          CI: true

      # 6. Upload test report (general upload matching official Playwright style)
      - name: Upload Test Report
        uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: pr-smoke-report
          path: playwright-report/
          retention-days: 30
```

### 💡 Line-by-Line Breakdown & Interview Insights:
1. **`actions/checkout@v6` & `actions/setup-node@v6`**:
   - Uses the latest major release versions recommended in the official Playwright documentation for maximum security and runner compatibility.
2. **`concurrency: cancel-in-progress: true`**:
   - *What it does:* If a developer pushes commit A, then immediately pushes commit B, GitHub cancels the test run for commit A.
   - *Interview talking point:* *"We configure workflow concurrency to cancel redundant builds, saving company runner minutes and reducing pipeline congestion."*
3. **`cache: 'npm'` (Why we cache npm, but NOT browser binaries)**:
   - *Official Playwright Guidance:* Caching browser binaries is **not recommended** because downloading a ~1GB cache zip and decompressing it takes almost the same time as downloading from Playwright's CDN, and Linux OS system dependencies (installed by `apt-get`) cannot be cached anyway.
   - *The winning strategy:* We cache `node_modules` via `cache: 'npm'` (which *is* fast and safe) and we run a targeted install (`npx playwright install --with-deps chromium`) to avoid downloading Firefox and WebKit on PRs.
4. **`--project=chromium --grep @smoke`**:
   - Restricts execution to the fastest browser and the essential tests to guarantee PR checks complete in under 2 minutes.

---

## Step 4: Build Workflow 2 — Nightly & Manual Regression (`regression.yml`)

Create a new file at `.github/workflows/regression.yml`.

### The File Content:
```yaml
name: Full Regression Suite

on:
  schedule:
    # 🔹 Runs automatically every day at 2:00 AM UTC
    - cron: '0 2 * * *'
  
  # 🔹 Allows manual execution from the GitHub Actions UI
  workflow_dispatch:
    inputs:
      grep_tag:
        description: 'Filter tests by tag (e.g. @smoke, @regression, or leave blank for all)'
        required: false
        default: ''
      project:
        description: 'Browser project (chromium, firefox, webkit, or all)'
        required: false
        default: 'all'

jobs:
  test-shards:
    name: Run Shard ${{ matrix.shard }}
    timeout-minutes: 30
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        # 🔹 Run across 2 parallel runners
        shard: [1/2, 2/2]

    steps:
      - name: Checkout Code
        uses: actions/checkout@v6

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: lts/*
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Install Playwright Browsers & OS Deps
        run: npx playwright install --with-deps

      # 🔹 Run tests on this shard and output a 'blob' report
      - name: Run Tests (Shard ${{ matrix.shard }})
        run: |
          TAG="${{ github.event.inputs.grep_tag }}"
          PROJ="${{ github.event.inputs.project }}"
          
          CMD="npx playwright test --shard=${{ matrix.shard }} --reporter=blob"
          
          if [ -n "$TAG" ]; then
            CMD="$CMD --grep $TAG"
          fi
          
          if [ -n "$PROJ" ] && [ "$PROJ" != "all" ]; then
            CMD="$CMD --project=$PROJ"
          fi
          
          echo "Executing: $CMD"
          $CMD
        env:
          CI: true

      # 🔹 Upload this shard's blob report
      - name: Upload Blob Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: blob-report-${{ strategy.job-index }}
          path: blob-report/
          retention-days: 1

  merge-reports:
    name: Merge Reports & Publish
    needs: [test-shards]
    if: always()
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Code
        uses: actions/checkout@v6

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: lts/*

      - name: Install Dependencies
        run: npm ci

      # 🔹 Download blob reports from all shards
      - name: Download All Blob Reports
        uses: actions/download-artifact@v4
        with:
          path: all-blob-reports
          pattern: blob-report-*
          merge-multiple: true

      # 🔹 Merge into a single HTML report
      - name: Merge Reports into HTML
        run: npx playwright merge-reports --reporter html ./all-blob-reports

      # 🔹 Upload consolidated HTML report
      - name: Upload Consolidated HTML Report
        uses: actions/upload-artifact@v4
        with:
          name: full-regression-report
          path: playwright-report/
          retention-days: 14
```

### 💡 Line-by-Line Breakdown & Interview Insights:
1. **`workflow_dispatch` with inputs**:
   - Gives you a "Run workflow" button in the GitHub web interface where QA or developers can choose which browser or tag to run on demand (e.g. before releasing a hotfix).
2. **`matrix: shard: [1/2, 2/2]`**:
   - GitHub spawns **2 separate virtual machines** at the exact same moment. Machine 1 runs test 1 to 50; Machine 2 runs test 51 to 100.
   - *Interview talking point:* *"We use matrix sharding to scale test runs horizontally. If the suite expands from 100 to 500 tests, we simply increase the shard matrix to 4 or 8 runners without increasing overall pipeline wall-clock time."*
3. **`reporter=blob` and `merge-reports`**:
   - Each shard generates a raw data file called a `blob`. The `merge-reports` job collects all blobs and combines them into one unified, clean HTML report.

---

## Step 5: Local Testing Before Pushing to GitHub

Always verify your configuration on your machine first:

```powershell
# 1. Run only smoke tests locally
npx playwright test --grep @smoke

# 2. Run only regression tests locally
npx playwright test --grep @regression

# 3. Simulate Shard 1 of 2
npx playwright test --shard=1/2

# 4. Simulate Shard 2 of 2
npx playwright test --shard=2/2

# 5. Check if playwright.config.ts has any syntax issues
npx playwright test --dry-run
```

---

## Step 6: Pushing to GitHub & Observing the Pipeline

When you are ready to push these workflows:

1. Commit your changes:
   ```bash
   git add .
   git commit -m "feat(ci): implement dual-tier CI/CD with caching and sharding"
   git push origin main
   ```
2. Navigate to your repository on GitHub.
3. Click the **"Actions"** tab:
   - You will see **"PR Smoke Gatekeeper"** and **"Full Regression Suite"**.
   - Click "Full Regression Suite" → click **"Run workflow"** to trigger an on-demand run and watch the two shards run in parallel!

---

## Step 7: The Interview Script (Word-for-Word Walkthrough)

When an interviewer says: **"Walk me through how you set up CI/CD for your Playwright test framework."**

Use this structured response:

> 1. **The Strategy**:
> *"Instead of running everything in a single slow pipeline, I structured our CI/CD into two distinct workflows in GitHub Actions: a **Fast PR Smoke Gatekeeper** and a **Nightly Full Regression**."*
>
> 2. **The PR Gatekeeper**:
> *"For our PR checks, we want developers to get feedback in under 2 minutes. We achieve this by:*
> - *Running only `@smoke` tagged tests on a single browser (Chromium).*
> - *Following Playwright's official advice on caching: we avoid caching heavy browser binaries (since cache decompression takes ~30s and Linux OS libraries cannot be cached anyway). Instead, we cache npm dependencies and run a targeted install of Chromium only (`--with-deps chromium`), keeping setup lightning fast.*
> - *Using the native `github` reporter so failed test assertions appear directly inline in the pull request code review."*
>
> 3. **The Nightly & On-Demand Regression**:
> *"For our full regression suite, we run overnight at 2:00 AM across Chromium, Firefox, and WebKit.*
> - *To keep execution fast as the suite scales, we use **matrix sharding** (`--shard=1/2`, `2/2`) across parallel GitHub runners.*
> - *Each shard produces a `blob` report, and a final job uses `npx playwright merge-reports` to combine them into a single consolidated HTML report.*
> - *We also enabled `workflow_dispatch` with input parameters, allowing QA to trigger manual runs against specific tags or browsers on demand."*
>
> 4. **Failure Triage & Stability**:
> *"To handle flaky tests and cloud debugging:*
> - *We set `retries: 2` on CI only, leaving it at `0` locally so we never hide bugs.*
> - *We configure `trace: 'on-first-retry'` to capture DOM snapshots, network calls, and console logs strictly on failures without adding overhead to passing tests.*
> - *If a test fails, engineers can download the trace file and inspect it visually in `trace.playwright.dev`."*
