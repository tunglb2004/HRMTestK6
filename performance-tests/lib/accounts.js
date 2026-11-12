// Doc danh sach tai khoan tu CSV 2 cot email,password. File that nam ngoai project, khong commit.
import { SharedArray } from 'k6/data';
import { requiredEnv } from '../config/env.js';

const accountsFile = requiredEnv('ACCOUNTS_FILE');

export const accounts = new SharedArray('accounts', () => open(accountsFile)
  .split(/\r?\n/)
  .slice(1)
  .filter((line) => line.trim())
  .map((line) => {
    const [email, password] = line.split(',');
    return { email: email.trim(), password: password.trim() };
  }));

export function requireAccounts(count) {
  if (accounts.length < count) {
    throw new Error(`Cần ${count} tài khoản, file chỉ có ${accounts.length}.`);
  }
}
