// PERF-009 (-e ACTION=checkin), PERF-010 (-e ACTION=checkout), PERF-011 (-e ACTION=both):
// gui dong thoi cung tai khoan de kiem tra chong ghi trung va tinh nhat quan.
// Rule 5 lan/ngay: tu lan thu 6 server tra 429, nen 429 la phan hoi mong doi va so lan khong bi 429 phai <= 5.
import exec from 'k6/execution';
import { requiredEnv, requireRunPermission } from '../config/env.js';
import { checkInStep, checkOutStep } from '../flows/attendance-flow.js';
import { assertState, BEFORE_CHECKOUT, dataIntegrityErrors, getTodayInfo, locationOf, recordCountOfDay, attemptLimitThresholds, CHECKIN_NAME, CHECKOUT_NAME } from '../lib/attendance.js';
import { loginOrFail } from '../lib/auth.js';
import { buildSummary } from '../lib/summary.js';
import { waitForSlot } from '../lib/sync.js';

const ACTION = requiredEnv('ACTION');
const CHECKIN = { api: 'checkin', name: CHECKIN_NAME };
const CHECKOUT = { api: 'checkout', name: CHECKOUT_NAME };
const CONFIG = {
  // Check-in va check-out deu duoc ghi de gio (xac nhan 03/11/2026 va 02/11/2026), toi da 5 lan/ngay,
  // nen 1–5 lan thanh cong la dung; ghi trung duoc bat bang so ban ghi trong ngay o teardown.
  checkin: { caseId: 'PERF-009', vus: 10, windowMs: 1000, state: 'notCheckedIn', success: ['count>=1', 'count<=5'], apis: [CHECKIN] },
  checkout: { caseId: 'PERF-010', vus: 10, windowMs: 1000, state: BEFORE_CHECKOUT, success: ['count>=1', 'count<=5'], apis: [CHECKOUT] },
  both: { caseId: 'PERF-011', vus: 2, windowMs: 100, state: 'notCheckedIn', success: ['count>=1'], apis: [CHECKIN, CHECKOUT] },
}[ACTION];
if (!CONFIG) {
  throw new Error('Thiếu ACTION hợp lệ: checkin, checkout hoặc both.');
}

const metricThresholds = {};
for (const { api, name } of CONFIG.apis) {
  metricThresholds[`http_req_duration{api:${api}}`] = ['p(95)>=0'];
  metricThresholds[`http_reqs{name:${name}}`] = ['count>=0'];
}

export const options = {
  scenarios: {
    race: { executor: 'per-vu-iterations', vus: CONFIG.vus, iterations: 1, startTime: '2s', maxDuration: '1m' },
  },
  thresholds: {
    attendance_success_count: CONFIG.success,
    data_integrity_errors: ['count==0'],
    tech_errors: ['rate==0'],
    ...attemptLimitThresholds(CONFIG.apis.map(({ api }) => api)),
    ...metricThresholds,
  },
};

export function setup() {
  requireRunPermission();
  const token = loginOrFail();
  const info = getTodayInfo(token);
  assertState(info, CONFIG.state);
  return { token, location: locationOf(info), before: info.todayRecord, date: info.date };
}

export default function (data) {
  waitForSlot(CONFIG.windowMs, CONFIG.vus);
  if (ACTION === 'checkin') {
    checkInStep(data.token, data.location, [201, 409, 429]);
  } else if (ACTION === 'checkout') {
    checkOutStep(data.token, data.location, [200, 400, 409, 429]);
  } else if (exec.scenario.iterationInTest % 2 === 0) {
    checkInStep(data.token, data.location, [201, 409, 429]);
  } else {
    checkOutStep(data.token, data.location, [200, 400, 429]);
  }
}

export function teardown(data) {
  // Check-out khi chua check-in la hop le (server ghi MISSING_CHECKIN), nen khong tinh la sai du lieu.
  const record = getTodayInfo(data.token).todayRecord;
  if (ACTION === 'checkin' && (!record || !record.checkInAt)) {
    dataIntegrityErrors.add(1);
  }
  if (ACTION === 'checkout' && (!record || !record.checkOutAt)) {
    dataIntegrityErrors.add(1);
  }
  // Gui dong thoi nhieu lan van chi duoc co 1 ban ghi trong ngay.
  if (recordCountOfDay(data.token, data.date) > 1) {
    dataIntegrityErrors.add(1);
  }
}

export const handleSummary = buildSummary(CONFIG.caseId, CONFIG.apis);
