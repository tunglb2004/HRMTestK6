// PERF-014: 200 tai khoan rieng cung dang nhap trong cua so 5 giay, 40 lan/giay, co tai tham do de do phuc hoi.
import { requireRunPermission } from '../config/env.js';
import { apiThresholds, TECH_ERROR_THRESHOLD } from '../config/thresholds.js';
import { loginFlow } from '../flows/login-flow.js';
import { accounts, requireAccounts } from '../lib/accounts.js';
import { LOGIN_NAME, login } from '../lib/auth.js';
import { evaluateRecovery, windowTag, windowThresholds } from '../lib/recovery.js';
import { buildSummary } from '../lib/summary.js';
import { waitForSlot } from '../lib/sync.js';
import exec from 'k6/execution';

const VUS = 200;
const WINDOW_MS = 5000;
const MINUTES = 8;

export const options = {
  scenarios: {
    probe: { executor: 'constant-arrival-rate', exec: 'probe', rate: 1, timeUnit: '1s', duration: `${MINUTES}m`, preAllocatedVUs: 5, maxVUs: 20 },
    burst: { executor: 'per-vu-iterations', exec: 'burst', vus: VUS, iterations: 1, startTime: '2m', maxDuration: '2m' },
  },
  thresholds: {
    ...apiThresholds('login', LOGIN_NAME),
    ...TECH_ERROR_THRESHOLD,
    ...windowThresholds('probe', MINUTES),
    'http_req_duration{api:login,scenario:burst}': ['p(95)<1000', 'p(99)<2500'],
  },
};

export function setup() {
  requireRunPermission();
  requireAccounts(VUS);
}

export function probe() {
  loginFlow({ window: windowTag() });
}

export function burst() {
  waitForSlot(WINDOW_MS, VUS);
  const account = accounts[exec.scenario.iterationInTest];
  login(account.email, account.password);
}

export const handleSummary = buildSummary(
  'PERF-014',
  [{ api: 'login', name: LOGIN_NAME }],
  (data) => evaluateRecovery(data, 'probe', [0, 1], [3, 4, 5, 6, 7]),
);
