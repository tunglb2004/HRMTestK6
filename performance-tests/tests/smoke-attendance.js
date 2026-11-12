// PERF-001: 1 luot login → check-in (-e PHASE=checkin, trong khung check-in),
// roi 1 luot login → check-out (-e PHASE=checkout, trong khung check-out). Chi de tham khao, khong dung de nghiem thu.
import { requiredEnv, requireRunPermission } from '../config/env.js';
import { attendanceFlow } from '../flows/attendance-flow.js';
import { assertState, BEFORE_CHECKOUT, dataIntegrityErrors, getTodayInfo, locationOf, stateOf, CHECKIN_NAME, CHECKOUT_NAME } from '../lib/attendance.js';
import { LOGIN_NAME, loginOrFail } from '../lib/auth.js';
import { buildSummary } from '../lib/summary.js';

const PHASE = requiredEnv('PHASE');
const CONFIG = {
  checkin: { state: 'notCheckedIn', after: 'checkedIn', api: { api: 'checkin', name: CHECKIN_NAME } },
  checkout: { state: BEFORE_CHECKOUT, after: 'checkedOut', api: { api: 'checkout', name: CHECKOUT_NAME } },
}[PHASE];
if (!CONFIG) {
  throw new Error('Thiếu PHASE hợp lệ: checkin hoặc checkout.');
}

export const options = {
  scenarios: {
    smoke: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '1m' },
  },
  thresholds: {
    checks: ['rate==1'],
    data_integrity_errors: ['count==0'],
    [`http_reqs{name:${LOGIN_NAME}}`]: ['count>=0'],
    [`http_reqs{name:${CONFIG.api.name}}`]: ['count>=0'],
    'http_req_duration{api:login}': ['p(95)>=0'],
    [`http_req_duration{api:${CONFIG.api.api}}`]: ['p(95)>=0'],
  },
};

export function setup() {
  requireRunPermission();
  const token = loginOrFail();
  const info = getTodayInfo(token);
  assertState(info, CONFIG.state);
  return { token, location: locationOf(info) };
}

export default function (data) {
  attendanceFlow(data.location, PHASE);
}

export function teardown(data) {
  if (stateOf(getTodayInfo(data.token)) !== CONFIG.after) {
    dataIntegrityErrors.add(1);
  }
}

export const handleSummary = buildSummary('PERF-001', [{ api: 'login', name: LOGIN_NAME }, CONFIG.api]);
