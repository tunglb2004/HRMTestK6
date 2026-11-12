// Luong cham cong dai dien: login → check-in hoac login → check-out, do them tong thoi gian flow.
// Check-in va check-out co khung gio khac nhau nen khong chay chung mot lan.
// Dung cho PERF-001, PERF-003, PERF-004, PERF-007, PERF-009, PERF-010, PERF-011, PERF-012.
import { Trend } from 'k6/metrics';
import { attendanceSuccess, checkIn, checkOut } from '../lib/attendance.js';
import { checkEnvelope } from '../lib/assertions.js';
import { login } from '../lib/auth.js';

const flowDuration = new Trend('flow_duration_ms', true);

export function checkInStep(token, location, expected = [201], extraTags = {}) {
  const res = checkIn(token, location, expected, extraTags);
  if (res.status === 201) {
    attendanceSuccess.add(1);
  }
  return res;
}

export function checkOutStep(token, location, expected = [200], extraTags = {}) {
  const res = checkOut(token, location, expected, extraTags);
  if (res.status === 200) {
    attendanceSuccess.add(1);
  }
  return res;
}

// action: 'checkin' hoac 'checkout'. Buoc cham cong chi chay khi login hop le.
export function attendanceFlow(location, action) {
  const started = Date.now();
  const token = login();
  if (!token) return false;
  const res = action === 'checkin' ? checkInStep(token, location) : checkOutStep(token, location);
  const status = action === 'checkin' ? 201 : 200;
  if (!checkEnvelope(res, status, action === 'checkin' ? 'check-in' : 'check-out')) return false;
  flowDuration.add(Date.now() - started);
  return true;
}
