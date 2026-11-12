// Doc ca, dia diem, trang thai cham cong hom nay truoc moi bai cham cong. Khong tao du lieu.
// Dung cho PERF-001, PERF-003, PERF-004, PERF-007, PERF-009, PERF-010, PERF-011, PERF-012.
import { getTodayInfo, locationOf, stateOf } from '../lib/attendance.js';
import { loginOrFail } from '../lib/auth.js';

export const options = { vus: 1, iterations: 1 };

let report = null;

export default function () {
  const info = getTodayInfo(loginOrFail());
  locationOf(info);
  report = {
    date: info.date,
    hasShift: info.hasShift,
    isHoliday: info.isHoliday,
    shift: info.shift ? { name: info.shift.name, checkInTime: info.shift.checkInTime, checkOutTime: info.shift.checkOutTime, isOnline: info.shift.isOnline } : null,
    locations: info.locations.length,
    state: stateOf(info),
  };
  console.log(`Preflight: ${JSON.stringify(report)}`);
}

export function handleSummary(data) {
  return {
    stdout: `\nChecks đạt: ${data.metrics.checks ? data.metrics.checks.values.passes : 0}\n`,
    'results/preflight.json': JSON.stringify({ checks: data.metrics.checks ? data.metrics.checks.values : null }, null, 2),
  };
}
