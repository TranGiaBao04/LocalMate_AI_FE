# LocalMate AI — Frontend

Nền tảng AI hỗ trợ người dùng tự tạo lịch trình khám phá TP.HCM, ưu tiên các cụm địa điểm tiếp cận thuận tiện qua tuyến Metro số 1.

---

## Mục lục

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Nghiệp vụ chính](#2-nghiệp-vụ-chính)
3. [Kiến trúc hệ thống](#3-kiến-trúc-hệ-thống)
4. [Cấu trúc thư mục dự án](#4-cấu-trúc-thư-mục-dự-án)
5. [Hướng dẫn setup cho thành viên nhóm](#5-hướng-dẫn-setup-cho-thành-viên-nhóm)

---

## 1. Tổng quan dự án

**LocalMate AI** là một nền tảng web (mobile-first) giúp người dùng — chủ yếu là sinh viên, Gen Z và nhân viên văn phòng trẻ tại TP.HCM — tự tạo lịch trình khám phá thành phố bằng AI, dựa trên vị trí hiện tại, thời gian rảnh, ngân sách, sở thích và phong cách trải nghiệm.

Điểm khác biệt cốt lõi của sản phẩm: hệ thống không tạo lịch trình chung chung, mà ưu tiên tạo các lịch trình **"metro-friendly"** — có logic di chuyển rõ ràng, dựa trên danh sách địa điểm đã được chọn lọc quanh các cụm ga trọng điểm của tuyến Metro số 1 (Bến Thành, Nhà hát Thành phố, Ba Son, Văn Thánh, Tân Cảng, Thảo Điền, An Phú).

**Giai đoạn hiện tại:** frontend gọi thẳng API thật từ backend **LocalMateAI** (ASP.NET Core, repo riêng) qua layer `api/apiClient` + `services/` — không còn dùng mock data. `localStorage` chỉ còn giữ JWT token và trạng thái tạo lịch trình dở dang (để không mất khi refresh trang), không còn đóng vai trò "database giả lập" như bản demo trước đây.

**Tech stack:**

| Thành phần | Công nghệ |
|---|---|
| Framework | React 19 + Vite |
| Ngôn ngữ | JavaScript (JSX), có type definitions cho React qua `@types/react` |
| Styling | Tailwind CSS |
| Routing | React Router DOM |
| State/quản lý dữ liệu | React Context API (`AuthContext`, `TripContext`) + custom hooks |
| Gọi API | `fetch` qua `api/apiClient` (base URL cấu hình bằng `VITE_API_BASE_URL`, tự đính JWT Bearer token) |
| Lưu trữ tạm | `localStorage` — JWT token, request/draft lịch trình đang tạo dở |
| Lint | ESLint (`eslint.config.js`, react-hooks + react-refresh plugin) |
| Bản đồ | Google Maps deeplink / Embed API / JavaScript API |
| Backend | ASP.NET Core Web API + PostgreSQL/PostGIS, JWT Auth (repo riêng — xem README backend) |

---

## 2. Nghiệp vụ chính

Frontend hiện thực hoá 4 nhóm actor và luồng nghiệp vụ cốt lõi sau qua UI:

### Actor
- **Guest User** — chưa đăng nhập, có thể xem Welcome, đăng ký/đăng nhập trước khi vào các trang cần auth.
- **Registered User** — đã đăng nhập, tạo lịch trình, lưu/xem lại/chia sẻ, gửi feedback nhanh cho từng địa điểm.
- **Trip Organizer** — Registered User tạo lịch trình cho nhóm (bạn bè, lớp học, câu lạc bộ) — cùng luồng tạo lịch trình, khác ở tham số số người/ngân sách nhóm.
- **Admin** — quản lý dữ liệu địa điểm, kiểm duyệt, xem feedback (chưa có màn hình admin trong bản demo hiện tại, nằm trong roadmap).

### Luồng nghiệp vụ chính (thể hiện qua route trong `App.jsx`)
1. `/` — Welcome/Splash: giới thiệu sản phẩm, dẫn tới đăng nhập/đăng ký.
2. `/login`, `/register` — Đăng nhập/đăng ký, gọi `POST /auth/login`, `POST /auth/register` qua `authService`.
3. `/home` — Trang chủ, điểm bắt đầu tạo lịch trình mới; danh sách gợi ý gần Metro lấy qua `placeService.getPlaces`.
4. `/create` — Nhập nhu cầu chuyến đi (vị trí, thời lượng, ngân sách, sở thích, phong cách).
5. `/loading` — Màn hình chờ trong lúc chờ `POST /trips/generate` trả về lịch trình nháp.
6. `/draft` — Hiển thị lịch trình nháp dạng timeline do AI Planner (backend thật) trả về.
7. `/place/:placeId` — Xem chi tiết/lý do đề xuất một địa điểm, gọi `placeService.getPlaceById`.
8. `/replace/:itemId` — Thay thế một địa điểm trong lịch trình nháp, gọi `tripService.replaceItem`.
9. `/finalized` — Chốt lịch trình (Draft → Finalized) qua `tripService.finalizeTrip`.
10. `/trips`, `/trips/:tripId` — My Trips: danh sách và chi tiết lịch trình đã lưu (`tripService.getTrips`), đánh dấu đã ghé và gửi feedback qua `reviewService.submitReview`.
11. `/profile` — Thông tin tài khoản.

### Nguyên tắc quan trọng (chi phối cách thiết kế UI)
- AI **không tự quyết định thay người dùng** — lịch trình luôn ở trạng thái Draft trước; UI luôn cho phép xem thông tin từng địa điểm, thay thế hoặc giữ lại trước khi chốt (`ReplacePlacePage`, `PlacePreviewPage`).
- Mọi route nghiệp vụ (trừ Welcome/Login/Register) đều bọc qua `requireAuth` trong [App.jsx](src/App.jsx) — chưa đăng nhập sẽ bị điều hướng về `/login`.
- Mỗi item trong lịch trình (`ItineraryItem` trả về từ backend) mang sẵn dữ liệu hiển thị cần thiết (`placeImageUrl`, `latitude`, `longitude`, `nearestMetroStation`...) để trang không phải gọi thêm API lấy chi tiết từng địa điểm chỉ để vẽ timeline.

---

## 3. Kiến trúc hệ thống

Frontend tổ chức theo hướng **tách lớp theo trách nhiệm** (component/page vs. state vs. gọi API), mỗi tầng chỉ biết tầng ngay dưới nó:

```
Pages (routes)  →  Context / Hooks  →  Services  →  api/apiClient  →  Backend API
(màn hình,          (state dùng          (1 hàm =        (fetch wrapper:    (LocalMateAI,
 layout)             chung, side          1 nghiệp vụ,     base URL, JWT      ASP.NET Core,
                      effect)              không biết       Bearer, parse      repo riêng)
                                           HTTP)            lỗi JSON)
```

Nguyên tắc: **component/page không tự gọi `fetch`, không tự đọc/ghi `localStorage` liên quan tới dữ liệu nghiệp vụ** — mọi thao tác dữ liệu đi qua `context/` (state dùng chung nhiều trang) hoặc trực tiếp qua `services/` (dữ liệu cục bộ một trang, ví dụ danh sách địa điểm thay thế). Nhờ vậy nếu backend đổi endpoint hay response shape, chỉ cần sửa trong `services/`, không đụng tới `pages/`/`components/`.

| Thư mục | Nội dung |
|---|---|
| `pages/` | Từng màn hình ứng với 1 route trong `App.jsx`, nhóm theo domain: `auth/`, `home/`, `trip/`, `profile/` |
| `components/layout/` | Khung layout dùng chung: `MobileLayout`, `BottomNavigation` (kèm `SideNavigation`) |
| `components/ui/` | Nơi chứa các UI component tái sử dụng (button, input, card...) khi được tách ra khỏi page |
| `context/` | React Context giữ state toàn cục: `AuthContext` (JWT/user hiện tại, gọi `authService`), `TripContext` (lịch trình đang tạo/đã lưu, gọi `tripService`) |
| `hooks/` | Custom hook dùng chung, ví dụ `useLocalStorage` |
| `services/` | `authService`, `placeService`, `tripService`, `reviewService` — mỗi hàm ứng với 1 nghiệp vụ, gọi qua `api/apiClient`, không chứa logic UI |
| `api/apiClient.js` | Wrapper `fetch` dùng chung: gắn `Authorization: Bearer <token>`, base URL từ `VITE_API_BASE_URL`, parse JSON và ném `ApiError` khi response lỗi |
| `data/` | Không còn mock data — chỉ giữ chỗ (`.gitkeep`) cho dữ liệu tĩnh phía client nếu cần sau này (ví dụ danh sách hằng số lớn) |
| `utils/` | Hàm tiện ích thuần, không phụ thuộc React, ví dụ `formatCurrency.js` |
| `constants/` | Hằng số dùng chung toàn app (`index.js`) |
| `assets/` | Ảnh, icon, logo tĩnh |

**Quy ước gọi API:** mỗi hàm trong `services/` nhận/trả JS object thuần (không lộ chi tiết `fetch`/HTTP ra ngoài), và `pages/` luôn `await` + `try/catch` khi gọi để hiển thị trạng thái loading/lỗi phù hợp thay vì để lỗi rơi tự do.

---

## 4. Cấu trúc thư mục dự án

```
local-mate-ai-fe/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── eslint.config.js
│
├── public/
│
└── src/
    ├── api/
    │   └── apiClient.js         # fetch wrapper dùng chung (base URL, JWT, parse lỗi)
    ├── assets/                 # ảnh, icon, logo
    │   ├── hero.png
    │   └── logo.jpg
    │
    ├── components/
    │   ├── layout/              # MobileLayout, BottomNavigation
    │   └── ui/                  # UI component dùng chung (chuẩn bị)
    │
    ├── constants/
    │   └── index.js
    │
    ├── context/
    │   ├── AuthContext.jsx
    │   └── TripContext.jsx
    │
    ├── data/                   # Không còn mock data, chỉ giữ .gitkeep
    │
    ├── hooks/
    │   └── useLocalStorage.jsx
    │
    ├── pages/
    │   ├── auth/                # WelcomePage, LoginPage, RegisterPage
    │   ├── home/                # HomePage
    │   ├── trip/                 # CreateTripPage, AiLoadingPage, DraftItineraryPage,
    │   │                         # PlacePreviewPage, ReplacePlacePage, FinalizedItineraryPage,
    │   │                         # MyTripsPage, SavedTripDetailPage
    │   └── profile/              # ProfilePage
    │
    ├── redux/                  # dự phòng nếu cần chuyển sang Redux (hiện chưa dùng)
    ├── services/
    │   ├── authService.js
    │   ├── placeService.js
    │   ├── tripService.js
    │   └── reviewService.js
    ├── utils/
    │   └── formatCurrency.js
    │
    ├── App.jsx
    ├── App.css
    ├── main.jsx
    └── index.css
```

**Lưu ý:** thư mục trống không được Git track. Folder chỉ thật sự "xuất hiện" trong lịch sử Git từ khi có ít nhất 1 file bên trong (các thư mục `.gitkeep` hiện tại là placeholder giữ chỗ cho cấu trúc) — đây là hành vi bình thường của Git, không phải lỗi cấu trúc.

---

## 5. Hướng dẫn setup cho thành viên nhóm

### 5.1. Yêu cầu cài đặt trước (cài 1 lần trên máy)

| Công cụ | Ghi chú |
|---|---|
| [Node.js](https://nodejs.org/) (LTS, khuyến nghị ≥ 20) | Bắt buộc — kiểm tra bằng `node --version` |
| npm | Đi kèm Node.js — kiểm tra bằng `npm --version` |
| [Visual Studio Code](https://code.visualstudio.com/) hoặc IDE tương đương | IDE để mở project |
| [Git](https://git-scm.com/) | Quản lý version |

### 5.2. Clone repository

```bash
git clone <repo-url>
cd local-mate-ai-fe
```

### 5.3. Cài đặt dependency

```bash
npm install
```

Lệnh này tự động tải toàn bộ package đã khai báo trong `package.json` (React, React Router, Tailwind, Vite, ESLint...).

### 5.4. Chạy project ở môi trường dev

```bash
npm run dev
```

Vite sẽ in ra URL local (mặc định `http://localhost:5173`) — mở bằng trình duyệt để xem app. Hỗ trợ Hot Module Replacement (HMR), sửa code sẽ tự refresh.

### 5.5. Các lệnh khác

| Lệnh | Mục đích |
|---|---|
| `npm run lint` | Kiểm tra lỗi code style/quality bằng ESLint |
| `npm run build` | Build bản production vào thư mục `dist/` |
| `npm run preview` | Chạy thử bản đã build (`dist/`) ở local để kiểm tra trước khi deploy |

### 5.6. Kết nối backend thật

Frontend gọi thẳng API của repo `LocalMateAI` (ASP.NET Core, xem README backend mục 5 để chạy local bằng Docker). Có 2 cách trỏ frontend tới backend đó khi dev:

1. **Mặc định (khuyến nghị):** không cần làm gì thêm. `vite.config.js` đã cấu hình `server.proxy` chuyển tiếp mọi request `/api/*` từ Vite dev server sang `https://localhost:7144` (cổng backend chạy `dotnet run` ở môi trường Development) — chỉ cần chạy backend song song rồi `npm run dev`.
2. **Trỏ tới backend khác** (staging, cổng khác, hoặc build production): copy `.env.example` thành `.env`, set `VITE_API_BASE_URL` trỏ thẳng tới base URL của backend đó (ví dụ `https://api.localmate.ai/api`). `.env` không được commit (đã có trong `.gitignore`).

Toàn bộ lời gọi API đi qua `src/api/apiClient.js` (tự đính JWT Bearer token lưu trong `localStorage` sau khi đăng nhập) và các hàm trong `src/services/`. Nếu backend chưa chạy hoặc trả lỗi, UI sẽ hiển thị thông báo lỗi tương ứng (ví dụ ở `LoginPage`, `RegisterPage`) thay vì crash.

### 5.7. Quy ước làm việc nhóm (bổ sung khi nhóm thống nhất)

- Branch chính: `main` (protected). Mỗi tính năng làm trên nhánh `feature/<tên-tính-năng>`, tạo Pull Request vào `main` (hoặc `dev` nếu nhóm thống nhất dùng nhánh trung gian).
- Chạy `npm run lint` trước khi commit/PR để tránh lỗi style lọt vào `main`.
- Không commit `node_modules/`, `dist/` hoặc file `.env` chứa secret (đã có trong `.gitignore`).
- Khi thêm màn hình/route mới, cập nhật `App.jsx` và bổ sung thư mục tương ứng trong `pages/` theo domain (`auth/`, `home/`, `trip/`, `profile/`...).

---

*Tài liệu này mô tả trạng thái khung sườn frontend hiện tại. Cập nhật thêm khi có thay đổi cấu trúc hoặc quy ước nhóm mới.*
