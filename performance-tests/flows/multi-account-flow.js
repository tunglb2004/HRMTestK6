// Luong cham cong nhieu tai khoan. Dung cho PERF-015, PERF-016, PERF-017, PERF-018.
import { Trend } from 'k6/metrics';
import { BEFORE_CHECKOUT, getTodayInfo, locationOf, stateOf } from '../lib/attendance.js';
import { login } from '../lib/auth.js';
import { checkInStep, checkOutStep } from './attendance-flow.js';

const flowTotal = new Trend('flow_login_to_attendance_ms', true);

export const ACTIONS = {
  checkin: { state: 'notCheckedIn', after: 'checkedIn', status: 201, send: checkInStep },
  // Check-out duoc ghi de gio nen tai khoan da check-out van gui lai duoc (toi da 5 lan/ngay).
  checkout: { state: [...BEFORE_CHECKOUT, 'checkedOut'], after: 'checkedOut', status: 200, send: checkOutStep },
};

// Dang nhap va doc dia diem truoc, tra ve du lieu de gui dong loat. Sai trang thai dau thi dung han.
export function prepareUser(account, action) {
  const token = login(account.email, account.password);
  if (!token) {
    throw new Error(`Đăng nhập thất bại: ${account.email}`);
  }
  const info = getTodayInfo(token);
  if (!info.hasShift || ![].concat(action.state).includes(stateOf(info))) {
    throw new Error(`Trạng thái đầu sai: ${account.email}, ${stateOf(info)}, hasShift=${info.hasShift}`);
  }
  return { token, location: locationOf(info) };
}

// Mot nguoi that: login → doc thong tin hom nay → cham cong, tinh tong thoi gian ca luong.
export function fullUserFlow(account, action) {
  const started = Date.now();
  const token = login(account.email, account.password);
  if (!token) return false;
  const res = action.send(token, locationOf(getTodayInfo(token)), [action.status]);
  if (res.status !== action.status) return false;
  flowTotal.add(Date.now() - started);
  return true;
}
