# 🗻 Fuji Trip — jpn-trip-mgt

แอปวางแผนทริปญี่ปุ่นสำหรับเดินทางกลุ่ม: **แผนการเดินทาง · แผนที่ · ค่าใช้จ่าย · การเคลียร์ยอด** ในที่เดียว มีมาสคอตภูเขาไฟฟูจิ (ฟูจิคุณ), ธีมสว่าง/มืด และหิมะปลอม ๆ ❄️

> **โหมดตัวอย่าง (Demo Mode):** ถ้ายังไม่ตั้งค่า `.env` แอปจะทำงานด้วยข้อมูลจำลองในเครื่องทันที — ทริปตัวอย่าง `demo-tokyo` / PIN `1234` ไม่ต้องมี Firebase ก็ลองได้ทุกฟีเจอร์

---

## ✨ ฟีเจอร์

| ด้าน | รายละเอียด |
|---|---|
| ทริป | Trip Selector, สร้าง/แก้ไข/ลบทริป, สมาชิกทริป, ลิงก์เชิญ + PIN, นับถอยหลัง |
| ยืนยันตัวตน | ผู้ดูแล: Firebase Auth (email/password + custom claim `admin`) · สมาชิก: Anonymous Auth + PIN (เก็บ SHA-256 hash ใน `tripPrivate` ที่ client อ่านไม่ได้) |
| แผนการเดินทาง | Day tabs, Timeline, เวลาเริ่ม/ระยะเวลา, Drag & Drop จัดลำดับ, โน้ต, ค้นหาสถานที่ (OSM Nominatim) |
| Smart Scheduling | จัดเวลาให้กิจกรรมที่ยังไม่มีเวลาอัตโนมัติ, ตรวจ Time Conflict, เตือนช่วงเวลาเดินทางกระชั้น (คำนวณจากระยะทางจริง) |
| แผนที่ | Leaflet + OpenStreetMap (ไม่ต้องใช้ API Key), Marker แยกสีตามวัน, เส้นทาง, ปุ่มนำทาง Google Maps |
| ค่าใช้จ่าย | บันทึก/แก้ไข/ลบ, ตัวกรองตามคน/หมวด, แนบใบเสร็จ (ย่อรูปอัตโนมัติ เก็บใน Firebase Storage), แสดงบาทกำกับ |
| การแบ่งเงิน | หารเท่า / ยอดตามจริง / ส่วนแบ่ง (ถ่วงน้ำหนัก) / เปอร์เซ็นต์ — ปัดเป็นเยนเต็ม ผลรวมตรงพอดีเสมอ |
| เคลียร์ยอด | อัลกอริทึมโอนน้อยครั้งสุด (greedy), มาร์กสถานะจ่ายแล้ว (บันทึกร่วมกันทุกเครื่อง) |
| กราฟ | Chart.js — หมวดหมู่ (โดนัท), รายวัน (บาร์), รายบุคคล (จ่ายหน้า vs ควรจ่าย) |
| นำเข้า/ส่งออก | JSON (สำรอง/กู้คืนทั้งทริป), XLSX (5 ชีต), CSV (ค่าใช้จ่าย), PNG/PDF (แผนรายวัน) |
| การแจ้งเตือน | Fuji Toast, Alert/Confirm, Loading Overlay |
| ตั้งค่า | ธีม Dark/Light/System, หิมะ, อัตราแลกเปลี่ยน (ดึงอัตโนมัติจาก Frankfurter), ค่าธรรมเนียมบัตร, การ์ดที่แสดง, หมวดค่าใช้จ่าย |

## 🧰 เทคโนโลยี

- **Frontend:** Vite + Vanilla JavaScript (ES Modules) + CSS Variables — ไม่พึ่ง framework
- **Backend:** Firebase (Auth, Firestore, Storage, Hosting)
- **แผนที่:** Leaflet + OpenStreetMap (Nominatim สำหรับค้นหาสถานที่)
- **กราฟ:** Chart.js · **Excel:** SheetJS (xlsx) · **PDF:** jsPDF · **PNG:** html-to-image · **ไอคอน:** lucide (ไลบรารีเดียว)
- **ทดสอบ:** Vitest (unit) + @firebase/rules-unit-testing (Firestore Rules ผ่าน Emulator)
- **CI/CD:** GitHub Actions — ตรวจจำนวนไฟล์, lint, test, build, deploy

## 📁 โครงสร้างโปรเจกต์ (Compact — ทั้งหมด ≤ 100 ไฟล์)

```
├── .github/workflows/ci.yml   # File count check + Lint + Test + Rules + Build + Deploy
├── public/
│   ├── favicon.svg
│   └── fuji-mascot.svg        # Sprite ฟูจิคุณไฟล์เดียว (idle/happy/loading/warning/error)
├── src/
│   ├── styles/                # base / components / views (CSS Variables)
│   ├── app.js                 # เริ่มต้นระบบและ Application Lifecycle
│   ├── router.js              # Routing และ Navigation
│   ├── firebase-client.js     # Firebase Init + Client Services (เลือก demo อัตโนมัติ)
│   ├── store.js               # Global State และ Subscription
│   ├── auth.js                # Admin Login, Member PIN Login, Session + หน้า Login
│   ├── trips.js               # Trip Selector, Trip CRUD, สมาชิกทริป, Dashboard
│   ├── itinerary.js           # UI + CRUD แผนการเดินทาง (drag&drop, export)
│   ├── scheduling.js          # Smart Scheduling, Duration, Time Conflict (pure)
│   ├── maps.js                # Leaflet, Marker, Route, Navigation, Map Picker
│   ├── expenses.js            # Expense Form, List, Filter, Receipt
│   ├── expense-calculator.js  # Fee, Currency, Split Calculation (pure)
│   ├── settlement.js          # Settlement Algorithm + หน้าเคลียร์ยอด
│   ├── charts.js              # Chart.js ภาพรวมและรายบุคคล
│   ├── import-export.js       # CSV/XLSX/JSON/PNG/PDF
│   ├── notifications.js       # Fuji Toast, Alert, Loading
│   ├── settings.js            # Theme, Snow, Exchange Rate, Cards, Categories
│   ├── components.js          # Modal, Bottom Sheet, Tile, Chips, Avatar ฯลฯ
│   ├── utils.js               # Date/Timezone, Currency, Validation, DOM, CSV
│   └── demo-backend.js        # Backend จำลอง (localStorage) สำหรับโหมดตัวอย่าง
├── tests/
│   ├── unit/                  # calculator, settlement, scheduling, utils
│   └── rules/                 # Firestore Rules Tests (Emulator)
├── firebase.json · .firebaserc
├── firestore.rules · firestore.indexes.json · storage.rules
├── vite.config.js · eslint.config.js
├── .env.example               # เฉพาะ Placeholder — ห้ามใส่ค่าจริง
└── package.json
```

## 🚀 เริ่มต้นใช้งาน (Quick Start)

```bash
git clone <repo-url> && cd jpn-trip-mgt
npm ci                # ติดตั้งตาม lockfile
npm run dev           # รันที่ http://localhost:5173 — เข้าโหมดตัวอย่างได้ทันที
```

โหมดตัวอย่าง: กด "เข้าร่วมทริป" → รหัสทริป `demo-tokyo` PIN `1234` (หรือล็อกอินผู้ดูแลด้วยอีเมลอะไรก็ได้)

## 🔥 ตั้งค่า Firebase (ใช้งานจริง)

1. สร้าง Project ที่ [Firebase Console](https://console.firebase.google.com) → เพิ่ม Web App
2. เปิดใช้งาน:
   - **Authentication** → Sign-in method: **Email/Password** และ **Anonymous**
   - **Firestore Database** → Production mode
   - **Storage**
3. คัดลอกค่า config มาทำไฟล์ `.env` (ห้าม commit):

```bash
cp .env.example .env   # แล้วใส่ค่าจริงจาก Firebase Console
```

4. ตั้ง `project id` จริงใน `.firebaserc`
5. สร้างบัญชีผู้ดูแลใน Authentication แล้วให้สิทธิ์ด้วย custom claim (รันใน Cloud Shell / สคริปต์ Admin SDK):

```js
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.applicationDefault() });
admin.auth().setCustomUserClaims('<UID ผู้ดูแล>', { admin: true });
```

6. Deploy rules + Hosting:

```bash
npm run deploy   # = firebase deploy --only hosting,firestore:rules,storage
```

### Emulator (ทดสอบในเครื่อง)

```bash
npm run test:rules                       # รัน rules tests บน emulator (ต้องมี Java 21+)
firebase emulators:exec --only firestore --project fuji-rules-test "vitest run tests/rules"
firebase emulators:start                 # เปิด UI ที่ http://localhost:4000
# ในไฟล์ .env เพิ่ม VITE_USE_EMULATORS=true เพื่อเชื่อม dev server เข้า emulator
```

## 🧪 สคริปต์ทั้งหมด

| คำสั่ง | หน้าที่ |
|---|---|
| `npm run dev` | Dev server (Vite) |
| `npm run build` | Build production ไปที่ `dist/` |
| `npm run preview` | พรีวิวผล build |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |
| `npm run test:rules` | Firestore rules tests ผ่าน Emulator |
| `npm run test:all` | Lint + Unit + Rules |
| `npm run deploy` | Deploy Hosting + Rules + Storage rules |

## 🤖 GitHub Actions

Workflow `.github/workflows/ci.yml`:

1. **file-count** — ตรวจ `git ls-files` ถ้าเกิน **100 ไฟล์ = fail ทันที**, เกิน 80 = เตือน
2. **quality** — `npm ci` → lint → unit tests → **rules tests (Emulator)** → build production (+ artifact)
3. **deploy** — เมื่อ push/merge เข้า `main`: build แล้ว deploy ไป Firebase Hosting + rules

### GitHub Secrets ที่ต้องตั้ง

| Secret | ใช้ทำ |
|---|---|
| `FIREBASE_PROJECT_ID` | เลือก project ตอน deploy |
| `FIREBASE_SERVICE_ACCOUNT` | JSON ของ Service Account (สิทธิ์ Firebase Hosting Admin + Firestore/Storage rules deploy) |
| `VITE_FIREBASE_API_KEY` | ฝังเข้า build ของหน้าเว็บ |
| `VITE_FIREBASE_AUTH_DOMAIN` | เช่น `your_project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | project id |
| `VITE_FIREBASE_STORAGE_BUCKET` | เช่น `your_project.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | sender id |
| `VITE_FIREBASE_APP_ID` | app id |

> ใช้ Leaflet + OpenStreetMap จึง**ไม่ต้องมี** Secret สำหรับแผนที่ และค่า `VITE_FIREBASE_*` เป็น public config ของ Firebase (ความปลอดภัยอยู่ที่ Security Rules) — แต่ค่าอื่น ๆ ห้าม commit เด็ดขาด

## 🌿 Branch Strategy & Commit Convention

- `main` — production (deploy อัตโนมัติ) · `develop` — รวมงานก่อนขึ้น production
- `feature/*` — ฟังก์ชันใหม่ · `fix/*` — แก้บั๊ก
- ไม่ commit ตรงเข้า `main` ยกเว้นตั้งค่าเริ่มต้น/hotfix ที่อนุมัติแล้ว
- Conventional Commits เช่น `feat: add itinerary drag and drop`, `fix: settlement rounding`, `chore: configure GitHub Actions`

**เช็กลิสต์ก่อน Merge PR:** จำนวนไฟล์ ≤ 100 · test ผ่าน · build สำเร็จ · ไม่มี Secret/.env/Service Account/รูปใบเสร็จ · Firebase rules test ผ่าน · ไม่มี console error สำคัญ · mobile layout ใช้ได้

## 🔢 ข้อจำกัดจำนวนไฟล์ (สำคัญ)

Repository นี้จำกัดไฟล์ที่ Git ติดตาม **ไม่เกิน 100 ไฟล์** (เป้าหมาย ≤ 80) — ตรวจสอบก่อนอัปโหลดเสมอ:

```bash
# ===== คำสั่งตรวจสอบก่อนอัปโหลด GitHub =====
git ls-files | wc -l          # ต้อง ≤ 100 (เป้าหมาย ≤ 80)
git ls-files                  # ตรวจรายชื่อไฟล์ที่ track
npm ci                        # ติดตั้งสะอาดจาก lockfile
npm run lint                  # โค้ดผ่าน lint
npm test                      # unit tests ผ่าน
npm run build                 # build สำเร็จ
git status --porcelain        # ไม่มีไฟล์แปลกปลอม
grep -rn "AIza\|BEGIN PRIVATE KEY\|-----BEGIN" src/ --include="*.js" || echo "OK: ไม่พบ secret"
```

หากต้องเพิ่มไฟล์ใหม่: ตรวจจำนวนก่อน → รวมไฟล์หน้าที่ใกล้กันเข้า Domain เดิมก่อนสร้างไฟล์ใหม่ → **ห้าม**ลด Security/Validation/Test เพื่อรักษาจำนวนไฟล์ CI จะ fail ทันทีถ้าเกิน 100

## 🗃️ Data Model (Firestore)

```
trips/{tripId}                       # name, emoji, startDate, endDate, note, settings{fxRate,feePct,categories,cards}
trips/{tripId}/members/{uid|random}  # name, emoji, role, pinHash (เฉพาะเอกสารตัวเองตอน join)
trips/{tripId}/itinerary/{itemId}    # date, start, durationMin, title, category, placeName, lat, lng, note, order
trips/{tripId}/expenses/{id}         # title, category, date, amount(¥), paidBy, split{mode,members,values}, receiptUrl/Path
trips/{tripId}/settlements/{from__to}# from, to, amount, status(pending|paid), paidAt
tripPrivate/{tripId}                 # pinHash — client อ่านไม่ได้ ใช้ตรวจใน Security Rules เท่านั้น
Storage: receipts/{tripId}/{file}    # รูปใบเสร็จ (image/* < 5MB เฉพาะผู้ล็อกอิน)
```

**หลักความปลอดภัย:** PIN เก็บแบบ SHA-256 ใน `tripPrivate` ที่ rule ปิดการอ่าน — การ join ส่ง hash ไปเทียบใน rule (`get()` ฝั่ง server) · สมาชิกเห็น/แก้ได้เฉพาะทริปที่ join · list ทริปทั้งหมดสงวนให้ผู้ดูแล · ไม่มี Secret/PIN/รหัสผ่านใน repository · รูปใบเสร็จอยู่ใน Storage ไม่ได้อยู่ใน Git

> ข้อจำกัดที่ยอมรับไว้: ใครที่ "รู้ trip id" และล็อกอินแบบ anonymous จะอ่านชื่อ/วันที่ทริปได้ (เพื่อให้ join ด้วยลิงก์ได้โดยไม่ต้องมี Cloud Functions) — trip id ถูกสุ่มเดายาก และข้อมูลจริง (สมาชิก/แผน/ค่าใช้จ่าย) ต้องผ่าน PIN

## ✅ Acceptance Criteria

- [x] ไฟล์ที่ Git ติดตาม ≤ 100 (ตอนนี้ **43 ไฟล์** — ต่ำกว่าเป้า 80)
- [x] `node_modules`, `dist`, `.firebase`, emulator data ไม่ถูก commit (.gitignore)
- [x] ไม่มี `.env` ค่าจริง / Service Account / Password / PIN ใน repository
- [x] GitHub Actions ตรวจจำนวนไฟล์อัตโนมัติ (>100 fail, >80 warn)
- [x] GitHub Actions รัน lint + test + rules test + build และ deploy เมื่อ merge เข้า main
- [x] Clone ใหม่ → `npm ci` → `npm run build` ใช้ได้
- [x] Firebase Emulator เริ่มตามคู่มือได้ (`npm run test:rules`)
- [x] Source code แบ่งตาม Domain (ไม่ยัดทุกอย่างไว้ไฟล์เดียว)
- [x] README ครบ Setup / Test / Build / Deploy
