# Bridge Docs — Địa điểm chấm công (`/v1/check-in-locations`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.  
> Xem [attendance-overview.md](./attendance-overview.md) để hiểu big picture.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/check-in-locations` | `ADMIN`, `HR` | Danh sách tất cả địa điểm |
| GET | `/v1/check-in-locations/me` | `EMPLOYEE` | Danh sách địa điểm được gán cho tôi |
| POST | `/v1/check-in-locations` | `ADMIN`, `HR` | Tạo địa điểm mới |
| GET | `/v1/check-in-locations/:id` | `ADMIN`, `HR` | Chi tiết một địa điểm |
| PATCH | `/v1/check-in-locations/:id` | `ADMIN`, `HR` | Cập nhật địa điểm |
| DELETE | `/v1/check-in-locations/:id` | `ADMIN`, `HR` | Vô hiệu hóa — soft delete (`isActive = false`) |
| POST | `/v1/check-in-locations/:id/employees/:employeeId` | `ADMIN`, `HR` | Gán nhân viên vào địa điểm |
| DELETE | `/v1/check-in-locations/:id/employees/:employeeId` | `ADMIN`, `HR` | Bỏ gán nhân viên khỏi địa điểm |

> **Lưu ý thứ tự route:** `/check-in-locations/me` được khai báo **trước** `/:id` trong controller.  
> Nếu gọi `/me` mà server trả 404, kiểm tra lại thứ tự route phía client.

---

## TypeScript Types

```typescript
// types/check-in-location.types.ts

// Dùng cho tất cả GET response — GET /, GET /me, GET /:id đều trả về cùng shape
export interface CheckInLocationResponse {
  id: number;
  name: string;
  latitude: number;        // số thực (float), vĩ độ
  longitude: number;       // số thực (float), kinh độ
  radiusMeters: number;    // integer, bán kính chấp nhận (mét), min 10 – max 5000
  isActive: boolean;
  createdAt: string;       // ISO 8601 full datetime
}

export interface CreateCheckInLocationDto {
  name: string;            // min 2 ký tự
  latitude: number;        // số thực
  longitude: number;       // số thực
  radiusMeters: number;    // integer, min 10 – max 5000
}

export type UpdateCheckInLocationDto = Partial<CreateCheckInLocationDto>;
```

---

## GET /v1/check-in-locations — Danh sách tất cả địa điểm

Chỉ `ADMIN` và `HR` được gọi.

**Response:** `ApiSuccess<CheckInLocationResponse[]>`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Văn phòng Hà Nội",
      "latitude": 21.0285,
      "longitude": 105.8542,
      "radiusMeters": 100,
      "isActive": true,
      "createdAt": "2026-01-15T00:00:00.000Z"
    },
    {
      "id": 2,
      "name": "Chi nhánh TP.HCM",
      "latitude": 10.7769,
      "longitude": 106.7009,
      "radiusMeters": 150,
      "isActive": true,
      "createdAt": "2026-02-01T00:00:00.000Z"
    }
  ]
}
```

**403** nếu không phải HR hoặc ADMIN:
```json
{ "success": false, "error": { "code": "FORBIDDEN", "message": "Forbidden resource" } }
```

---

## GET /v1/check-in-locations/me — Địa điểm được gán cho tôi

Chỉ `EMPLOYEE` được gọi. Lấy user từ JWT — không cần truyền id.

Dùng để hiển thị "bạn được phép check-in ở đâu" trên mobile trước khi gửi GPS.

**Response:** `ApiSuccess<CheckInLocationResponse[]>`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Văn phòng Hà Nội",
      "latitude": 21.0285,
      "longitude": 105.8542,
      "radiusMeters": 100,
      "isActive": true,
      "createdAt": "2026-01-15T00:00:00.000Z"
    }
  ]
}
```

> Nếu nhân viên chưa được gán địa điểm nào → server trả `data: []`.  
> Khi đó mọi lần check-in sẽ thất bại với `NO_VALID_LOCATION`.

---

## POST /v1/check-in-locations — Tạo địa điểm mới

**Request body:**
```json
{
  "name": "Văn phòng Hà Nội",
  "latitude": 21.0285,
  "longitude": 105.8542,
  "radiusMeters": 100
}
```

**Response 201:** `ApiSuccess<CheckInLocationResponse>`

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Văn phòng Hà Nội",
    "latitude": 21.0285,
    "longitude": 105.8542,
    "radiusMeters": 100,
    "isActive": true,
    "createdAt": "2026-05-18T07:00:00.000Z"
  }
}
```

**400** nếu `radiusMeters` ngoài [10, 5000]:
```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "radiusMeters must not be less than 10" } }
```

---

## GET /v1/check-in-locations/:id — Chi tiết địa điểm

**Response:** `ApiSuccess<CheckInLocationResponse>` — shape giống `/me`

**404:**
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Địa điểm không tồn tại" } }
```

---

## PATCH /v1/check-in-locations/:id — Cập nhật địa điểm

Tất cả fields optional.

**Request body mẫu:**
```json
{
  "name": "Văn phòng Hà Nội (tòa nhà mới)",
  "latitude": 21.0291,
  "longitude": 105.8535,
  "radiusMeters": 120
}
```

**Response 200:** `ApiSuccess<CheckInLocationResponse>` (shape đầy đủ)

---

## DELETE /v1/check-in-locations/:id — Vô hiệu hóa địa điểm

Soft delete — chỉ set `isActive = false`, không xóa dữ liệu.  
Địa điểm đang có nhân viên gán vẫn bị vô hiệu hóa — nhân viên sẽ không thể check-in vào địa điểm này nữa.

**Response: 204 No Content**

---

## POST /v1/check-in-locations/:id/employees/:employeeId — Gán nhân viên

Không cần request body. ID địa điểm và nhân viên đều truyền qua path params.

**Response: 201 No Content**

**409** nếu nhân viên đã được gán vào địa điểm này:
```json
{ "success": false, "error": { "code": "CONFLICT", "message": "Nhân viên đã được gán vào địa điểm này" } }
```

**404** nếu địa điểm hoặc nhân viên không tồn tại:
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Địa điểm hoặc nhân viên không tồn tại" } }
```

---

## DELETE /v1/check-in-locations/:id/employees/:employeeId — Bỏ gán nhân viên

Không cần request body.

**Response: 204 No Content**

**404** nếu nhân viên không thuộc địa điểm này:
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Địa điểm hoặc nhân viên không thuộc địa điểm này" } }
```

---

## Lưu ý khi dùng với Leaflet map

| Thứ | Leaflet | API |
|-----|---------|-----|
| Tọa độ truyền vào | `[lat, lng]` — array, vĩ độ trước | `{ latitude, longitude }` — object |
| Tọa độ nhận về | `{ lat, lng }` — object | `{ latitude, longitude }` — object |
| Radius | `L.circle(latlng, { radius })` — đơn vị mét | `radiusMeters` — dùng trực tiếp |

**Render vùng check-in với Leaflet:**
```typescript
locations.forEach(loc => {
  // ✅ Đúng — Leaflet nhận [lat, lng] array
  L.circle([loc.latitude, loc.longitude], {
    radius: loc.radiusMeters,   // mét — dùng thẳng, không cần đổi đơn vị
    color: '#3b82f6',
    fillOpacity: 0.2,
  }).addTo(map).bindPopup(loc.name);
});
```

```typescript
// ❌ Sai — Leaflet 1.x không nhận object cho tọa độ
L.circle({ lat: loc.latitude, lng: loc.longitude }, { radius: loc.radiusMeters });
```

**Dùng GET /me trên mobile:**  
Gọi `/me` khi khởi động app để biết nhân viên được phép check-in ở đâu.  
Hiển thị danh sách địa điểm trên bản đồ với vòng tròn `radiusMeters`.  
Trước khi gửi GPS lên server, tính khoảng cách từ vị trí hiện tại đến từng địa điểm — nếu không có địa điểm nào trong phạm vi, nên thông báo trước để tránh round-trip không cần thiết.

---

## Composable — useCheckInLocations

```typescript
// composables/useCheckInLocations.ts
import type {
  CheckInLocationResponse,
  CreateCheckInLocationDto,
  UpdateCheckInLocationDto,
} from '~/types/check-in-location.types';

export function useCheckInLocations() {
  const { get, post, patch, del } = useFetch();

  const fetchLocations = () =>
    get<CheckInLocationResponse[]>('/v1/check-in-locations');

  const fetchMyLocations = () =>
    get<CheckInLocationResponse[]>('/v1/check-in-locations/me');

  const fetchLocation = (id: number) =>
    get<CheckInLocationResponse>(`/v1/check-in-locations/${id}`);

  const createLocation = (dto: CreateCheckInLocationDto) =>
    post<CheckInLocationResponse>('/v1/check-in-locations', dto);

  const updateLocation = (id: number, dto: UpdateCheckInLocationDto) =>
    patch<CheckInLocationResponse>(`/v1/check-in-locations/${id}`, dto);

  const deactivateLocation = (id: number) =>
    del(`/v1/check-in-locations/${id}`);

  const assignEmployee = (locationId: number, employeeId: number) =>
    post<void>(`/v1/check-in-locations/${locationId}/employees/${employeeId}`);

  const removeEmployee = (locationId: number, employeeId: number) =>
    del(`/v1/check-in-locations/${locationId}/employees/${employeeId}`);

  return {
    fetchLocations,
    fetchMyLocations,
    fetchLocation,
    createLocation,
    updateLocation,
    deactivateLocation,
    assignEmployee,
    removeEmployee,
  };
}
```

---

## Edge cases

| Tình huống | Kết quả |
|-----------|---------|
| `EMPLOYEE` gọi `GET /check-in-locations` | 403 Forbidden |
| `HR`/`ADMIN` gọi `GET /check-in-locations/me` | 403 Forbidden — endpoint chỉ cho `EMPLOYEE` |
| Gán nhân viên đã được gán vào cùng địa điểm | 409 Conflict |
| `DELETE /:id` khi địa điểm đang có nhân viên gán | 204 OK — soft delete vẫn thực hiện, chỉ set `isActive = false` |
| `radiusMeters < 10` | 400 Bad Request |
| `radiusMeters > 5000` | 400 Bad Request |
| `latitude`/`longitude` không phải number | 400 Bad Request |
| Employee chưa được gán location nào → `GET /me` | 200 OK với `data: []` — check-in sẽ fail `NO_VALID_LOCATION` |
| Địa điểm đã `isActive: false` → employee check-in vào đó | Thất bại — server bỏ qua địa điểm inactive khi validate |
