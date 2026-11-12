// Goi check-in, check-out (multipart: photo, latitude, longitude) va doc trang thai hom nay.
import http from 'k6/http';
import { Counter } from 'k6/metrics';
import { BASE_URL } from '../config/env.js';
import { dataOf, errorOf, record } from './assertions.js';

export const CHECKIN_NAME = 'POST /v1/attendance/check-in';
export const CHECKOUT_NAME = 'POST /v1/attendance/check-out';

// Don vi: theo lan doi soat bi sai. Nguong luon la 0.
export const dataIntegrityErrors = new Counter('data_integrity_errors');
// Don vi: theo request tra ma thanh cong.
export const attendanceSuccess = new Counter('attendance_success_count');

// Rule nghiep vu: moi nguoi chi duoc gui check-in toi da 5 lan va check-out toi da 5 lan moi ngay,
// tinh ca lan bi tu choi; tu lan thu 6 server tra 429.
export const MAX_ATTEMPTS_PER_DAY = 5;
// Don vi: theo request server xu ly (khong phai 429, khong mat ket noi). Bai 1 tai khoan dat nguong <= 5.
const notLimited = {
  checkin: new Counter('checkin_not_limited'),
  checkout: new Counter('checkout_not_limited'),
};

// Threshold kiem tra rule 5 lan/ngay cho bai gui nhieu lan tren cung 1 tai khoan.
export function attemptLimitThresholds(actions) {
  const result = {};
  for (const action of actions) {
    result[`${action}_not_limited`] = [`count<=${MAX_ATTEMPTS_PER_DAY}`];
  }
  return result;
}

const photo = open('../data/selfie-500kb.jpg', 'b');

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

export function getTodayInfo(token) {
  const res = http.get(`${BASE_URL}/v1/attendance/today-info`, {
    headers: authHeaders(token),
    tags: { name: 'GET /v1/attendance/today-info', api: 'today-info' },
  });
  const info = dataOf(res);
  if (!info) {
    throw new Error(`Không đọc được today-info, HTTP ${res.status}.`);
  }
  return info;
}

export function locationOf(info) {
  const location = info.locations && info.locations[0];
  if (!location) {
    throw new Error('Tài khoản chưa được gán địa điểm chấm công.');
  }
  return { latitude: location.latitude, longitude: location.longitude };
}

// So ban ghi cham cong cua tai khoan trong 1 ngay, de phat hien ghi trung. Ngay dang YYYY-MM-DD.
export function recordCountOfDay(token, date) {
  const res = http.get(`${BASE_URL}/v1/attendance/me?fromDate=${date}&toDate=${date}`, {
    headers: authHeaders(token),
    tags: { name: 'GET /v1/attendance/me', api: 'attendance-me' },
  });
  const data = dataOf(res);
  if (!data) {
    throw new Error(`Không đọc được lịch sử chấm công, HTTP ${res.status}.`);
  }
  const items = Array.isArray(data) ? data : (data.items || data.data || []);
  return items.filter((item) => String(item.date).slice(0, 10) === date).length;
}

// Server cho check-out khi chua check-in (missingType MISSING_CHECKIN), nen co checkOutAt la da check-out.
export function stateOf(info) {
  const record_ = info.todayRecord;
  if (record_ && record_.checkOutAt) return 'checkedOut';
  return record_ && record_.checkInAt ? 'checkedIn' : 'notCheckedIn';
}

// Sai trang thai dau thi dung han, khong chay tiep tren du lieu sai. expected la 1 trang thai hoac danh sach.
export function assertState(info, expected) {
  if (!info.hasShift) {
    throw new Error('Tài khoản không có ca hôm nay.');
  }
  const allowed = [].concat(expected);
  const actual = stateOf(info);
  if (!allowed.includes(actual)) {
    throw new Error(`Trạng thái đầu là ${actual}, bài này cần ${allowed.join(' hoặc ')}.`);
  }
}

// Trang thai dau hop le cua bai check-out: da check-in, hoac chua check-in vi server van nhan check-out.
export const BEFORE_CHECKOUT = ['checkedIn', 'notCheckedIn'];

function send(path, name, api, token, location, expected, extraTags) {
  const body = {
    photo: http.file(photo, 'selfie.jpg', 'image/jpeg'),
    latitude: String(location.latitude),
    longitude: String(location.longitude),
  };
  const res = http.post(`${BASE_URL}${path}`, body, {
    headers: authHeaders(token),
    tags: { name, api, ...extraTags },
    responseCallback: http.expectedStatuses(...expected),
  });
  if (!record(res, expected, extraTags)) {
    console.warn(`${name}: HTTP ${res.status} ${errorOf(res)}`);
  }
  if (res.status !== 0 && res.status !== 429) {
    notLimited[api].add(1, extraTags);
  }
  return res;
}

export function checkIn(token, location, expected = [201], extraTags = {}) {
  return send('/v1/attendance/check-in', CHECKIN_NAME, 'checkin', token, location, expected, extraTags);
}

export function checkOut(token, location, expected = [200], extraTags = {}) {
  return send('/v1/attendance/check-out', CHECKOUT_NAME, 'checkout', token, location, expected, extraTags);
}
