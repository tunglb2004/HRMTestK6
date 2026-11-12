// Doc bien moi truong dung chung. Thieu bien bat buoc thi dung ngay, khong doan gia tri.
function required(name) {
  const value = __ENV[name];
  if (!value) {
    throw new Error(`Thiếu ${name}. Nạp .env bằng run.ps1 hoặc truyền -e ${name}=...`);
  }
  return value;
}

export const BASE_URL = required('HRM_BASE_URL').replace(/\/+$/, '');

// Tai khoan cua cac bai 1 tai khoan (smoke, login, cham cong 1 nguoi): HRM_EMAIL trong .env.
// Bai nhieu tai khoan doc ACCOUNTS_FILE qua lib/accounts.js.
export const EMAIL = required('HRM_EMAIL');
export const PASSWORD = required('HRM_PASSWORD');

// Bai co tao tai hoac ghi du lieu goi ham nay trong setup().
export function requireRunPermission() {
  if (__ENV.CONFIRM_ALLOWED !== 'yes') {
    throw new Error('Chưa xác nhận được phép chạy. Đặt CONFIRM_ALLOWED=yes khi chủ môi trường đã đồng ý.');
  }
}

// Doc bien tai bat buoc cua rieng tung bai.
export function requiredEnv(name) {
  return required(name);
}
