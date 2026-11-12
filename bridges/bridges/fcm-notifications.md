# Bridge: FCM Push Notifications + In-App Notification

Tài liệu này mô tả toàn bộ flow push notification qua Firebase Cloud Messaging (FCM) và REST API để web/mobile tích hợp.

---

## Kiến trúc tổng quan

```
User check-in/check-out
  → AttendanceService emits event (attendance.checkin / attendance.checkout)
  → NotificationListener (async):
      ├─ Lưu Notification record vào DB
      ├─ Enqueue job vào BullMQ "fcm" queue
      └─ Gửi email nếu đi muộn (checkin.late)
  → FcmProcessor (worker):
      ├─ Lấy DeviceToken[] của employee từ DB
      ├─ Gọi Firebase Admin → sendToDevices()
      └─ Xoá token stale tự động
```

**Quan trọng:** FCM chỉ là tín hiệu đánh thức — client luôn phải fetch `/v1/notifications` hoặc `/v1/notifications/unread-count` để lấy dữ liệu thật. Không tin 100% vào FCM delivery.

---

## 1. Đăng ký Device Token

Sau khi user đăng nhập thành công, client lấy FCM token từ Firebase SDK rồi gọi:

```
POST /v1/device-tokens
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "token": "dKKjt5...<FCM registration token>",
  "platform": "WEB"          // WEB | ANDROID | IOS
}
```

**Response 201:**
```json
{ "success": true, "data": { "message": "Device token registered" } }
```

### Khi nào gọi?
- Sau `signIn` thành công
- Sau khi Firebase SDK refresh token (listener `onTokenRefresh`)
- App foreground lại sau thời gian dài

---

## 2. Huỷ đăng ký Device Token

Gọi khi user logout hoặc uninstall:

```
DELETE /v1/device-tokens?token=<FCM_TOKEN>
Authorization: Bearer <access_token>
```

**Response 200:**
```json
{ "success": true, "data": { "message": "Device token unregistered" } }
```

---

## 3. Nhận FCM Message (client-side)

Server gửi **data-only message** (không có `notification` field) để client tự kiểm soát hiển thị.

### Payload FCM data:
```json
{
  "type": "attendance.checkin",
  "notificationId": "42",
  "title": "Chấm công vào thành công",
  "body": "Bạn đã check-in lúc 08:32",
  "attendanceId": "123"
}
```

### Các loại `type` hiện tại:
| type | Trigger |
|------|---------|
| `attendance.checkin` | Employee check-in thành công |
| `attendance.checkout` | Employee check-out thành công |

### Web (Nuxt / Vue) — Firebase JS SDK:
```javascript
import { getMessaging, onMessage, getToken } from 'firebase/messaging'

const messaging = getMessaging()

// Foreground: app đang mở
onMessage(messaging, (payload) => {
  const { type, notificationId, title, body } = payload.data

  // Cập nhật badge/count ngay
  notificationStore.incrementUnread()

  // Hoặc fetch lại từ API để đảm bảo đúng
  notificationStore.fetchUnreadCount()

  // Hiển thị toast/snackbar
  showToast({ title, body })
})

// Background: app đang đóng → cần firebase-messaging-sw.js
// Trong service worker, handle 'push' event và hiện Notification API
```

**firebase-messaging-sw.js** (đặt ở public root):
```javascript
importScripts('https://www.gstatic.com/firebasejs/10.x.x/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.x.x/firebase-messaging-compat.js')

firebase.initializeApp({ /* config */ })
const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const { title, body, notificationId } = payload.data
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192x192.png',
    data: { notificationId },
  })
})
```

### Mobile (Flutter):
```dart
FirebaseMessaging.onMessage.listen((RemoteMessage message) {
  final data = message.data;
  final type = data['type'];
  final notificationId = data['notificationId'];

  // Foreground: hiện in-app notification bar
  _showInAppNotification(data['title'], data['body']);

  // Cập nhật badge
  ref.read(notificationProvider.notifier).fetchUnreadCount();
});

// Background / terminated → Flutter tự handle qua onBackgroundMessage
FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

// Khi user tap notification
FirebaseMessaging.onMessageOpenedApp.listen((message) {
  final notificationId = message.data['notificationId'];
  // Navigate đến màn hình liên quan
  _navigateFromNotification(message.data['type'], notificationId);
});
```

---

## 4. REST API — In-App Notifications

Dùng để hiện badge, danh sách thông báo, đánh dấu đọc.

### 4.1 Danh sách thông báo

```
GET /v1/notifications?page=1&limit=20
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 42,
      "type": "attendance.checkin",
      "title": "Chấm công vào thành công",
      "body": "Bạn đã check-in lúc 08:32",
      "payload": { "attendanceId": 123, "lateMinutes": 0 },
      "readAt": null,
      "createdAt": "2025-05-15T01:32:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

### 4.2 Số thông báo chưa đọc (badge)

```
GET /v1/notifications/unread-count
Authorization: Bearer <access_token>
```

**Response:**
```json
{ "success": true, "data": { "unreadCount": 3 } }
```

Poll endpoint này mỗi 30–60s khi app active, hoặc gọi ngay sau khi nhận FCM.

### 4.3 Đánh dấu một thông báo đã đọc

```
PATCH /v1/notifications/:id/read
Authorization: Bearer <access_token>
```

### 4.4 Đánh dấu tất cả đã đọc

```
PATCH /v1/notifications/read-all
Authorization: Bearer <access_token>
```

---

## 5. Environment Variables cần thêm (.env)

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

Lấy tại: **Firebase Console → Project Settings → Service Accounts → Generate new private key**

> **Lưu ý `FIREBASE_PRIVATE_KEY`:** copy toàn bộ JSON key, lấy field `private_key`, paste vào .env với dấu `"..."`. Các ký tự xuống dòng giữ nguyên dạng `\n` (không phải newline thật). Server sẽ tự `.replace(/\\n/g, '\n')`.

---

## 6. Cấu trúc file mới

```
src/
├── modules/
│   ├── firebase/
│   │   ├── firebase.module.ts        ← @Global, khởi tạo firebase-admin
│   │   └── firebase.service.ts       ← sendToDevice(), sendToDevices()
│   ├── device-tokens/
│   │   ├── device-tokens.module.ts
│   │   ├── device-tokens.controller.ts   ← POST/DELETE /device-tokens
│   │   ├── device-tokens.service.ts
│   │   ├── device-tokens.repository.ts
│   │   └── dto/register-device-token.dto.ts
│   └── notifications/
│       ├── notification.events.ts        ← AttendanceCheckinEvent, AttendanceCheckoutEvent
│       ├── notification.listener.ts      ← @OnEvent handlers → DB + queue
│       ├── notification.repository.ts    ← CRUD Notification table
│       ├── fcm.processor.ts              ← BullMQ worker gọi FirebaseService
│       ├── dto/query-notification.dto.ts
│       └── transformers/notification.transformer.ts
```

---

## 7. Thêm event type mới

Để thêm push cho leave.approved, leave.rejected, v.v.:

1. **Thêm event class** vào `notification.events.ts`:
```typescript
export class LeaveApprovedEvent {
  static readonly EVENT = 'leave.approved';
  employeeId: number;
  leaveId: number;
  startDate: Date;
  endDate: Date;
  totalDays: number;
}
```

2. **Emit từ LeaveService** sau khi approve:
```typescript
const event = new LeaveApprovedEvent();
event.employeeId = leave.employeeId;
// ...fill fields
this.eventEmitter.emit(LeaveApprovedEvent.EVENT, event);
```

3. **Thêm handler** trong `NotificationListener`:
```typescript
@OnEvent(LeaveApprovedEvent.EVENT, { async: true })
async handleLeaveApproved(event: LeaveApprovedEvent) {
  // tương tự handleCheckin
}
```
