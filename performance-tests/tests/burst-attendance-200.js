// PERF-015 (-e ACTION=checkin), PERF-016 (-e ACTION=checkout): 200 tai khoan da dang nhap
// cung gui cham cong trong cua so 5 giay, 40 luot/giay, ghi that 200 ban ghi.
import exec from 'k6/execution';
import { requiredEnv, requireRunPermission } from '../config/env.js';
import { ACCEPT, TECH_ERROR_THRESHOLD } from '../config/thresholds.js';
import { loginFlow } from '../flows/login-flow.js';
import { ACTIONS, prepareUser } from '../flows/multi-account-flow.js';
import { accounts, requireAccounts } from '../lib/accounts.js';
import { CHECKIN_NAME, CHECKOUT_NAME } from '../lib/attendance.js';
import { evaluateRecovery, windowTag, windowThresholds } from '../lib/recovery.js';
import { buildSummary } from '../lib/summary.js';
import { waitForSlot } from '../lib/sync.js';

const VUS = 200;
const WINDOW_MS = 5000;
const MINUTES = 8;
const ACTION = requiredEnv('ACTION');
const action = ACTIONS[ACTION];
if (!action) {
  throw new Error('Thiếu ACTION hợp lệ: checkin hoặc checkout.');
}
const NAME = ACTION === 'checkin' ? CHECKIN_NAME : CHECKOUT_NAME;
const CASE_ID = ACTION === 'checkin' ? 'PERF-015' : 'PERF-016';

export const options = {
  setupTimeout: '10m',
  scenarios: {
    probe: { executor: 'constant-arrival-rate', exec: 'probe', rate: 1, timeUnit: '1s', duration: `${MINUTES}m`, preAllocatedVUs: 5, maxVUs: 20 },
    burst: { executor: 'per-vu-iterations', exec: 'burst', vus: VUS, iterations: 1, startTime: '2m', maxDuration: '2m' },
  },
  thresholds: {
    ...TECH_ERROR_THRESHOLD,
    ...windowThresholds('probe', MINUTES),
    attendance_success_count: [`count==${VUS}`],
    [`http_req_duration{api:${ACTION}}`]: [`p(95)<${ACCEPT.p95}`, `p(99)<${ACCEPT.p99}`],
    [`http_reqs{name:${NAME}}`]: ['count>=0'],
    [`http_req_failed{name:${NAME}}`]: ['rate>=0'],
  },
};

export function setup() {
  requireRunPermission();
  requireAccounts(VUS);
  return { users: accounts.slice(0, VUS).map((account) => prepareUser(account, action)) };
}

export function probe() {
  loginFlow({ window: windowTag() });
}

export function burst(data) {
  waitForSlot(WINDOW_MS, VUS);
  const user = data.users[exec.scenario.iterationInTest];
  action.send(user.token, user.location, [action.status]);
}

export const handleSummary = buildSummary(
  CASE_ID,
  [{ api: ACTION, name: NAME }],
  (data) => evaluateRecovery(data, 'probe', [0, 1], [3, 4, 5, 6, 7]),
);
