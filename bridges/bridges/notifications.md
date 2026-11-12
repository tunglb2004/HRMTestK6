# Bridge Docs — Notification Center (`/v1/notifications`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

Notification Center lưu mọi sự kiện (chấm công, nghỉ phép, OT, vi phạm) vào DB và đẩy FCM song song.  
Khác với email notifications — đây là **in-app + push**, không phải email.

---

## Endpoints

| Method | Path | Ghi chú |
|--------|------|---------|
| GET | `/v1/notifications` | Danh sách của tôi, hỗ trợ lọc theo `category` |
| GET | `/v1/notifications/unread-count` | Số chưa đọc theo từng category (dùng cho badge) |
| PATCH | `/v1/notifications/read-all` | Đánh dấu tất cả đã đọc; truyền `?category=` để giới hạn |
| PATCH | `/v1/notifications/:id/read` | Đánh dấu một thông báo đã đọc |
| DELETE | `/v1/notifications` | Xóa tất cả; truyền `?category=` để xóa một category |

> **Lưu ý thứ tự route:** `/notifications/unread-count` và `/notifications/read-all` được khai báo **trước** `/notifications/:id/read` trong controller.  
> Nếu `PATCH /notifications/read-all` trả 404, kiểm tra thứ tự route của router phía client.

Tất cả endpoints yêu cầu `Authorization: Bearer <access-token>`. Mỗi user chỉ đọc/ghi được thông báo của chính mình — không có endpoint admin.

---

## TypeScript Types

```typescript
// types/notification.types.ts

export type NotificationCategory = 'EVENT' | 'ATTENDANCE' | 'LEAVE';

export type NotificationType =
  | 'CHECK_IN'
  | 'CHECK_OUT'
  | 'LATE'
  | 'ABSENT'
  | 'MISSING_CHECKOUT'
  | 'LEAVE_CREATED'
  | 'LEAVE_APPROVED'
  | 'LEAVE_REJECTED'
  | 'LEAVE_CANCELLED'
  | 'LEAVE_AUTO_CANCELLED'
  | 'OT_CREATED'
  | 'OT_APPROVED'
  | 'OT_REJECTED'
  | 'OT_CANCELLED'
  | 'OT_AUTO_CANCELLED'
  | 'VIOLATION_CREATED'
  | 'VIOLATION_APPROVED'
  | 'VIOLATION_REJECTED';

export interface NotificationResponse {
  id: number;
  title: string;
  body: string;
  category: NotificationCategory;
  type: NotificationType;
  refId: number | null;       // ID của entity liên quan — null nếu không có navigation
  refType: string | null;     // 'leave_request' | 'overtime_request' | 'violation_request' | null
  isRead: boolean;
  createdAt: string;          // ISO 8601
}

export interface UnreadCountResponse {
  total: number;              // tổng tất cả category
  event: number;              // category EVENT
  attendance: number;         // category ATTENDANCE
  leave: number;              // category LEAVE
}

export interface QueryNotificationsParams {
  page?: number;              // default 1
  limit?: number;             // default 20, max 100
  category?: NotificationCategory;
}
```

---

## Category Mapping

| Category | Các type thuộc về |
|----------|-------------------|
| `EVENT` | `OT_CREATED`, `OT_APPROVED`, `OT_REJECTED`, `OT_CANCELLED`, `OT_AUTO_CANCELLED`, `VIOLATION_CREATED`, `VIOLATION_APPROVED`, `VIOLATION_REJECTED` |
| `ATTENDANCE` | `CHECK_IN`, `CHECK_OUT`, `LATE`, `ABSENT`, `MISSING_CHECKOUT` |
| `LEAVE` | `LEAVE_CREATED`, `LEAVE_APPROVED`, `LEAVE_REJECTED`, `LEAVE_CANCELLED`, `LEAVE_AUTO_CANCELLED` |

---

## Navigation — refType + refId

Khi user tap vào notification, dùng `refType` + `refId` để navigate:

| refType | Route | Ghi chú |
|---------|-------|---------|
| `leave_request` | `/leave/:refId` | Áp dụng cho `LEAVE_CREATED/APPROVED/REJECTED/CANCELLED` |
| `overtime_request` | `/overtime/:refId` | Áp dụng cho `OT_CREATED/APPROVED/REJECTED/AUTO_CANCELLED` |
| `violation_request` | `/violation/:refId` | Áp dụng cho `VIOLATION_APPROVED/REJECTED` |
| `null` | _(không navigate)_ | Tất cả type thuộc `ATTENDANCE` — `CHECK_IN`, `CHECK_OUT`, `LATE`, `ABSENT`, `MISSING_CHECKOUT` |

```typescript
function navigateFromNotification(notification: NotificationResponse, router: Router) {
  const { refType, refId } = notification;
  if (!refType || refId === null) return; // attendance types — informational only

  const routes: Record<string, string> = {
    leave_request: `/leave/${refId}`,
    overtime_request: `/overtime/${refId}`,
    violation_request: `/violation/${refId}`,
  };

  const route = routes[refType];
  if (route) router.push(route);
}
```

---

## GET /v1/notifications — Danh sách thông báo

**Query params:** `?page=1&limit=20&category=LEAVE`

**Response:** envelope bọc `data` array + `meta` mở rộng (có thêm `unreadCount`)

```json
{
  "success": true,
  "data": [
    {
      "id": 101,
      "title": "Đơn nghỉ phép được duyệt ✅",
      "body": "Đơn Nghỉ phép năm ngày 03/06/2026 đã được duyệt",
      "category": "LEAVE",
      "type": "LEAVE_APPROVED",
      "refId": 55,
      "refType": "leave_request",
      "isRead": false,
      "createdAt": "2026-06-03T04:12:00.000Z"
    },
    {
      "id": 98,
      "title": "Check-in thành công!",
      "body": "Bạn đã check-in lúc 08:27 tại Văn phòng",
      "category": "ATTENDANCE",
      "type": "CHECK_IN",
      "refId": null,
      "refType": null,
      "isRead": true,
      "createdAt": "2026-06-03T01:27:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3,
    "unreadCount": 7
  }
}
```

> **Lưu ý `meta.unreadCount`:** luôn là tổng toàn bộ thông báo chưa đọc của user, **không** bị ảnh hưởng bởi `?category=`. Dùng giá trị này để cập nhật badge bell icon khi đang xem list.

---

## GET /v1/notifications/unread-count — Badge count

```json
{
  "success": true,
  "data": {
    "total": 7,
    "event": 2,
    "attendance": 3,
    "leave": 2
  }
}
```

**Gọi khi nào:**
- Mở app (sau khi đăng nhập thành công)
- Mở notification center
- Sau khi `PATCH /:id/read` hoặc `PATCH /read-all`
- Khi nhận FCM push (để sync badge)

---

## PATCH /v1/notifications/read-all

- Không có body.
- Không có `?category=` → đánh dấu tất cả đã đọc.
- Có `?category=LEAVE` → chỉ đánh dấu category LEAVE đã đọc.
- **Response: 204 No Content** (không có body).

## PATCH /v1/notifications/:id/read

- Chỉ đánh dấu notification của chính mình. Notification của người khác bị silently ignored (không 403).
- **Response: 204 No Content**.

## DELETE /v1/notifications

- Không có `?category=` → xóa tất cả của mình.
- Có `?category=ATTENDANCE` → chỉ xóa ATTENDANCE.
- **Response: 204 No Content**.

---

## Composable — useNotifications

```typescript
// composables/useNotifications.ts
import type {
  NotificationResponse,
  UnreadCountResponse,
  QueryNotificationsParams,
  NotificationCategory,
} from '~/types/notification.types';

export function useNotifications() {
  const { get, patch, del } = useFetch();

  const fetchNotifications = (params?: QueryNotificationsParams) =>
    get<{ data: NotificationResponse[]; meta: { page: number; limit: number; total: number; totalPages: number; unreadCount: number } }>(
      '/v1/notifications',
      { params },
    );

  const fetchUnreadCount = () =>
    get<UnreadCountResponse>('/v1/notifications/unread-count');

  const markAsRead = (id: number) =>
    patch<void>(`/v1/notifications/${id}/read`);

  const markAllAsRead = (category?: NotificationCategory) =>
    patch<void>('/v1/notifications/read-all', undefined, { params: category ? { category } : {} });

  const deleteAll = (category?: NotificationCategory) =>
    del<void>('/v1/notifications', { params: category ? { category } : {} });

  return {
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteAll,
  };
}
```

---

## FCM Push Payload

Khi tạo notification, server đồng thời gửi FCM data message đến tất cả device token của employee. Payload FCM nhận được (tất cả là `string`):

```typescript
interface FcmNotificationPayload {
  type: string;           // NotificationType, ví dụ "LEAVE_APPROVED"
  notificationId: string; // ID trong DB, dùng để mark read
  title: string;
  body: string;
  refId: string;          // "" nếu không có
  refType: string;        // "" nếu không có
}
```

Khi nhận FCM:
1. Hiển thị local notification từ `title` + `body`.
2. Gọi `GET /notifications/unread-count` để cập nhật badge.
3. Khi user tap → parse `refType` + `refId` để navigate (xem bảng Navigation ở trên).

---

## Edge Cases

| Tình huống | Kết quả |
|-----------|---------|
| `DELETE /notifications` không có `?category=` | Xóa **toàn bộ** thông báo của mình |
| `DELETE /notifications?category=ATTENDANCE` | Chỉ xóa ATTENDANCE, EVENT + LEAVE giữ nguyên |
| `PATCH /read-all?category=LEAVE` | Chỉ mark LEAVE đã đọc |
| Employee chưa đăng ký device token | Notification vẫn lưu DB, FCM bị skip — không có lỗi |
| FCM token hết hạn / invalid | Server tự xóa token khỏi DB sau khi Firebase báo lỗi |
| Notification > 90 ngày | Tự động xóa mỗi Chủ nhật 02:00 (cron `OvertimeCronService`) |
| `PATCH /:id/read` với id của người khác | 204 nhưng không có gì thay đổi (silently ignored) |
| `meta.unreadCount` khi lọc `?category=LEAVE` | Vẫn trả tổng toàn bộ unread (không phải chỉ LEAVE) — dùng cho bell badge |
| Type `ABSENT`, `LEAVE_AUTO_CANCELLED`, `OT_CANCELLED`, `VIOLATION_CREATED` | Có trong enum, chưa có factory — reserved cho tính năng tương lai |
