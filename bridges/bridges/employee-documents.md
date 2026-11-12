# Bridge Docs — Tài liệu nhân viên (`/v1/employees/:id/documents`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/employees/me/documents` | Mọi user đã đăng nhập | Tài liệu của chính mình |
| GET | `/v1/employees/:id/documents` | `HR`, `ADMIN`, `MANAGER` | Tài liệu của một nhân viên |
| POST | `/v1/employees/:id/documents` | `HR`, `ADMIN` | Upload tài liệu (`multipart/form-data`) |
| DELETE | `/v1/employees/:employeeId/documents/:documentId` | `HR`, `ADMIN` | Xóa tài liệu |
| GET | `/v1/employees/:employeeId/documents/:documentId/url` | Mọi user đã đăng nhập | Lấy presigned URL để xem/download |

> **Lưu ý thứ tự route:** `/employees/me/documents` được khai báo **trước** `/employees/:id/documents` trong controller.  
> Nếu gọi `/employees/me/documents` mà server trả lỗi parse int cho `"me"`, kiểm tra lại thứ tự route của router phía client.

---

## TypeScript Types

```typescript
// types/employee-document.types.ts

export type DocumentType = 'ID_CARD' | 'CONTRACT' | 'OTHER';

export interface EmployeeDocumentResponse {
  id: number;
  type: DocumentType;
  typeLabel: string;       // 'CCCD / Hộ chiếu' | 'Hợp đồng lao động' | 'Tài liệu khác'
  fileName: string;        // tên file gốc khi upload
  fileUrl: string;         // S3 URL gốc — KHÔNG render trực tiếp, dùng presigned URL endpoint
  fileType: string;        // phần mở rộng detect từ fileName: 'pdf' | 'docx' | 'jpg' | 'png'
  uploadedAt: string;      // ISO 8601 full datetime
}

export interface UploadDocumentPayload {
  file: File;              // PDF, DOCX, JPG, PNG — tối đa 10MB
  type: DocumentType;
}
```

**`typeLabel` mapping cố định từ server:**

| `type` | `typeLabel` |
|--------|-------------|
| `ID_CARD` | `CCCD / Hộ chiếu` |
| `CONTRACT` | `Hợp đồng lao động` |
| `OTHER` | `Tài liệu khác` |

---

## GET /v1/employees/me/documents — Tài liệu của tôi

Không cần truyền id — lấy từ JWT. Mọi user đã đăng nhập đều gọi được.

**Response:** `ApiSuccess<EmployeeDocumentResponse[]>`

```json
{
  "success": true,
  "data": [
    {
      "id": 3,
      "type": "CONTRACT",
      "typeLabel": "Hợp đồng lao động",
      "fileName": "hop-dong-2024.pdf",
      "fileUrl": "https://hr-documents.s3.ap-southeast-1.amazonaws.com/employees/4/documents/uuid.pdf",
      "fileType": "pdf",
      "uploadedAt": "2026-05-15T08:00:00.000Z"
    },
    {
      "id": 1,
      "type": "ID_CARD",
      "typeLabel": "CCCD / Hộ chiếu",
      "fileName": "cccd-front.jpg",
      "fileUrl": "https://hr-documents.s3.ap-southeast-1.amazonaws.com/employees/4/documents/uuid.jpg",
      "fileType": "jpg",
      "uploadedAt": "2026-04-01T03:00:00.000Z"
    }
  ]
}
```

> Danh sách được sắp xếp theo `uploadedAt` giảm dần (mới nhất trước).

---

## GET /v1/employees/:id/documents — Tài liệu của một nhân viên

Chỉ `HR`, `ADMIN`, `MANAGER` mới gọi được. Shape response giống `/me/documents`.

**Response:** `ApiSuccess<EmployeeDocumentResponse[]>`

**404** nếu nhân viên không tồn tại:
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Nhân viên không tồn tại" } }
```

**403** nếu `EMPLOYEE` gọi endpoint này:
```json
{ "success": false, "error": { "code": "FORBIDDEN", "message": "Forbidden resource" } }
```

---

## POST /v1/employees/:id/documents — Upload tài liệu

**Content-Type:** `multipart/form-data`

**Form fields:**

| Field | Type | Bắt buộc | Ghi chú |
|-------|------|----------|---------|
| `file` | `File` | ✅ | PDF, DOCX, JPG, PNG — tối đa 10MB |
| `type` | `DocumentType` | ✅ | `'ID_CARD'` \| `'CONTRACT'` \| `'OTHER'` |

**Ví dụ (browser FormData):**
```typescript
const formData = new FormData();
formData.append('file', selectedFile);
formData.append('type', 'CONTRACT');

await $fetch(`/v1/employees/${employeeId}/documents`, {
  method: 'POST',
  body: formData,
  // KHÔNG set Content-Type — để browser tự set boundary
});
```

**Response 201:** `ApiSuccess<EmployeeDocumentResponse>`

```json
{
  "success": true,
  "data": {
    "id": 4,
    "type": "CONTRACT",
    "typeLabel": "Hợp đồng lao động",
    "fileName": "hop-dong-2025.pdf",
    "fileUrl": "https://hr-documents.s3.ap-southeast-1.amazonaws.com/employees/4/documents/uuid.pdf",
    "fileType": "pdf",
    "uploadedAt": "2026-05-20T09:00:00.000Z"
  }
}
```

---

## DELETE /v1/employees/:employeeId/documents/:documentId — Xóa tài liệu

**Response: 204 No Content**

**404** nếu tài liệu không tồn tại:
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Tài liệu không tồn tại" } }
```

---

## GET /v1/employees/:employeeId/documents/:documentId/url — Lấy presigned URL

URL có hiệu lực **1 giờ** từ thời điểm gọi. Gọi lại để gia hạn.

**Response:** `ApiSuccess<{ presignedUrl: string }>`

```json
{
  "success": true,
  "data": {
    "presignedUrl": "https://hr-documents.s3.ap-southeast-1.amazonaws.com/employees/4/documents/uuid.pdf?X-Amz-Algorithm=...&X-Amz-Expires=3600&X-Amz-Signature=..."
  }
}
```

**Cách dùng presigned URL:**

```typescript
// ✅ Đúng — lấy presigned URL trước khi hiển thị
const { data } = await $fetch(`/v1/employees/${empId}/documents/${docId}/url`);
window.open(data.presignedUrl, '_blank');

// ❌ Sai — fileUrl trong EmployeeDocumentResponse là S3 URL gốc, không có auth
// window.open(doc.fileUrl, '_blank'); // sẽ bị 403 từ S3
```

> **PDF mở inline trong browser** — server upload với `Content-Disposition: inline` cho file PDF, `attachment` cho DOCX/JPG/PNG.

---

## Composable — useEmployeeDocuments

```typescript
// composables/useEmployeeDocuments.ts
import type {
  EmployeeDocumentResponse,
  DocumentType,
} from '~/types/employee-document.types';

export function useEmployeeDocuments() {
  const { get, post, del } = useFetch();

  const fetchDocuments = (employeeId: number) =>
    get<EmployeeDocumentResponse[]>(`/v1/employees/${employeeId}/documents`);

  const fetchMyDocuments = () =>
    get<EmployeeDocumentResponse[]>('/v1/employees/me/documents');

  const uploadDocument = (employeeId: number, file: File, type: DocumentType) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    return post<EmployeeDocumentResponse>(
      `/v1/employees/${employeeId}/documents`,
      formData,
    );
  };

  const deleteDocument = (employeeId: number, documentId: number) =>
    del(`/v1/employees/${employeeId}/documents/${documentId}`);

  const getDocumentUrl = (employeeId: number, documentId: number) =>
    get<{ presignedUrl: string }>(
      `/v1/employees/${employeeId}/documents/${documentId}/url`,
    );

  return {
    fetchDocuments,
    fetchMyDocuments,
    uploadDocument,
    deleteDocument,
    getDocumentUrl,
  };
}
```

---

## Edge cases

| Tình huống | HTTP | Ghi chú |
|-----------|------|---------|
| Nhân viên đã có 20 tài liệu, upload thêm | 400 | `"Mỗi nhân viên chỉ được lưu tối đa 20 tài liệu"` |
| File > 10MB | 400 | `"File không được vượt quá 10MB"` |
| Sai format (VD: `.xls`, `.zip`) | 400 | `"Chỉ chấp nhận file PDF, DOCX, JPG hoặc PNG"` |
| Upload mà không có trường `file` | 400 | `"File là bắt buộc"` |
| `EMPLOYEE` gọi `GET /:id/documents` | 403 | Chỉ xem được `/me/documents` |
| `EMPLOYEE` gọi `POST /:id/documents` | 403 | Chỉ HR/ADMIN upload được |
| `employeeId` không tồn tại | 404 | `"Nhân viên không tồn tại"` |
| `documentId` không tồn tại | 404 | `"Tài liệu không tồn tại"` |
| Gọi presigned URL sau 1 giờ | 403 từ S3 | Gọi lại endpoint `/url` để lấy URL mới |
