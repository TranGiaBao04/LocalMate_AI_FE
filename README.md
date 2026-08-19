# LocalMate AI

**Nền tảng AI hỗ trợ tự lên lịch trình khám phá TP.HCM — cá nhân hóa, đáng tin cậy, dễ di chuyển.**

> Mobile-first Web App · React + TypeScript + Tailwind · Metro-friendly itinerary planning

---

## Mục lục

1. [Giới thiệu](#1-giới-thiệu)
2. [Vấn đề & Giải pháp](#2-vấn-đề--giải-pháp)
3. [Giá trị cốt lõi](#3-giá-trị-cốt-lõi)
4. [Phạm vi MVP](#4-phạm-vi-mvp)
5. [Mô hình người dùng](#5-mô-hình-người-dùng)
6. [Main Flows](#6-main-flows)
7. [Tech Stack](#7-tech-stack)
8. [Cấu trúc thư mục (Frontend Demo)](#8-cấu-trúc-thư-mục-frontend-demo)
9. [Bản Demo](#9-bản-demo)
10. [Optional Features / Roadmap](#10-optional-features--roadmap)
11. [Phase Rollout](#11-phase-rollout)
12. [Mô hình kinh doanh](#12-mô-hình-kinh-doanh)
13. [Retention Strategy](#13-retention-strategy)
14. [Lưu ý khi trình bày / demo](#14-lưu-ý-khi-trình-bày--demo)

---

## 1. Giới thiệu

**LocalMate AI** là nền tảng giúp người dùng tự lên lịch trình khám phá TP.HCM theo hướng tự túc, cá nhân hóa và bám sát trải nghiệm bản địa. Đối tượng chính: người trẻ, sinh viên, nhân viên văn phòng trẻ (Gen Z) và khách du lịch trong nước muốn khám phá thành phố linh hoạt thay vì phụ thuộc vào tour truyền thống hoặc review rời rạc trên mạng xã hội.

Dự án ra đời từ hai xu hướng:

- **Du lịch tự túc & trải nghiệm bản địa** ngày càng phổ biến, đặc biệt với Gen Z — muốn tự chọn địa điểm, tự thiết kế hành trình, tìm các "hidden gems" thay vì tour đại trà.
- **Tuyến Metro số 1 tại TP.HCM** mở ra trục di chuyển rõ ràng, kết nối Quận 1, Bình Thạnh, TP. Thủ Đức — là cơ sở để xây dựng các lịch trình **"metro-friendly"**.

Người dùng hiện nay mất nhiều thời gian tìm kiếm thông tin từ TikTok, Instagram, Threads, Google Maps hoặc review — vốn có thể bị seeding, quảng cáo quá mức hoặc không phản ánh đúng thực tế. LocalMate AI đóng vai trò cầu nối giữa người dùng và các địa điểm bản địa đáng tin cậy, kết hợp dữ liệu địa điểm chọn lọc + vị trí người dùng + bản đồ + tuyến Metro số 1 + AI Planner để tạo lịch trình phù hợp.

---

## 2. Vấn đề & Giải pháp

### Vấn đề người dùng đang gặp

- Mất nhiều thời gian tìm địa điểm từ nhiều nguồn rời rạc (TikTok, Instagram, Threads, Google Maps, review).
- Khó biết địa điểm nào thật sự phù hợp ngân sách, thời gian, sở thích.
- Khó tự sắp xếp lịch trình hợp lý về tuyến đường, thời gian di chuyển, chi phí.
- Nhiều địa điểm bị quảng bá quá mức hoặc review không minh bạch.
- Không biết bắt đầu từ đâu nếu muốn khám phá thành phố tự túc, linh hoạt, an toàn.

### Giải pháp

LocalMate AI sử dụng **dữ liệu địa điểm đã chọn lọc**, kết hợp **vị trí người dùng**, **tuyến Metro số 1**, **bản đồ** và **AI Planner** để tạo ra lịch trình có cấu trúc, dễ hiểu, dễ thực hiện — không chỉ là một đoạn văn bản AI dài mà là timeline rõ ràng, có thể chỉnh sửa, lưu và chia sẻ.

---

## 3. Giá trị cốt lõi

| Giá trị                                      | Mô tả                                                                                                                                        |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cá nhân hóa trải nghiệm**                  | Lịch trình dựa trên vị trí, thời gian, ngân sách, sở thích và phong cách trải nghiệm của từng người, không phải lịch trình chung cho tất cả. |
| **Tăng tính thực tế**                        | Địa điểm được sắp xếp theo thời gian, khoảng cách, chi phí và khả năng di chuyển; ưu tiên cụm dễ tiếp cận qua Metro số 1.                    |
| **Kết nối trải nghiệm bản địa đáng tin cậy** | Giới thiệu địa điểm bản địa, quán ăn, cafe, không gian văn hóa, hidden gems đã chọn lọc — không phụ thuộc review bị seeding.                 |
| **Trao quyền chủ động cho người dùng**       | Người dùng có thể tạo lại, chỉnh sửa, lưu, chia sẻ và phản hồi lịch trình, không bị phụ thuộc hoàn toàn vào AI.                              |

---

## 4. Phạm vi MVP

### MVP là gì?

Một nền tảng web giúp người dùng **tự tạo lịch trình khám phá TP.HCM bằng AI**, dựa trên vị trí hiện tại, thời gian rảnh, ngân sách, sở thích và phong cách trải nghiệm — **tập trung vào các cụm địa điểm quanh tuyến Metro số 1**, đặc biệt: **Bến Thành, Nhà hát Thành phố, Ba Son, Văn Thánh, Tân Cảng, Thảo Điền, An Phú**.

### MVP cần chứng minh

1. Người dùng có thật sự cần công cụ tự lên lịch trình nhanh hơn không.
2. Lịch trình AI tạo ra có đủ thực tế, dễ hiểu, đáng tin để người dùng muốn lưu/chỉnh sửa/chia sẻ không.
3. Cách tiếp cận theo vị trí + trục metro có giúp lịch trình dễ di chuyển hơn so với tự tìm địa điểm rời rạc không.

### Chức năng cốt lõi trong MVP

1. **Quản lý dữ liệu địa điểm** — tên, loại, khu vực, địa chỉ, tọa độ, chi phí dự kiến, thời lượng gợi ý, tag sở thích, giờ hoạt động, trạng thái hiển thị.
2. **Tạo lịch trình bằng AI** — output có cấu trúc: tên lịch trình, tổng thời gian, tổng chi phí, danh sách địa điểm theo timeline, lý do đề xuất, gợi ý di chuyển, gợi ý thay thế.
3. **Hiển thị lịch trình dạng timeline** — trực quan theo buổi/khung giờ.
4. **Bản đồ và vị trí cơ bản** — hiển thị vị trí địa điểm, cụm ga, chưa cần tối ưu tuyến đường phức tạp.
5. **Lưu và chia sẻ lịch trình** — cho phép tạo thử trước khi yêu cầu đăng nhập; chia sẻ qua link.
6. **Chỉnh sửa và tạo lại lịch trình** — theo tiêu chí khác (tiết kiệm hơn, chill hơn, ít di chuyển hơn...).
7. **Phản hồi chất lượng** — feedback nhanh (phù hợp / không phù hợp / quá xa / quá đắt / quá đông...).

### MVP chưa làm gì

- Booking khách sạn / đặt tour trực tiếp / thanh toán
- Marketplace du lịch / mạng xã hội review
- Partner dashboard phức tạp / mobile app riêng
- Tối ưu giao thông real-time / bao phủ toàn bộ TP.HCM
- Bán API doanh nghiệp / đa ngôn ngữ đầy đủ

### Câu chốt MVP

> LocalMate AI MVP là nền tảng web giúp người dùng tạo lịch trình khám phá TP.HCM bằng AI, dựa trên vị trí hiện tại, thời gian, ngân sách và sở thích — tập trung trước vào các cụm địa điểm quanh tuyến Metro số 1 để tạo lịch trình dễ di chuyển, có cấu trúc rõ ràng, có thể lưu, chỉnh sửa, chia sẻ và phản hồi.

---

## 5. Mô hình người dùng

### 5.1. Guest User (chưa đăng nhập)

- **Nhu cầu:** thử nhanh, xem sản phẩm hữu ích không, không muốn đăng ký ngay.
- **Quyền:** xem trang chủ, xem lịch trình mẫu, tạo thử lịch trình, nhận nhắc đăng nhập khi muốn lưu.
- **Giới hạn:** không lưu nhiều lịch trình, không xem lịch sử, không cá nhân hóa nâng cao, không My Trips.

### 5.2. Registered User (đã đăng nhập)

- **Nhu cầu:** cá nhân hóa, lưu lịch trình, xem lại, chỉnh sửa, chia sẻ, gửi feedback.
- **Quyền:** đăng ký/đăng nhập, cập nhật thông tin, tạo/lưu/xem lại/tạo lại lịch trình, chia sẻ qua link, gửi feedback, xóa lịch trình.
- **Dữ liệu lưu:** tên, email, lịch trình đã tạo, sở thích cơ bản, feedback, địa điểm yêu thích.

### 5.3. Trip Organizer (người tổ chức nhóm)

- **Nhu cầu:** lên lịch trình cho nhóm bạn/lớp/CLB/gia đình, cân bằng sở thích nhóm, tính chi phí, chia sẻ dễ gửi qua Zalo/Messenger.
- **Quyền MVP:** tạo lịch trình theo số người, lưu, chia sẻ link view-only, tạo lại theo ngân sách/phong cách khác, xuất thông tin dễ copy.
- **Phase sau:** vote địa điểm, comment, chia ngân sách theo người, checklist nhóm, mời thành viên, export PDF.
- **Lý do quan trọng:** pain rõ hơn người đi cá nhân → khả năng quay lại và trả tiền cao hơn.

### 5.4. Admin (quản trị hệ thống)

- **Nhu cầu:** quản lý địa điểm, người dùng, feedback, chất lượng lịch trình.
- **Quyền:** đăng nhập trang quản trị, thêm/cập nhật/ẩn/kích hoạt địa điểm, gắn tag & cụm ga, xem feedback, xem thống kê, quản lý trạng thái (active/inactive/pending/verified).
- **Lý do cần:** đảm bảo chất lượng dữ liệu địa điểm trước khi AI sử dụng để tạo lịch trình.

### 5.5. Partner (đối tác địa phương)

- **Ví dụ:** quán ăn, cafe, workshop, không gian văn hóa, homestay/hostel, tour địa phương, dịch vụ thuê xe.
- **Vai trò MVP:** chưa có tài khoản riêng, quản lý thủ công qua Admin.
- **Giá trị nhận được:** xuất hiện trong lịch trình phù hợp, tiếp cận người dùng có nhu cầu thật, nhận lượt xem/lưu/click/liên hệ.
- **Phase sau:** Partner dashboard, xem lượt hiển thị/click/lead, tạo ưu đãi, sponsored listing, quản lý nội dung.

---

## 6. Main Flows

| #   | Flow                               | Mục tiêu                                                                        |
| --- | ---------------------------------- | ------------------------------------------------------------------------------- |
| 1   | Truy cập và hiểu giá trị sản phẩm  | Người dùng mới hiểu LocalMate AI làm gì, bắt đầu tạo lịch trình                 |
| 2   | Nhập nhu cầu chuyến đi             | Thu thập vị trí, thời gian, ngân sách, số người, sở thích, phong cách           |
| 3   | Xác định cụm metro/khu vực phù hợp | Chọn danh sách địa điểm ứng viên dựa trên vị trí & trục Metro số 1              |
| 4   | AI Planner tạo lịch trình          | Tạo lịch trình có cấu trúc: timeline, chi phí, lý do đề xuất, ghi chú di chuyển |
| 5   | Hiển thị lịch trình dạng timeline  | Giúp người dùng hiểu và quyết định dùng/chỉnh sửa/tạo lại                       |
| 6   | Tạo lại hoặc chỉnh sửa lịch trình  | Cho phép người dùng kiểm soát: rẻ hơn, chill hơn, ít di chuyển hơn...           |
| 7   | Đăng ký, đăng nhập, lưu lịch trình | Lưu vào My Trips để xem lại sau                                                 |
| 8   | Chia sẻ lịch trình                 | Tạo link chia sẻ view-only, tăng trưởng tự nhiên                                |
| 9   | Gửi feedback lịch trình & địa điểm | Thu thập phản hồi nhanh để cải thiện dữ liệu và AI                              |
| 10  | Admin quản lý địa điểm             | Đảm bảo chất lượng database địa điểm                                            |
| 11  | Admin quản lý feedback             | Xử lý phản hồi, cập nhật dữ liệu, backlog cải thiện AI                          |
| 12  | Gợi ý đối tác/tài trợ (nhẹ)        | Thử nghiệm mô hình doanh thu mà không phá niềm tin người dùng                   |

**Nguyên tắc quan trọng:** Metro là trục ưu tiên, **không phải điều kiện bắt buộc**. Nếu người dùng ở xa trục metro, hệ thống vẫn gợi ý lịch trình gần vị trí hiện tại hoặc lịch trình metro-friendly bắt đầu từ cụm trung tâm phù hợp.

---

## 7. Tech Stack

### Frontend

- React + TypeScript + Vite
- Mobile-first Web App / PWA
- Google Maps Embed / Maps JavaScript API
- Google Maps deeplink (navigation)

### Backend

- ASP.NET Core Web API
- Entity Framework Core
- JWT Authentication
- AI Planner Service
- Google Maps/Places integration service (nếu cần)

### Database

- PostgreSQL + PostGIS
- Bảng chính: `users`, `places`, `metro_stations`, `trips`, `itinerary_items`, `feedbacks`

### AI

- LLM API
- Structured JSON output
- Prompt template
- Validation layer

### Map

- Google Maps URL deeplink (navigation)
- Google Maps Embed API (map preview)
- Google Maps JavaScript API (optional — map tương tác nâng cao)

---

## 8. Cấu trúc thư mục (Frontend Demo)

```
src/
├── api/
│   └── apiClient.js
│
├── assets/
│   ├── images/
│   └── icons/
│
├── components/
│   ├── common/          # Button, Input, Modal, Badge, Chip, EmptyState, LoadingSpinner
│   ├── layout/          # MobileLayout, BottomNavigation, Header
│   ├── auth/             # LoginForm, RegisterForm
│   ├── trip/             # TripWizard, LocationStep, TimeBudgetStep, InterestStep,
│   │                     # TravelStyleStep, ReviewRequest, Timeline, TimelineItemCard,
│   │                     # BudgetSummaryCard, FinalizeTripModal, SaveTripModal
│   ├── place/            # PlaceCard, PlaceInsightCard, PlacePreviewSection,
│   │                     # ReplacePlaceList, GoogleMapsButton
│   └── review/           # QuickReviewModal, RatingInput, ReviewTagSelector
│
├── context/
│   ├── AuthContext.jsx
│   └── TripContext.jsx
│
├── data/                 # Mock data: users, places, metroStations, itineraries, placeReviews
│
├── hooks/                # useAuth, useTrip, useLocalStorage
│
├── pages/
│   ├── auth/              # WelcomePage, LoginPage, RegisterPage
│   ├── home/              # HomePage
│   ├── trip/               # CreateTripPage, AiLoadingPage, DraftItineraryPage,
│   │                       # PlacePreviewPage, ReplacePlacePage, FinalizedItineraryPage,
│   │                       # MyTripsPage, SavedTripDetailPage
│   └── profile/           # ProfilePage
│
├── services/              # authService, itineraryService, placeService,
│                           # tripService, reviewService
│
├── utils/                 # formatCurrency, googleMaps, dateTime, tripStatus
│
├── App.jsx
├── main.jsx
├── App.css
└── index.css
```

### LocalStorage keys (demo)

```
localmate_user
localmate_trip_draft
localmate_saved_trips
localmate_place_reviews
localmate_preferences
```

---

## 9. Bản Demo

Bản demo hiện tại được triển khai như **mobile-first web app** chạy trên trình duyệt bằng ReactJS. Chưa cần backend thật, database thật hoặc AI API thật — sử dụng **mock data**, **mock service** và **localStorage** để mô phỏng toàn bộ flow.

### Core flow demo

```
Đăng nhập demo → nhập nhu cầu chuyến đi → AI tạo lịch trình nháp
→ xem thông tin từng địa điểm → giữ/thay thế địa điểm → chốt lịch trình
→ mở Google Maps → lưu vào My Trips → đánh dấu đã ghé & gửi quick feedback
```

**Nguyên tắc cốt lõi:** AI không quyết định hoàn toàn thay người dùng. AI chỉ đề xuất lịch trình **nháp (draft)**. Người dùng luôn có thể xem thông tin địa điểm, đánh giá độ phù hợp, thay thế và chốt (finalize) lịch trình.

### 7 Key Features

| #   | Feature                                            | Mô tả ngắn                                                             |
| --- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | **Authentication & Demo User**                     | Đăng nhập/đăng ký hoặc dùng tài khoản demo (mock qua localStorage)     |
| 2   | **Trip Preference Wizard**                         | Nhập vị trí, thời lượng, ngân sách, sở thích, phong cách qua 4 bước    |
| 3   | **Mock AI Itinerary Generator**                    | Mô phỏng AI Planner tạo lịch trình nháp có cấu trúc (draft)            |
| 4   | **Place Preview / Place Insight**                  | Xem thông tin, lý do đề xuất, lưu ý của từng địa điểm trước khi chốt   |
| 5   | **Itinerary Review & Finalize**                    | Trạng thái Draft → Finalized, người dùng kiểm soát trước khi chốt      |
| 6   | **Google Maps Direction**                          | Mở chỉ đường qua Google Maps deeplink, không tự xây navigation         |
| 7   | **Save Trip, My Trips & Post-Experience Feedback** | Lưu trip, xem lại, đánh dấu "Đã ghé", gửi quick review sau trải nghiệm |

### Danh sách màn hình chính (28 screens)

**Auth:** Welcome/Splash → Login → Register → Profile
**Trip Wizard:** Home → Create Trip Intro → Step 1 (Location) → Step 2 (Time & Budget) → Step 3 (Interests) → Step 4 (Travel Style) → Review Request
**AI Generator:** AI Loading
**Place Insight:** Draft Itinerary → Place Preview → Replace Place
**Finalize:** Draft Review Summary → Finalized Itinerary
**Maps:** Direction buttons (trong Place Preview & Finalized Itinerary), Optional Map Preview
**Save & Feedback:** Save Trip Modal → My Trips → Saved Trip Detail → Mark as Visited → Quick Place Review Modal → Feedback Success
**Admin (optional):** Admin Place List → Admin Place Form

### Demo input mẫu (khuyến nghị dùng khi trình bày)

```json
{
  "startArea": "Tân Bình",
  "durationHours": 4,
  "budgetPerPerson": 300000,
  "peopleCount": 2,
  "interests": ["cafe", "check-in", "local-food", "near-metro"],
  "travelStyles": ["chill", "low-movement", "local-experience"],
  "metroFriendly": true
}
```

**Kết quả mẫu:** Lịch trình "Chiều chill quanh Bến Thành - Ba Son" — 4 giờ, ~280k/người, 5 địa điểm (Chợ Bến Thành → Cafe hidden gem gần Lê Lợi → Nhà hát Thành phố → Khu Ba Son ven sông → Quán ăn địa phương).

### Những điều nên/không nên nói khi demo

**Không nên nói:** "AI đã hoàn chỉnh", "đã tối ưu route thật", "database đã đầy đủ toàn bộ TP.HCM", "đã có backend thật", "Google Maps đã tích hợp navigation hoàn chỉnh trong app".

**Nên nói:** "Bản demo dùng mock data để mô phỏng AI Planner", "Frontend tổ chức theo service layer để thay mock bằng API thật sau này", "AI không tự bịa địa điểm — chỉ chọn/sắp xếp từ database đã chọn lọc", "Google Maps dùng qua deeplink để hỗ trợ chỉ đường".

---

## 10. Optional Features / Roadmap

### Nên cân nhắc sau khi MVP ổn định

- Export lịch trình PDF/ảnh
- Checklist chuyến đi theo loại lịch trình
- Budget planner cơ bản (ăn uống, di chuyển, vé, trải nghiệm, dự phòng)
- Địa điểm yêu thích
- Lịch trình mẫu có sẵn

### Tăng retention

- Trip workspace nhóm (timeline, người tham gia, ghi chú, checklist, budget, comment, vote)
- Vote địa điểm
- AI cân bằng sở thích nhóm
- In-trip assistant ("tôi trễ 2 tiếng", "trời mưa đổi địa điểm trong nhà"...)
- Gợi ý chuyến tiếp theo dựa trên lịch sử

### Tăng doanh thu

- Freemium (nhiều lịch trình hơn, export PDF, lịch trình nhóm, AI chỉnh trong lúc đi...)
- Affiliate links (vé, tour, dịch vụ du lịch)
- Lead generation cho đối tác địa phương
- Sponsored listing minh bạch
- B2B tool cho homestay/hostel/tour địa phương

### Nâng cao trải nghiệm

- Bản đồ tương tác nâng cao
- Kiểm tra giờ mở cửa
- Weather-aware itinerary
- Mức độ đông đúc theo khung giờ
- Đa ngôn ngữ (tiếng Anh cho khách quốc tế)

### Không nên làm trong MVP

- Booking khách sạn/tour trực tiếp — cần xử lý thanh toán, hủy, hoàn tiền, pháp lý
- Marketplace du lịch — scope quá lớn, cạnh tranh cao
- Mạng xã hội review du lịch — dễ phình sản phẩm, khó kiểm soát nội dung
- Mobile app riêng — ưu tiên web app trước
- Bán dữ liệu người dùng — nhạy cảm về quyền riêng tư
- Bán API cho doanh nghiệp lớn — cần độ ổn định và bảo mật cao hơn

---

## 11. Phase Rollout

### Phase 1 — MVP bắt buộc

Trang chủ · Đăng ký/đăng nhập cơ bản · Nhập nhu cầu · Quản lý địa điểm · Gắn địa điểm với khu vực/cụm ga · AI Planner · Timeline · Chi phí dự kiến · Lý do đề xuất · Tạo lại lịch trình · Lưu lịch trình · My Trips · Chia sẻ link view-only · Feedback · Admin quản lý địa điểm · Admin xem feedback.

### Phase 2 — Sau khi MVP chạy được

Export PDF · Budget planner · Checklist · Địa điểm yêu thích · Thay thế từng địa điểm · Lịch trình mẫu · Partner listing thủ công · Click tracking · Gợi ý cá nhân hóa theo lịch sử.

### Phase 3 — Mở rộng

Trip workspace nhóm · Vote địa điểm · Comment · AI cân bằng sở thích nhóm · In-trip assistant · Weather-aware itinerary · Bản đồ tương tác nâng cao · Affiliate links · Sponsored listing · Partner dashboard đơn giản.

### Phase 4 — Future direction

Mobile app · Booking tích hợp · Thanh toán · Marketplace trải nghiệm · B2B tool · API/widget cho đối tác · Đa ngôn ngữ · Mở rộng tuyến metro/thành phố khác.

---

## 12. Mô hình kinh doanh

### Giai đoạn đầu

Mục tiêu **chưa phải kiếm tiền ngay** mà là chứng minh giá trị sản phẩm và khả năng có người dùng thật. Ưu tiên tạo giá trị và thu thập tín hiệu sử dụng thật trước khi thu phí Gen Z.

### Đối tác tiềm năng (đánh giá khả thi)

| Đối tượng                        | Mô hình                                                      | Khả thi                                        |
| -------------------------------- | ------------------------------------------------------------ | ---------------------------------------------- |
| Quán ăn, cafe, địa điểm check-in | Hiển thị, ưu đãi                                             | Thấp — chất lượng vận hành không đồng đều      |
| Tour địa phương nhỏ              | Giới thiệu, affiliate                                        | Thấp — chưa tự chủ booking                     |
| Dịch vụ thuê xe/tài xế riêng     | Gợi ý theo điểm đến, commission, gói đối tác, thu phí lead   | **Cao hơn**                                    |
| CLB, lớp học, trường đại học     | Gói lịch trình nhóm, quản lý ngân sách, chia tiền, checklist | **Cao**                                        |
| Nhân viên văn phòng              | Gói lịch trình theo mood, team building                      | Thấp — chưa booking được dịch vụ               |
| Cặp đôi                          | Lịch trình date, combo chụp ảnh, affiliate homestay/resort   | Có khả thi, cần cập nhật địa điểm đẹp liên tục |
| Gia đình trẻ                     | Gói lịch trình gia đình, xe riêng, tour nhẹ                  | Thấp — chưa booking được dịch vụ               |

### Hoạt động kinh doanh chính

1. Phát triển và duy trì sản phẩm (web/app, backend, database, thuật toán, UI).
2. Thu thập và cập nhật dữ liệu địa điểm.
3. Cải thiện chất lượng lịch trình AI (kiểm tra độ dày, khoảng cách, chi phí, thời gian nghỉ).
4. Làm việc với người dùng để lấy phản hồi (phỏng vấn, thử nghiệm MVP).
5. Phát triển đối tác địa phương (homestay, quán ăn, tour, thuê xe).
6. Marketing & xây dựng cộng đồng (TikTok/Facebook/Instagram, cộng đồng sinh viên).

### Chăm sóc khách hàng

- Hỗ trợ lỗi kỹ thuật và hướng dẫn sử dụng.
- Thu thập feedback ngắn sau mỗi lịch trình.
- Quan sát hành vi thật (lưu, chỉnh sửa, chia sẻ, quay lại) thay vì chỉ hỏi ý kiến.
- Kênh giao tiếp trực tiếp: Facebook Page, Messenger, Zalo, email, group cộng đồng.
- Cá nhân hóa dần theo lịch sử sử dụng.

**Lưu ý về đối tác trả phí:** Nếu đối tác trả tiền để xuất hiện nhưng không phù hợp nhu cầu người dùng, sản phẩm sẽ mất niềm tin. Nội dung tài trợ **cần minh bạch** hoặc chỉ xuất hiện khi thật sự phù hợp.

---

## 13. Retention Strategy

> Retention không nên đo như mạng xã hội (dùng hằng ngày). Mục tiêu: khi người dùng muốn đi đâu đó, họ **nhớ tới LocalMate AI ngay**.

### Giá trị theo từng giai đoạn

**Trước chuyến đi:** lưu/chỉnh sửa lịch trình, so sánh phương án, tính ngân sách, checklist, chia sẻ để nhóm góp ý.

**Trong chuyến đi (phần nhiều app bỏ sót):** rút gọn lịch trình khi mệt, đổi sang địa điểm trong nhà khi mưa, tìm quán ăn gần đó trong ngân sách, sắp xếp lại khi trễ giờ — biến app thành **travel companion** thay vì chỉ công cụ lập kế hoạch.

**Sau chuyến đi:** lưu kỷ niệm, gợi ý chuyến tiếp theo dựa trên chuyến vừa đi, đánh giá lịch trình, tính chi phí thực tế.

### Định hướng chiến lược

1. **Trip = Workspace**, không phải một đoạn text — gồm lịch trình từng ngày, địa điểm đã lưu, ngân sách dự kiến/thực tế, người tham gia, ghi chú, checklist, trạng thái (đang lên kế hoạch/sắp đi/đang đi/đã đi).
2. **Tính năng nhóm** — vì đi du lịch thường không đi một mình; người tổ chức trip nhóm có pain rõ hơn (không thống nhất ngân sách, hay đổi ý, phải chia tiền) → retention và khả năng trả phí tốt hơn nhóm cá nhân.
3. **Cá nhân hóa thật sự** — ghi nhớ gu người dùng (ít/nhiều điểm, loại sở thích, ngân sách quen dùng, kiểu nhóm đi cùng) để lần sau gợi ý chủ động, không hỏi lại từ đầu.
4. **Trigger đúng thời điểm** — thông báo gắn với nhu cầu cụ thể (cuối tuần, trước lễ, lịch trình còn thiếu mục, thời tiết thay đổi), tránh notification chung chung vô nghĩa.
5. **Chất lượng lịch trình là gốc rễ** — nếu lịch trình đi quá dày, di chuyển phi thực tế, gợi ý quán đóng cửa, thì mọi tính năng phụ đều vô ích. Nên có phần giải thích rõ **"vì sao địa điểm này được đề xuất"** để tăng niềm tin.
6. **Vòng lặp feedback nhanh** — 👍/👎, quá dày/vừa/quá ít, quá đắt/vừa/quá rẻ — không khảo sát dài dòng.

### Ưu tiên tính năng retention

**Nên làm sớm:** lưu lịch trình, chỉnh sửa, tạo lại theo style khác, chia sẻ link, tính ngân sách cơ bản, gợi ý lại khi đổi tiêu chí, feedback nhanh, lưu sở thích người dùng.

**Có thể làm sau:** vote nhóm, checklist, export PDF, bản đồ tương tác, weather-aware itinerary, gợi ý ưu đãi, album sau chuyến đi, gamification, chat assistant trong lúc đi.

**Không nên làm quá sớm:** marketplace booking đầy đủ, thanh toán phức tạp, social network du lịch, review system lớn, hệ thống điểm thưởng phức tạp, bán dữ liệu insight.

> **Retention = Chất lượng lịch trình + Khả năng chỉnh sửa + Giá trị trong lúc đi + Cá nhân hóa + Chia sẻ nhóm**

---

## 14. Lưu ý khi trình bày / demo

- Luôn làm rõ ranh giới giữa **những gì đã hoạt động thật** (flow UI/UX, mock data, localStorage) và **những gì sẽ triển khai ở giai đoạn sau** (backend .NET thật, PostgreSQL/PostGIS, AI API thật, admin dashboard đầy đủ).
- Nhấn mạnh nguyên tắc: **AI đề xuất, người dùng quyết định** — không để AI tự ý chốt lịch trình hoặc tự bịa địa điểm ngoài database đã chọn lọc.
- MVP **không cố bao phủ toàn bộ TP.HCM** — đây là lựa chọn có chủ đích để kiểm soát chất lượng dữ liệu, không phải giới hạn kỹ thuật.
- Metro số 1 là **trục ưu tiên**, không phải điều kiện bắt buộc cho mọi lịch trình.

---

## Kết luận

LocalMate AI nên được triển khai như một **AI trip planner có phạm vi rõ ràng**, không phải một siêu ứng dụng du lịch. MVP tập trung vào 6 nhóm chức năng cốt lõi: quản lý địa điểm, nhập nhu cầu, AI tạo lịch trình, hiển thị timeline, lưu/chia sẻ lịch trình và thu thập feedback. Các tính năng booking, thanh toán, marketplace, partner dashboard, social network hay mobile app nên để lại cho các phase sau — làm quá sớm sẽ khiến sản phẩm phình scope và team mất trọng tâm.
