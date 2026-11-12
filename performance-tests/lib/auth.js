// Goi POST /v1/auth/login. Khong log mat khau va token.
import http from 'k6/http';
import { BASE_URL, EMAIL, PASSWORD } from '../config/env.js';
import { checkEnvelope, dataOf, record } from './assertions.js';

export const LOGIN_NAME = 'POST /v1/auth/login';

export function login(identifier = EMAIL, password = PASSWORD, extraTags = {}) {
  const res = http.post(
    `${BASE_URL}/v1/auth/login`,
    JSON.stringify({ identifier, password }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: LOGIN_NAME, api: 'login', ...extraTags },
    },
  );
  record(res, [200], extraTags);
  checkEnvelope(res, 200, 'login');
  const data = dataOf(res);
  return data && data.accessToken ? data.accessToken : null;
}

// Dung trong setup(): dang nhap that bai thi dung han, tranh lap lai lam tang bo dem khoa tai khoan.
export function loginOrFail() {
  console.info(`Tài khoản: ${EMAIL} (HRM_EMAIL)`);
  const token = login();
  if (!token) {
    throw new Error('Đăng nhập thất bại, dừng bài test.');
  }
  return token;
}
