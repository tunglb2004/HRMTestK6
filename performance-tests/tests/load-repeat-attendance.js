// PERF-003 (-e ACTION=checkin), PERF-004 (-e ACTION=checkout): case phu, khong dung de nghiem thu.
// Cham cong lap duoc ghi de gio (201/200) toi khi het 5 lan/ngay, sau do server tra 429.
import { requiredEnv, requireRunPermission } from '../config/env.js';
import { ACCEPT, TECH_ERROR_THRESHOLD } from '../config/thresholds.js';
import { checkIn, checkOut, CHECKIN_NAME, CHECKOUT_NAME, assertState, dataIntegrityErrors, getTodayInfo, locationOf, recordCountOfDay, attemptLimitThresholds } from '../lib/attendance.js';
import { loginOrFail } from '../lib/auth.js';
import { buildSummary } from '../lib/summary.js';

const ACTION = requiredEnv('ACTION');
const CONFIG = {
  checkin: { caseId: 'PERF-003', api: 'checkin', name: CHECKIN_NAME, statuses: [201, 409, 429], state: 'checkedIn', send: checkIn },
  checkout: { caseId: 'PERF-004', api: 'checkout', name: CHECKOUT_NAME, statuses: [200, 400, 409, 429], state: 'checkedOut', send: checkOut },
}[ACTION];
if (!CONFIG) {
  throw new Error('Thiếu ACTION hợp lệ: checkin hoặc checkout.');
}

export const options = {
  scenarios: {
    repeat: {
      executor: 'constant-arrival-rate',
      rate: 1,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 5,
      maxVUs: 20,
    },
  },
  thresholds: {
    ...TECH_ERROR_THRESHOLD,
    expected_response_rate: ['rate>=0.99'],
    data_integrity_errors: ['count==0'],
    // Rule 5 lan/ngay: sau 5 lan server phai tra 429.
    ...attemptLimitThresholds([ACTION]),
    [`http_req_duration{api:${CONFIG.api}}`]: [`p(95)<${ACCEPT.p95}`, `p(99)<${ACCEPT.p99}`],
    [`http_reqs{name:${CONFIG.name}}`]: ['count>=0'],
    [`http_req_failed{name:${CONFIG.name}}`]: ['rate>=0'],
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
  CONFIG.send(data.token, data.location, CONFIG.statuses);
}

export function teardown(data) {
  // Ghi de chi duoc doi gio cua chinh thao tac do; gio con lai giu nguyen va van chi 1 ban ghi.
  const after = getTodayInfo(data.token).todayRecord;
  const otherChanged = ACTION === 'checkin'
    ? after && after.checkOutAt !== data.before.checkOutAt
    : after && after.checkInAt !== data.before.checkInAt;
  if (!after || otherChanged || recordCountOfDay(data.token, data.date) > 1) {
    dataIntegrityErrors.add(1);
  }
}

export const handleSummary = buildSummary(CONFIG.caseId, [{ api: CONFIG.api, name: CONFIG.name }]);
