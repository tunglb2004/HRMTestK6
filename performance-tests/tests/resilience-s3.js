// PERF-012: nhom login doc lap 1 req/s va 20 VU check-in, 3 phut nen, 7 phut S3 loi, 5 phut phuc hoi.
// Loi S3 do nguoi van hanh gay bang cong cu ha tang, k6 khong gay duoc.
import { sleep } from 'k6';
import { SharedArray } from 'k6/data';
import exec from 'k6/execution';
import { requiredEnv, requireRunPermission } from '../config/env.js';
import { ACCEPT } from '../config/thresholds.js';
import { checkInStep } from '../flows/attendance-flow.js';
import { loginFlow } from '../flows/login-flow.js';
import { getTodayInfo, locationOf, CHECKIN_NAME } from '../lib/attendance.js';
import { LOGIN_NAME, login, loginOrFail } from '../lib/auth.js';
import { evaluateRecovery, windowTag, windowThresholds } from '../lib/recovery.js';
import { buildSummary } from '../lib/summary.js';

const MINUTES = 15;
const VUS = 20;
const THINK_SECONDS = Number(requiredEnv('CHECKIN_THINK_SECONDS'));
const accountsFile = requiredEnv('ACCOUNTS_FILE');

// File CSV 2 cot: email,password. File that khong nam trong project.
const accounts = new SharedArray('accounts', () => open(accountsFile)
  .split(/\r?\n/)
  .slice(1)
  .filter((line) => line.trim())
  .map((line) => {
    const [email, password] = line.split(',');
    return { email, password };
  }));

export const options = {
  scenarios: {
    login_probe: { executor: 'constant-arrival-rate', exec: 'loginProbe', rate: 1, timeUnit: '1s', duration: `${MINUTES}m`, preAllocatedVUs: 5, maxVUs: 20 },
    checkin_load: { executor: 'constant-vus', exec: 'checkinLoad', vus: VUS, duration: `${MINUTES}m` },
  },
  thresholds: {
    ...windowThresholds('login_probe', MINUTES),
    'http_req_duration{api:login,scenario:login_probe}': [`p(95)<${ACCEPT.p95}`, `p(99)<${ACCEPT.p99}`],
    'tech_errors{scenario:login_probe}': [`rate<${ACCEPT.techErrorRate}`],
    'http_req_duration{api:login}': ['p(95)>=0'],
    'http_req_duration{api:checkin}': ['max<30000'],
    [`http_reqs{name:${LOGIN_NAME}}`]: ['count>=0'],
    [`http_reqs{name:${CHECKIN_NAME}}`]: ['count>=0'],
  },
};

export function setup() {
  requireRunPermission();
  if (accounts.length < VUS) {
    throw new Error(`Cần ${VUS} tài khoản, file chỉ có ${accounts.length}.`);
  }
  return { location: locationOf(getTodayInfo(loginOrFail())) };
}

export function loginProbe() {
  loginFlow({ window: windowTag() });
}

export function checkinLoad(data) {
  const account = accounts[(exec.vu.idInTest - 1) % VUS];
  const token = login(account.email, account.password);
  if (token) {
    checkInStep(token, data.location, [201, 409, 500, 502, 503, 504]);
  }
  sleep(THINK_SECONDS);
}

export const handleSummary = buildSummary(
  'PERF-012',
  [{ api: 'login', name: LOGIN_NAME }, { api: 'checkin', name: CHECKIN_NAME }],
  (data) => evaluateRecovery(data, 'login_probe', [0, 1, 2], [10, 11, 12, 13, 14]),
);
