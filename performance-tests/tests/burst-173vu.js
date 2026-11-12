// PERF-007: 173 VU gui trong cua so 5 giay. -e PHASE=login do tai dang nhap;
// -e PHASE=checkin dung chung token, do tranh chap: check-in duoc ghi de nen 1–5 lan thanh cong, con lai 429
// vi moi nguoi chi duoc gui check-in 5 lan/ngay; van chi 1 ban ghi. Lap 3 lan.
import { requiredEnv, requireRunPermission } from '../config/env.js';
import { ACCEPT, TECH_ERROR_THRESHOLD } from '../config/thresholds.js';
import { checkInStep } from '../flows/attendance-flow.js';
import { loginFlow } from '../flows/login-flow.js';
import { assertState, attemptLimitThresholds, dataIntegrityErrors, getTodayInfo, locationOf, recordCountOfDay, stateOf, CHECKIN_NAME } from '../lib/attendance.js';
import { LOGIN_NAME, loginOrFail } from '../lib/auth.js';
import { evaluateRecovery, windowTag, windowThresholds } from '../lib/recovery.js';
import { buildSummary } from '../lib/summary.js';
import { waitForSlot } from '../lib/sync.js';

const VUS = 173;
const WINDOW_MS = 5000;
const MINUTES = 8;
const PHASE = requiredEnv('PHASE');
if (!['login', 'checkin'].includes(PHASE)) {
  throw new Error('Thiếu PHASE hợp lệ: login hoặc checkin.');
}

const phaseThresholds = PHASE === 'login'
  ? { 'http_req_duration{api:login,scenario:burst}': [`p(95)<${ACCEPT.p95}`, `p(99)<${ACCEPT.p99}`], ...TECH_ERROR_THRESHOLD }
  : {
    attendance_success_count: ['count>=1', 'count<=5'],
    ...attemptLimitThresholds(['checkin']),
    data_integrity_errors: ['count==0'],
    tech_errors: ['rate==0'],
    'http_req_duration{api:checkin}': ['p(95)>=0'],
    [`http_reqs{name:${CHECKIN_NAME}}`]: ['count>=0'],
  };

export const options = {
  scenarios: {
    probe: { executor: 'constant-arrival-rate', exec: 'probe', rate: 1, timeUnit: '1s', duration: `${MINUTES}m`, preAllocatedVUs: 5, maxVUs: 20 },
    burst: { executor: 'per-vu-iterations', exec: 'burst', vus: VUS, iterations: 1, startTime: '2m', maxDuration: '2m' },
  },
  thresholds: {
    ...phaseThresholds,
    ...windowThresholds('probe', MINUTES),
    'http_req_duration{api:login}': ['p(95)>=0'],
    [`http_reqs{name:${LOGIN_NAME}}`]: ['count>=0'],
    [`http_req_failed{name:${LOGIN_NAME}}`]: ['rate>=0'],
  },
};

export function setup() {
  requireRunPermission();
  if (PHASE === 'login') {
    return {};
  }
  const token = loginOrFail();
  const info = getTodayInfo(token);
  assertState(info, 'notCheckedIn');
  return { token, location: locationOf(info), date: info.date };
}

export function probe() {
  loginFlow({ window: windowTag() });
}

export function burst(data) {
  waitForSlot(WINDOW_MS, VUS);
  if (PHASE === 'login') {
    loginFlow();
  } else {
    checkInStep(data.token, data.location, [201, 409, 429]);
  }
}

export function teardown(data) {
  if (PHASE !== 'checkin') return;
  if (stateOf(getTodayInfo(data.token)) !== 'checkedIn' || recordCountOfDay(data.token, data.date) > 1) {
    dataIntegrityErrors.add(1);
  }
}

export const handleSummary = buildSummary(
  'PERF-007',
  PHASE === 'login' ? [{ api: 'login', name: LOGIN_NAME }] : [{ api: 'checkin', name: CHECKIN_NAME }],
  (data) => evaluateRecovery(data, 'probe', [0, 1], [3, 4, 5, 6, 7]),
);
