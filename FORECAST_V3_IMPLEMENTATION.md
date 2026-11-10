# Forecast v3 — Implementation Collision (BE / FE / DB / API)

**Status:** Target contract (greenfield — belum ada kode BE/FE/DB di repo)
**Snapshot:** 10 Nov 2026
**Referensi:** [`MASTER_BLUEPRINT.md`](./MASTER_BLUEPRINT.md) · [`FORECAST_V3_LOGIC.md`](./FORECAST_V3_LOGIC.md) · `proto/forecast-v3.html`
**Prinsip:** **design-first** — blueprint mengikuti design. Kalau implementasi butuh field/request/response baru, itu didaftarkan di sini, bukan diam-diam ditambahkan.
**Struktur repo:** **FE dan BE terpisah** (bukan monorepo). Engine dibagikan sebagai paket npm ber-versi. Lihat §1.

> ⚠️ Repo saat ini hanya berisi blueprint, prototype HTML, dan file desain. Dokumen ini adalah **kontrak target** untuk implementasi, bukan deskripsi kode yang sudah ada.

---

## 0. Ringkasan keputusan

| # | Topik | Keputusan | Konsekuensi |
|---|---|---|---|
| R1 | Jumlah tier | **6 tier**, termasuk `MINNOW` | Blueprint §3 di-update; response matrix wajib array |
| R5 | Filosofi input | **Design-first**: user pilih **budget tier**, optimizer pilih produk | `isMonthlyCardActive` & `monthlyHeadhuntingPacksToBuy` dihapus dari request/DB |
| R6 | SKU OP pack | **Ikuti design**: OP 130/66/40/20/6/1 (verified di app) | `pack_50_op` dihapus dari DTO; katalog jadi tabel |
| R20 | Current Pot | ~~DIHAPUS~~ — **dibatalkan oleh R23** | Pot kembali jadi input; lihat R23 |
| R23 | Current Potential | **DIPERTAHANKAN** — input `currentTargetPotential`, default `0`, diletakkan di **kiri** TARGET POTENTIAL | `requiredCopies = max(0, targetPotential − currentTargetPotential)`; 0 copy → semua tier `GUARANTEED` |
| R2 | Eligibility bulan berjalan | **Rekomendasi: satu toggle, default ON** (detail §2) | `routeSettings.monthlyEligibility` dipakai; UI satu toggle + sensitivity line |
| R16 | Green cert | **Rekomendasi: pakai toggle yang sama, tanpa input saldo green cert** | Tidak ada field baru; hint biaya 600 cert/bulan |
| R21 | Struktur repo | **FE dan BE repo terpisah** — tanpa monorepo/turborepo | Engine jadi paket npm ber-versi yang di-pin identik di kedua repo; deployment independen |
| R22 | Naming contract | **camelCase** untuk semua key JSON/TS/query | Key JSONB ikut camelCase; kolom fisik DB tetap snake_case (konvensi Postgres) — dipetakan di mapper (§5.0) |

**Yang harus kamu putuskan sekarang:** R2/R16 (saran ada di §2), dan 9 pertanyaan di §10.

---

## 1. Aturan main: design adalah sumber UX, engine adalah sumber angka

Karena R5 design-first, batas tanggung jawabnya jadi:

| Lapisan | Sumber kebenaran | Tidak boleh |
|---|---|---|
| UX / flow / label | `proto/forecast-v3.html` + `GameTracker.pen` | Blueprint mengubah flow tanpa redesign |
| Angka / aturan hitung | Engine (lihat `FORECAST_V3_LOGIC.md`) | FE menghitung ulang dengan rumus berbeda |
| Bentuk data | Dokumen ini | FE/BE menambah field liar |

**Konsekuensi arsitektural:** FE dan BE adalah **dua repo terpisah**, tapi engine tetap **satu paket TypeScript** yang dipakai keduanya (`@prts/forecast-engine`). Kalau FE dan BE punya implementasi sendiri, dalam 2 sprint angka pasti drift.

| Repo | Isi | Deploy |
|---|---|---|
| `prts-forecast-engine` | paket npm `@prts/forecast-engine`: rumus + tipe + Zod schema | publish ke GitHub Packages (private), tag `vX.Y.Z` |
| `prts-forecast-api` | NestJS + TypeORM + auth + share + BYOK | container (Fly/Railway/VPS) |
| `prts-forecast-web` | Next.js App Router UI + BFF proxy | Vercel / Node container |

```
prts-forecast-engine/
   ├─ src/economy.ts             (calendar, income, cert)
   ├─ src/basket.optimizer.ts    (optimizer, window)
   ├─ src/pity.dp.ts             (DP, sixStarProb, runPity)
   ├─ src/contract.ts            (ForecastInput/Response + Zod)
   └─ src/index.ts               (computeForecast(input) → ForecastResponse)

prts-forecast-web/  → dependency "@prts/forecast-engine": "1.2.0"   (pin exact)
prts-forecast-api/  → dependency "@prts/forecast-engine": "1.2.0"   (pin exact)
```

**Aturan versi:** kedua repo wajib memakai versi engine **sama persis** (tanpa `^`/`~`). Golden fixtures dijalankan di CI engine; setiap bump engine = bump kedua repo di PR terpisah. Tipe & Zod schema contract juga tinggal di paket ini, jadi FE/BE tidak pernah menyalin bentuk data.

**Yang tidak boleh terjadi:** path alias lintas repo, symlink `node_modules`, atau BE meng-import file FE. Semua komunikasi lewat HTTP + paket ber-versi.

---

## 2. Rekomendasi R2 + R16

### 2.1 R2 — eligibility bulan berjalan

**Rekomendasi: satu toggle di Step 02, default ON, dengan sensitivity line di Outlook.**

Alasan:

1. **Design-first.** Layar sekarang menghitung bulan berjalan. Kalau default diubah jadi OFF, hasil pertama user langsung lebih kecil dari yang dia lihat di design — membingungkan.
2. **Realita pemain.** Login permit dan green cert shop bulan berjalan hampir selalu diklaim pemain aktif.
3. **Tetap jujur.** Sembunyikan asumsi bukan solusi. Tampilkan dampaknya:

```
ASSUMPTIONS · Current month claimed ✓   (unclaimed: −6 pulls)
```

**Implementasi:**

- Request/DB: `routeSettings.monthlyEligibility` (3 flag, sudah ada di blueprint).
- UI: **satu** checkbox "Current month login + green cert claimed", default `true`. Dua flag lain (`assumeFutureMonthlyRewardsClaimed`) default `true` dan belum perlu UI.
- Engine: hitung `eligibleMonths` per sumber:

```ts
loginMonths = months.length - (includeCurrentMonthLoginPermit ? 0 : 1);
greenMonths = months.length - (includeCurrentMonthGreenCertShop ? 0 : 1);
```

- Response: tambah `assumptions[]` berisi delta, supaya UI bisa menampilkan “unclaimed: −6 pulls” tanpa request kedua.

**Delta per bulan yang dimatikan:** login permit `1` + green cert shop `(600 ORU / 600) + 4 permit` = **6 pull/bulan**.

### 2.2 R16 — green cert shop

**Rekomendasi: jangan tambah input saldo green cert. Pakai toggle R2 + hint biaya.**

Alasan:

- Menambah currency baru berarti: field inventory baru, validasi, UI baru, dan logika “cukup atau tidak” yang lebih rumit dari nilainya.
- Kebutuhan sebenarnya cuma biner: “bulan ini aku bisa beli green cert shop tier 1 atau tidak?”
- Toggle R2 sudah menjawab itu. Hint: *“Requires 600 green certs per month.”*

Kalau nanti terbukti perlu, field baru yang harus ditambahkan adalah `inventorySnapshot.currentGreenCerts` + logika konsumsi per bulan — **belum sekarang**.

### 2.3 Response `assumptions` (usulan)

```json
"assumptions": [
  { "key": "currentMonthClaimed", "value": true,  "pullsDeltaIfOff": -6 },
  { "key": "futureMonthsClaimed", "value": true,  "pullsDeltaIfOff": -18 },
  { "key": "annihilation1800",    "value": true,  "pullsDeltaIfOff": -39 }
]
```

> `currentMonthClaimed` adalah key **agregat untuk UI**; engine tetap memakai dua flag terpisah (`includeCurrentMonthLoginPermit`, `includeCurrentMonthGreenCertShop`). Delta di atas untuk window 90 hari / 13 weekly reset.

---

## 3. Canonical contract (design → TypeScript)

### 3.0 Konvensi nama (R22)

| Lapisan | Naming | Contoh |
|---|---|---|
| Request / response JSON | **camelCase** | `targetEndDate`, `opConversionPercentage` |
| Tipe TS + Zod schema | **camelCase** | `ForecastInput.routeSettings` |
| Key di dalam kolom JSONB | **camelCase** | `inventorySnapshot.hhTicket1x` |
| Kolom fisik DB (Postgres) | **snake_case** | `target_end_date`, `engine_version` |
| Query param / header | **camelCase** | `?includeAdvice=true` |

Alasan kolom DB tetap snake_case: identifier tanpa quote di Postgres otomatis di-lowercase, jadi camelCase kolom harus selalu di-quote (`"targetEndDate"`) dan bikin migration/psql manual rawan. Konversi dilakukan **satu tempat** di mapper BE (`forecast.mapper.ts`), bukan tersebar. Kontrak yang dilihat FE, share link, dan konsumen API tetap 100% camelCase.

### 3.1 `ForecastInput`

```ts
export type BannerArchetype = 'LIMITED' | 'EVENT' | 'STANDARD' | 'CROSSOVER' | 'KERNEL';
export type TargetMode = 'pulls' | 'potential';
export type Availability = 'FEATURED' | 'OFF_BANNER' | 'ABSENT';
export type TierKey = 'F2P' | 'MINNOW' | 'GOLDFISH' | 'DOLPHIN' | 'WHALE' | 'LEVIATHAN';

export interface ForecastInput {
  // ── Step 01 · TARGET ─────────────────────────────
  bannerArchetype: BannerArchetype;
  targetEndDate: string;              // 'YYYY-MM-DD', cutoff Asia/Jakarta
  targetMode: TargetMode;

  targetPulls: number;                // 1..2000 (mode pulls)
  currentTargetPotential: number;     // 0..6, default 0 = belum dimiliki
  targetPotential: number;            // 1..6 = pot yang ingin dicapai

  targetAvailability: Availability;
  targetSixStarProbability: number;   // 0..1
  confidenceTarget: 0.5 | 0.8 | 0.9 | 0.95;

  // ── Step 02 · RESOURCES ──────────────────────────
  inventorySnapshot: {
    orundum: number;
    originitePrime: number;
    hhTicket1x: number;
    hhTicket10x: number;
    currentYellowCerts: number;
    currentShopTierCleared: number;   // 0..5
    currentPity: number;              // 0..98
  };

  // ── Step 02 · ROUTE ──────────────────────────────
  routeSettings: {
    opConversionPercentage: number;   // 0..100
    expectedAnnihilationClear: number;// 0..1800, default 1800
    monthlyEligibility: {
      includeCurrentMonthLoginPermit: boolean;
      includeCurrentMonthGreenCertShop: boolean;
      assumeFutureMonthlyRewardsClaimed: boolean;
    };
    leviathanPacks: {                 // hanya dipakai tier LEVIATHAN
      op130: number; op66: number; op40: number; op20: number;
      op6: number; op1: number;
    };
  };

  // ── Step 03/04 · VIEW ────────────────────────────
  selectedTier: TierKey;
}
```

**Catatan:** `selectedTier` **tidak** mempengaruhi hasil hitung; hanya memilih tier yang di-inspect. Tetap disimpan supaya saved/share link membuka tier yang sama.

**Catatan nama produk:** `leviathanPacks` memakai key SKU (`op130`…`op1`) yang sama dengan `shopProducts[].id`. ID produk adalah **data**, bukan key kontrak — tetap pendek dan ikut camelCase (`monthlyCard`, `hhPack`, `op20`).

### 3.2 `ForecastResponse`

```ts
export type TierStatus = 'GUARANTEED' | 'FEASIBLE' | 'LIKELY' | 'DEFICIT';

export interface BreakdownLine {
  key: 'farming' | 'login' | 'green' | 'inventory' | 'inventoryOp'
     | 'card' | 'hhPack' | 'opPacks' | 'certs' | 'archetypeBonus';
  label: string;
  meta: string;
  pulls: number;
  kind: 'recurring' | 'oneTime' | 'paid';
}

export interface BasketItem {
  productId: string;
  name: string;
  qty: number;
  priceUsd: number;
}

export interface TierResult {
  key: TierKey;
  name: string;
  rule: string;                 // '$5–$30/mo'
  capUsd: number;
  colorToken: string;

  status: TierStatus;
  totalPulls: number;
  deltaPulls: number;           // total - benchmark (positif = surplus)
  probabilityAtTotal: number;   // P(TARGET)
  chanceTargetCopy: number;     // P(>=1 copy)
  expectedCopies: number;
  sparkCopies: number;

  monthlySpendUsd: number;
  monthlyPulls: number;
  basket: BasketItem[];
  breakdown: BreakdownLine[];

  isSelected: boolean;
  isStart: boolean;             // tier clearing pertama
}

export interface ForecastResponse {
  status: 'success';
  engineVersion: string;

  target: {
    bannerArchetype: BannerArchetype;
    targetEndDate: string;
    daysRemaining: number;
    weeksRemaining: number;
    targetMode: TargetMode;
    benchmarkPulls: number;
    requiredTargetCopies: number;
    confidenceTarget: number;
    probabilityGivenSixStar: number;
    startPity: number;
    horizon: number;
  };

  matrix: TierResult[];         // selalu 6, urut F2P → LEVIATHAN

  pity: {
    chanceAnySixStar: number;           // P(≥1 6★) pada pull count tier aktif
    chanceTargetCopy: number;           // P(≥1 copy) pada tier aktif
    probabilityAtConfidence: number;    // P(TARGET) tier aktif vs confidence
    requiredPullsAtConfidence: number | null; // global
    expectedCopies: number;             // tier aktif
    notes: string[];
  };

  assumptions: { key: string; value: boolean; pullsDeltaIfOff: number }[];
  advice: { text: string; source: 'local' | 'llm' };
}
```

> **Kenapa `matrix` array, bukan object?** Object dengan key tier memaksa FE tahu semua key, dan menambah `MINNOW` jadi breaking change diam-diam. Array + `key` lebih tahan perubahan.

---

## 4. Backend (NestJS) collision

### 4.1 Penempatan domain

Karena repo terpisah, rumus **tidak** tinggal di BE. BE mengonsumsi paket engine.

```
# Repo prts-forecast-engine (paket, tanpa I/O)
src/
  ├─ contract.ts                    (ForecastInput/Response + Zod)
  ├─ economy.ts                     (calendar, income)
  ├─ basket.optimizer.ts            (best-value fill)
  ├─ pity.dp.ts                     (runPity, sixStarProb)
  └─ index.ts                       (computeForecast(input) → ForecastResponse)
seed/
  ├─ archetypes.ts                  (fallback seed, di-baca dari DB)
  ├─ tiers.ts                       (fallback seed)
  └─ products.ts                    (fallback seed)

# Repo prts-forecast-api (NestJS)
src/domains/forecast
  ├─ forecast.controller.ts         (POST /api/v1/forecast)
  ├─ forecast.service.ts            (computeForecast + orkestrasi response)
  ├─ forecast.dto.ts                (Zod schema dari engine)
  ├─ forecast.mapper.ts             (DTO camelCase ↔ entity snake_case)
  ├─ forecast-session.service.ts    (save/list/delete)
  └─ forecast-share.service.ts      (slug, snapshot, expiry)
src/infrastructure
  ├─ database/                      (TypeORM module, migrations, entities)
  ├─ auth/                          (JWT double token + Google OAuth)
  └─ llm-adapter/                   (game-agnostic LLM caller)
```

**Aturan:** paket engine tidak boleh import Nest DI, HTTP, TypeORM, atau `pg`. Murni fungsi + tipe + Zod. BE tidak boleh menyalin rumus, dan FE tidak boleh memanggil DB.

### 4.2 Endpoint

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| `POST` | `/api/v1/forecast` | publik | Hitung (dipakai preview & share build) |
| `POST` | `/api/v1/forecasts` | wajib | Simpan session |
| `GET` | `/api/v1/forecasts` | wajib | List session user |
| `GET` | `/api/v1/forecasts/:id` | wajib | Detail + re-compute |
| `PATCH` | `/api/v1/forecasts/:id` | wajib | Update input |
| `DELETE` | `/api/v1/forecasts/:id` | wajib | Hapus |
| `POST` | `/api/v1/shares` | wajib | Buat share (slug + expiry + snapshot) |
| `GET` | `/api/v1/shares/:slug` | publik | Snapshot read-only |
| `POST` | `/api/v1/ai-keys/validate` | wajib | Handshake BYOK |
| `POST` | `/api/v1/advice` | wajib + BYOK | PRTS LLM advice |

**Cross-origin:** FE (mis. `prts.app`) dan BE (`api.prts.app`) beda origin. BE wajib allowlist origin FE + `credentials: true` untuk refresh cookie; jangan `*`. Alternatif yang lebih aman: semua call client lewat BFF Next (`/api/*`) sehingga cookie tetap same-origin dan BE tidak perlu diekspos ke browser.

### 4.3 Validasi (Zod) — ringkas

| Field | Aturan | Pesan |
|---|---|---|
| `targetEndDate` | `YYYY-MM-DD`, ≥ hari ini (Asia/Jakarta) | “End date must be today or later.” |
| `targetPulls` | int 1..2000 | clamp |
| `currentTargetPotential` | int 0..6, default 0 | 0 = belum dimiliki |
| `targetPotential` | int 1..6 (pot yang ingin dicapai) | enum |
| `targetSixStarProbability` | 0..1 | ABSENT → paksa 0 |
| `confidenceTarget` | enum 0.5/0.8/0.9/0.95 | — |
| `currentPity` | int 0..98 | isolated → diabaikan engine |
| `opConversionPercentage` | int 0..100 | — |
| `leviathanPacks.*` | int 0..99 | hanya LEVIATHAN |
| `selectedTier` | enum 6 tier | default WHALE |
| `inventorySnapshot.*` | int ≥ 0 | — |

**Cross-field rules:**

1. `targetAvailability === 'ABSENT'` → `targetSixStarProbability = 0`, spark & guarantee off.
2. `bannerArchetype` isolated → `startPity = 0` (input tetap disimpan).
3. `requiredCopies = max(0, targetPotential − currentTargetPotential)` (R23); kalau hasilnya 0 → semua tier `GUARANTEED` tanpa pull.
4. `targetMode === 'pulls'` → badge pakai `total >= targetPulls`, bukan confidence.
5. `leviathanPacks` diabaikan untuk tier selain LEVIATHAN.

### 4.4 Alur service

```ts
compute(input: ForecastInput) {
  const cal      = calendarInfo(now(), input.targetEndDate);           // Asia/Jakarta
  const arch     = archetypes[input.bannerArchetype];
  const avail    = input.targetAvailability;
  const required = max(0, input.targetPotential - input.currentTargetPotential); // R23
  const probT    = resolveProbTarget(input, arch);  // ABSENT→0, pulls→rateUp
  const startPity= arch.isolated ? 0 : min(98, input.inventorySnapshot.currentPity);
  const spark    = arch.spark && avail !== 'ABSENT' ? {...} : null;

  const lines    = economyLines(input, cal);        // one-time + recurring
  const tiers    = tierProfiles.map(t => {
    const basket = t.key === 'LEVIATHAN'
      ? addPacks(optimizeBasket(t.capUsd, opPct), input.routeSettings.leviathanPacks, opPct)
      : optimizeBasket(t.capUsd, opPct);
    const window = expandBasket(basket, cal.days, opPct);
    return assembleTier(t, lines, window);
  });

  const horizon  = min(900, max(350, ceil(maxTotal) + 40));
  const dp       = runPity({ required, probTarget: probT, startPity, spark,
                             guaranteeAt: avail === 'ABSENT' ? null : arch.guaranteeAt, maxPulls: horizon });
  // ...status, benchmark, reqPulls, minTier
}
```

**Performa:** DP berjalan **sekali** per request, bukan per tier. Enam tier hanya meng-index `dp.success[min(total, horizon)]`. Estimasi < 10 ms.

---

## 5. Database collision

### 5.0 Aturan naming di lapisan ini

Entity TypeORM = **bentuk baris DB**, jadi properti & kolomnya snake_case (konvensi Postgres). Kontrak (request/response/JSONB/Zod) = camelCase. Konversi hanya di `forecast.mapper.ts`:

```ts
// entity → response
bannerArchetype: row.target_banner_type,
targetEndDate:  row.target_end_date,
engineVersion:  row.engine_version,
```

Kolom `jsonb` menyimpan payload contract apa adanya, jadi **key di dalamnya camelCase**: `inventorySnapshot`, `routeSettings`, `monthlyEligibility`, `leviathanPacks`.

### 5.1 Entity diff — `forecast_sessions`

| Field (DB) | Blueprint | Design/prototype | Aksi | Alasan |
|---|---|---|---|---|
| `target_potential` | int nullable | **1..6 = pot yang ingin dicapai** | **CHANGE** → smallint NOT NULL default 1 | design selalu punya nilai |
| `current_target_potential` | di dalam `target_probability_profile` | field terpisah (`state.curPot`), default 0 | **MOVE + KEEP** → smallint NOT NULL default 0 | R23: current pot dibutuhkan lagi; UI di kiri target |
| `target_availability` | di dalam profile | field terpisah | **MOVE** → enum top-level | queryable, validasi mudah |
| `target_six_star_probability` | di dalam profile | field terpisah (`prob`) | **MOVE** → numeric(4,3) | idem |
| `confidence_target` | di profile **dan** response `target_info` | satu nilai | **MOVE + DEDUPE** → kolom top-level | hilangkan duplikasi |
| `target_pulls` | **tidak ada di request** | ada (`targetPulls`) | **ADD** → smallint default 300 | bug blueprint |
| `selected_tier` | tidak ada | ada (`state.selected`) | **ADD** → varchar(16) default `WHALE` | simpan pilihan inspect |
| `routeSettings.leviathanPacks` (jsonb) | `opPacksToBuy` (Record) | `state.levi` 4 SKU | **RENAME** key di dalam jsonb | hanya LEVIATHAN, 4–6 SKU |
| `target_end_date` | `timestamptz` | date-only DMY | **CHANGE** → `date` | hindari drift timezone |
| `routeSettings.isMonthlyCardActive` | ada | **tidak ada** (diturunkan optimizer) | **DROP** | R5 |
| `routeSettings.monthlyHeadhuntingPacksToBuy` | ada | **tidak ada** | **DROP** | R5 |
| `routeSettings.opPacksToBuy` | ada | diganti `leviathanPacks` | **DROP** | R5/R6 |
| `routeSettings.opConversionPercentage` | camelCase | `opPct` (nama variabel prototype) | **KEEP camelCase**, jangan di-snake_case | R22: kontrak camelCase; `opPct` cuma variabel lokal |
| `routeSettings.expectedAnnihilationClear` | ada | hardcode 1800 | **KEEP** (opsional) | future-proof |
| `routeSettings.monthlyEligibility` | ada | diasumsikan ON | **KEEP** + default ON | R2 |
| `engine_version` | tidak ada | — | **ADD** | reproducibility |
| `config_version` | tidak ada | — | **ADD** | reproducibility |
| `updated_at` | tidak ada | — | **ADD** | edit session |

### 5.2 Entity `forecast_sessions` (target)

```ts
@Entity('forecast_sessions')
export class ForecastSession {
  @PrimaryGeneratedColumn('uuid') id: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' }) user: User | null;

  @Column({ default: 'arknights' }) game_id: string;
  @Column({ default: 'PRTS Operation Forecast' }) session_name: string;

  @Column({ type: 'enum', enum: ['LIMITED','EVENT','STANDARD','CROSSOVER','KERNEL'] })
  target_banner_type: string;

  @Column({ type: 'date' }) target_end_date: string;

  @Column({ type: 'enum', enum: ['pulls','potential'], default: 'potential' })
  target_mode: string;

  @Column({ type: 'smallint', default: 300 }) target_pulls: number;
  @Column({ type: 'smallint', default: 1 })   target_potential: number;
  @Column({ type: 'smallint', default: 0 })   current_target_potential: number;

  @Column({ type: 'enum', enum: ['FEATURED','OFF_BANNER','ABSENT'], default: 'FEATURED' })
  target_availability: string;

  @Column({ type: 'numeric', precision: 4, scale: 3, default: 0.35 })
  target_six_star_probability: string;

  @Column({ type: 'numeric', precision: 3, scale: 2, default: 0.9 })
  confidence_target: string;

  @Column({ type: 'jsonb' }) inventory_snapshot: InventorySnapshot;

  @Column({ type: 'jsonb' }) route_settings: RouteSettings;

  @Column({ type: 'varchar', length: 16, default: 'WHALE' }) selected_tier: string;

  @Column({ type: 'varchar', length: 20 }) engine_version: string;
  @Column({ type: 'varchar', length: 20 }) config_version: string;

  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
```

```ts
// Bentuk jsonb di DB — key WAJIB camelCase (ini payload contract, bukan kolom)
export interface RouteSettings {
  opConversionPercentage: number;      // 0..100
  expectedAnnihilationClear: number;   // 0..1800
  monthlyEligibility: {
    includeCurrentMonthLoginPermit: boolean;
    includeCurrentMonthGreenCertShop: boolean;
    assumeFutureMonthlyRewardsClaimed: boolean;
  };
  leviathanPacks: {
    op130: number; op66: number; op40: number; op20: number;
    op6: number; op1: number;
  }; // LEVIATHAN only
}

export interface InventorySnapshot {
  orundum: number;
  originitePrime: number;
  hhTicket1x: number;
  hhTicket10x: number;
  currentYellowCerts: number;
  currentShopTierCleared: number;
  currentPity: number;
}
```

### 5.3 `forecast_sessions_share` — tambah snapshot

Design bilang share **“frozen at deploy time”**. Kalau share me-recompute dari input, hasil bisa berubah saat konstanta di-update. Jadi snapshot wajib.

| Field | Aksi | Catatan |
|---|---|---|
| `snapshot` | **ADD** jsonb | isi `ForecastResponse`, **tanpa** inventory/BYOK |
| `created_at` | **ADD** | audit |
| `expires_at` | KEEP | `null` = permanent (7/30/permanent sesuai design) |
| `share_slug` | KEEP | **perkuat** jadi ≥10 char base62 (prototype cuma 4 hex = 16 bit) |
| `views_count` | KEEP | — |

### 5.4 Tabel baru

#### `shop_products`

Katalog sekarang hardcode di prototype. R6 bilang ikuti SKU yang sudah diverifikasi — jadi harus data, bukan kode.

```ts
@Entity('shop_products')
export class ShopProduct {
  @PrimaryColumn({ type: 'varchar', length: 32 }) id: string;   // 'op20', 'monthlyCard' (id = data, camelCase)
  @Column() name: string;
  @Column({ type: 'enum', enum: ['op','monthly_card','hh_pack','starter','event'] })
  category: string;
  @Column({ type: 'int' }) price_cents: number;
  @Column({ type: 'int', default: 0 }) op: number;
  @Column({ type: 'int', default: 0 }) orundum: number;
  @Column({ type: 'int', default: 0 }) hh_permits: number;
  @Column({ type: 'int', default: 0 }) ten_permits: number;
  @Column({ default: false }) recurring: boolean;
  @Column({ type: 'int', nullable: true }) cycle_days: number | null;
  @Column({ type: 'int', default: 0 }) first_time_op: number;        // disimpan, TIDAK dipakai optimizer
  @Column({ type: 'numeric', precision: 6, scale: 3, default: 0 })
  first_time_pulls: string;                                          // idem
  @Column({ default: true }) is_active: boolean;
  @Column({ type: 'smallint', default: 0 }) sort_order: number;
}
```

#### `banner_archetypes`

```ts
@Entity('banner_archetypes')
export class BannerArchetype {
  @PrimaryColumn({ type: 'varchar', length: 16 }) key: string;
  @Column() name: string;
  @Column({ type: 'numeric', precision: 4, scale: 2 }) rate_up: string;
  @Column({ default: false }) isolated: boolean;
  @Column({ type: 'int', nullable: true }) spark: number | null;
  @Column({ type: 'int', nullable: true }) guarantee_at: number | null;
  @Column({ type: 'int', default: 0 }) free_pulls: number;
  @Column({ type: 'text' }) description: string;
  @Column({ default: true }) is_active: boolean;
}
```

#### `tier_profiles`

```ts
@Entity('tier_profiles')
export class TierProfile {
  @PrimaryColumn({ type: 'varchar', length: 16 }) key: string;  // F2P..LEVIATHAN
  @Column() name: string;
  @Column() rule: string;                                        // display '$10–$29.99/mo'
  @Column({ type: 'numeric', precision: 8, scale: 2 }) cap_usd: string;
  @Column({ type: 'varchar', length: 24 }) color_token: string;  // '--goldfish'
  @Column({ default: false }) allows_custom_packs: boolean;      // true hanya LEVIATHAN
  @Column({ type: 'smallint' }) sort_order: number;              // 1..6
  @Column({ default: true }) is_active: boolean;
}
```

### 5.5 Seed

**Tier (urut):**

| sort | key | cap_usd | rule | custom packs |
|---|---|---|---|---|
| 1 | F2P | 0 | `$0/mo · NATURAL ONLY` | no |
| 2 | MINNOW | 4.99 | `$0–$4.99/mo` | no |
| 3 | GOLDFISH | 29.99 | `$5–$29.99/mo` | no |
| 4 | DOLPHIN | 99.99 | `$30–$99.99/mo` | no |
| 5 | WHALE | 499.99 | `$100–$499.99/mo` | no |
| 6 | LEVIATHAN | 500.00 | `$500+/mo · CUSTOM OP` | **yes** |

**Archetype:** LIMITED (0.70, isolated, spark 300, free 24), EVENT (0.50, guarantee 150), STANDARD (0.50), CROSSOVER (1.00, isolated, spark 120), KERNEL (0.50).

**Produk (verified per R6):** `op1/6/20/40/66/130`, `monthlyCard`, `hhPack`. `starter*` disimpan `is_active=false` karena optimizer tidak memakainya.

**Config (`game_configs`)** — `configKey` adalah data contract, jadi camelCase:

| configKey | configValue |
|---|---|
| `pullCost` | `600` |
| `opToOrundumRatio` | `180` |
| `cycleDays` | `30` |
| `certTiers` | `[{tier:1,cost:10,pulls:1},{tier:2,cost:18,pulls:2},{tier:3,cost:40,pulls:5},{tier:4,cost:70,pulls:10},{tier:5,cost:120,pulls:20}]` |
| `horizon` | `{min:350,max:900,margin:40}` |
| `defaults` | `{confidence:0.9, opConversionPercentage:100, expectedAnnihilationClear:1800}` |

### 5.6 Constraint & index

```sql
ALTER TABLE forecast_sessions
  ADD CONSTRAINT pot_range CHECK (target_potential BETWEEN 1 AND 6),
  ADD CONSTRAINT current_pot_range CHECK (current_target_potential BETWEEN 0 AND 6),
  ADD CONSTRAINT pulls_range CHECK (target_pulls BETWEEN 1 AND 2000),
  ADD CONSTRAINT pity_range CHECK ((inventory_snapshot->>'currentPity')::int BETWEEN 0 AND 98),
  ADD CONSTRAINT prob_range CHECK (target_six_star_probability BETWEEN 0 AND 1),
  ADD CONSTRAINT conf_enum CHECK (confidence_target IN (0.5,0.8,0.9,0.95));

CREATE INDEX idx_sessions_user_created ON forecast_sessions (user_id, created_at DESC);
CREATE INDEX idx_share_expiry ON forecast_sessions_share (expires_at)
  WHERE expires_at IS NOT NULL;
CREATE INDEX idx_products_active ON shop_products (is_active, sort_order);
```

### 5.7 Urutan migrasi

1. Buat tabel baru (`shop_products`, `banner_archetypes`, `tier_profiles`) + seed.
2. `ALTER forecast_sessions`: tambah kolom baru (nullable dulu).
3. Backfill dari `target_probability_profile` → kolom top-level; `route_settings.opPacksToBuy` → `route_settings.leviathanPacks` (key jsonb camelCase).
4. Set NOT NULL + default + constraint.
5. Drop kolom usang (`isMonthlyCardActive`, `monthlyHeadhuntingPacksToBuy`, `opPacksToBuy`, `target_probability_profile`).
6. `ALTER forecast_sessions_share`: tambah `snapshot`, `created_at`.
7. Backfill `engine_version`/`config_version` untuk row lama dengan versi saat migrasi.

---

## 6. API collision

### 6.1 Request — v1 → v2

| v1 field (legacy) | v2 field (camelCase) | Aksi | Catatan |
|---|---|---|---|
| `game_id` | `gameId` | RENAME | default `arknights` |
| `target_banner_type` | `bannerArchetype` | RENAME | konsisten dengan input |
| `target_end_date` (ISO Z) | `targetEndDate` (`YYYY-MM-DD`) | **CHANGE FORMAT** | cutoff Asia/Jakarta |
| `target_mode` | `targetMode` | KEEP | |
| `target_potential` | `targetPotential` | KEEP | arti berubah: pot yang ingin dicapai, bukan jumlah copy |
| `target_probability_profile.current_target_potential` | `currentTargetPotential` | MOVE (KEEP) | R23: default 0, diletakkan di kiri target potential |
| `target_probability_profile.availability` | `targetAvailability` | MOVE | flatten |
| `target_probability_profile.target_six_star_probability` | `targetSixStarProbability` | MOVE | flatten |
| `target_probability_profile.confidence_target` | `confidenceTarget` | MOVE | flatten |
| — | `targetPulls` | **ADD** | hilang di v1 |
| — | `selectedTier` | **ADD** | UI state |
| `inventory_snapshot.*` | `inventorySnapshot.*` | RENAME | key dalam jadi camelCase |
| `route_settings.isMonthlyCardActive` | — | **DROP** | R5 |
| `route_settings.monthlyHeadhuntingPacksToBuy` | — | **DROP** | R5 |
| `route_settings.opConversionPercentage` | `routeSettings.opConversionPercentage` | RENAME (container) | key tetap camelCase (R22) |
| `route_settings.expectedAnnihilationClear` | `routeSettings.expectedAnnihilationClear` | RENAME (container) | optional, default 1800 |
| `route_settings.monthlyEligibility` | `routeSettings.monthlyEligibility` | RENAME (container) | default true |
| `route_settings.opPacksToBuy` | `routeSettings.leviathanPacks` | REPLACE | 6 SKU, LEVIATHAN only |
| `requestPrtsSummary` | `requestAdvice` | RENAME | `true` = minta LLM summary; local advice selalu ada |

### 6.2 Response — v1 → v2

| v1 field (legacy) | v2 field (camelCase) | Aksi | Catatan |
|---|---|---|---|
| `target_info.evaluated_target_pulls` | `target.benchmarkPulls` | RENAME | makna beda per mode |
| `target_info.days_remaining/weeks_remaining` | `target.daysRemaining` / `weeksRemaining` | RENAME | |
| `target_info.required_target_copies` | `target.requiredTargetCopies` | RENAME | |
| `target_info.confidence_target` | `target.confidenceTarget` | KEEP (dedupe) | |
| — | `target.startPity`, `target.horizon`, `target.probabilityGivenSixStar` | **ADD** | transparansi |
| `pity_estimation.chance_any_6star` | `pity.chanceAnySixStar` | RENAME | |
| `pity_estimation.chance_rateup_6star` | `pity.chanceTargetCopy` | RENAME | design: “CHANCE TARGET COPY” |
| `pity_estimation.notes` (string) | `pity.notes` (string[]) | **CHANGE TYPE** | design menampilkan beberapa catatan |
| — | `pity.probabilityAtConfidence`, `pity.requiredPullsAtConfidence`, `pity.expectedCopies` | **ADD** | `P(REACH x%)`, `PULLS @ CONF` |
| `potential_estimation.*` | — | **FOLD** ke `target` + `pity` | duplikasi |
| `potential_estimation.status` | `matrix[].status` | MOVE | status sekarang per tier |
| `calculation_matrix` (object) | `matrix` (array) | **CHANGE SHAPE** | 6 tier + MINNOW |
| `calculation_matrix.*.isFeasible` | `matrix[].status` | REPLACE | 4 status |
| `calculation_matrix.*.deficit_pulls/surplus_pulls` | `matrix[].deltaPulls` | MERGE | satu angka bertanda |
| `calculation_matrix.*.breakdown` (4 key) | `matrix[].breakdown[]` | **CHANGE SHAPE** | 10 baris design |
| — | `matrix[].monthlySpendUsd`, `monthlyPulls`, `basket[]` | **ADD** | design kartu |
| — | `matrix[].probabilityAtTotal`, `chanceTargetCopy`, `expectedCopies`, `sparkCopies` | **ADD** | design |
| `prtsTacticalAdvice` | `advice.{text,source}` | **CHANGE SHAPE** | source: local/llm |
| — | `assumptions[]` | **ADD** | R2/R16 transparency |
| — | `engineVersion` | **ADD** | audit |

### 6.3 Yang tidak relevan & yang konflik (ringkas)

**TIDAK RELEVAN — hapus:**

1. `routeSettings.isMonthlyCardActive` — optimizer yang memutuskan.
2. `routeSettings.monthlyHeadhuntingPacksToBuy` — idem.
3. `routeSettings.opPacksToBuy` — hanya LEVIATHAN, diganti `leviathanPacks`.
4. `pityEstimation.chanceRateupSixStar` — design menampilkan target copy.
5. `potentialEstimation.status` — status per tier.
6. `targetInfo.confidenceTarget` duplikat.
7. `banners.metadata.rateUpChance` sebagai input engine — hanya info archetype.
8. `users.passwordHash` — design hanya Google SSO (biarkan nullable, jangan dihapus dulu).

**KONFLIK — wajib diubah:**

1. Tier 5 vs **6** → `matrix` array.
2. Breakdown 4 key vs **10 baris** → array `BreakdownLine`.
3. `targetEndDate` timestamptz vs **date-only DMY** → `date` + Asia/Jakarta.
4. `currentTargetPotential` **dikembalikan** (R23) sebagai input top-level default 0; `requiredCopies = max(0, targetPotential − currentTargetPotential)`.
5. `isFeasible` boolean vs **4 status** → enum + `deltaPulls`.
6. `targetPulls` tidak ada di request v1 → tambah.
7. `selectedTier` tidak ada di request/DB → tambah.
8. `evaluatedTargetPulls` bermakna beda per mode → rename `benchmarkPulls`.
9. SKU `pack_50_op` vs design 130/66/40/20/6/1 → ikut design (R6).
10. `confidenceTarget` di dua tempat → satu sumber.

**FIELD BARU — daftar lengkap:**

*Request:* `targetPulls`, `selectedTier`, `currentTargetPotential`, `targetAvailability`, `targetSixStarProbability`, `confidenceTarget`, `routeSettings.leviathanPacks`, `routeSettings.monthlyEligibility`.

*Response:* `matrix[]` (status, delta, prob, chance, expected, monthly spend/pulls, basket, breakdown), `target.benchmarkPulls/startPity/horizon/probabilityGivenSixStar`, `pity.*` tambahan, `assumptions[]`, `engineVersion`, `advice.source`.

*DB:* `selected_tier`, `leviathanPacks` (key jsonb), `engine_version`, `config_version`, `updated_at`, `target_pulls`, kolom top-level pot/availability/prob/confidence, `share.snapshot`, `share.created_at`, 3 tabel baru.

### 6.4 Versioning

Karena ini breaking besar dan belum ada konsumen, **jangan** pertahankan v1. Langsung v2 di path yang sama (`/api/v1/forecast` tetap, tapi shape baru) dan catat di changelog API. Kalau nanti ada mobile client, baru bikin `/api/v2`.

---

## 7. Frontend (Next.js) collision

Repo: `prts-forecast-web` (Next.js App Router). Semua pemanggilan BE lewat BFF route handler di repo ini, jadi browser tidak pernah tahu URL internal BE.

### 7.1 State prototype → store production

| Prototype | Production | Catatan |
|---|---|---|
| `state.arch/endDate/mode/...` (input) | `useForecastDraft` (Zustand + localStorage) | versi draft + migrasi |
| `state.step` | `useForecastUI` atau URL `?step=3` | jangan masuk DB |
| `state.selected` | `useForecastUI` + masuk request | persist di session |
| `state.signedIn` | NextAuth session | bukan state forecast |
| `state.shareDur` | modal state lokal | dikirim saat `POST /shares` |
| `view` hasil `compute()` | TanStack Query (`useForecast`) atau `useMemo` engine | **jangan** simpan di Zustand |
| `window.__PRTS__` | dihapus dari production | dev-only |

**Aturan:** input disimpan, output dihitung. Jangan pernah menyimpan `view` ke store persisten — bisa basi saat konstanta berubah.

### 7.2 Design surface → component

| Blok design | Komponen | Data |
|---|---|---|
| `StepperNav` 01–04 | `<StepperNav>` | `step`, `STEP_NAMES` |
| Pane 01 | `<StepTarget>` | `ForecastInput` target fields |
| Pane 02 | `<StepResources>` | inventory + route |
| Pane 03 | `<StepMatrix>` + `<TierCard>` | `response.matrix` |
| Pane 04 | `<StepOutlook>` + `<TierPill>` + `<BreakdownPanel>` + `<PityGrid>` + `<AdviceTerminal>` | `response`, `selectedTier` |
| Sticky bar | `<FlowBar>` | `step`, `onBack/onNext/onSave/onShare` |
| Auth modal | `<AuthModal>` | NextAuth |
| Share modal | `<ShareModal>` | `shareDur`, slug |
| Leviathan panel | `<LeviathanPanel>` | hanya saat `selectedTier === 'LEVIATHAN'` |
| Field primitives | `<NumberField>`, `<SelectField>`, `<DateFieldDMY>`, `<Segmented>`, `<Chips>`, `<RangeField>` | — |

**Step 01 layout (R23):** `CURRENT POTENTIAL` (default `0` = not owned) berada **di kiri** `TARGET POTENTIAL` dalam satu baris dua kolom (`grid2`); hint di bawah masing-masing field menampilkan copy yang masih dibutuhkan.

**`<DateFieldDMY>`** wajib: mask `DD/MM/YYYY`, validasi tanggal nyata, `aria-invalid`, dan mengirim ISO ke engine. Jangan pakai `<input type="date">` (itu MDY di locale tertentu — persis masalah yang baru diperbaiki).

### 7.3 Data fetching

```
input berubah
  → debounce 200–300 ms
  → engine lokal (@prts/forecast-engine) untuk render instan
  → POST /api/v1/forecast (background) untuk verifikasi & angka otoritatif
  → kalau beda > epsilon: pakai server + log warning
```

Alternatif kalau tidak mau dual-compute: panggil server saja + skeleton. Tapi design menghendaki respons instan, jadi **shared engine** lebih cocok.

`useForecast`:

```ts
const { data, isFetching } = useQuery({
  queryKey: ['forecast', draft],
  queryFn: () => api.forecast(draft),
  placeholderData: keepPreviousData,
  staleTime: 30_000,
});
```

### 7.4 Routing & share

| Route | Render | Catatan |
|---|---|---|
| `/forecast` | client | stepper; `?step=` opsional |
| `/share/[slug]` | **server** | baca `snapshot`, render read-only, OG meta |
| `/settings` | client + auth | BYOK |

`generateMetadata()` di share page memakai snapshot (bukan recompute) supaya OG stabil dan tidak membocorkan inventory.

### 7.5 Auth & modal

- Save/Deploy → cek session; kalau belum login, buka `<AuthModal>` dan **simpan pending action** (prototype sudah begitu).
- Share: `POST /api/v1/shares` → `{ slug, expiresAt }`; tampilkan `prts.app/share/<slug>`.
- Jangan pernah kirim inventory ke halaman publik.

### 7.6 A11y & motion

- Step nav: `aria-current="step"`, fokus pindah ke `<h2>` pane saat ganti step.
- Hasil matrix: `aria-live="polite"` untuk badge count.
- Date invalid: `aria-invalid` + `aria-describedby` hint.
- Typewriter: hormati `prefers-reduced-motion` (prototype sudah).
- Badge tidak boleh hanya warna; teks status sudah ada — pertahankan.
- Range OP: tampilkan nilai numerik di samping (sudah).

### 7.7 Performa

- DP: 1× per compute, horizon ≤ 900, state kecil → aman.
- Jangan recompute saat ganti `selectedTier`/`step` (hanya saat input berubah).
- `useDeferredValue` untuk matrix saat mengetik cepat.
- Kalau nanti ada chart kurva, hitung di Web Worker.

---

## 8. Parity & test plan

### 8.0 Lokasi fixtures di repo terpisah

Golden fixtures tinggal di **repo engine** (`fixtures/*.json`) dan dijalankan di CI engine. Repo FE dan BE tidak menyimpan salinannya; mereka hanya meng-assert hasil `compute()` dengan versi engine ter-pin. CI engine menandai build gagal kalau parity fixture jebol.

### 8.1 Golden fixtures dari prototype

Ambil output `window.__PRTS__.compute()` untuk matriks kasus, simpan sebagai JSON, lalu BE/FE engine harus menghasilkan angka yang sama.

> **Catatan:** `defaultDate()` sudah di-fix (UTC → komponen lokal) pada 10 Nov 2026. Golden fixtures harus dibuat dengan helper yang sudah diperbaiki, dan `asOfDate` tercatat di setiap fixture supaya perbandingan stabil lintas zona/jam.

Cakupan minimal:

| Dimensi | Nilai |
|---|---|
| archetype | 5 |
| pot | target 1..6 × current 0..6 (termasuk kasus 0 copy) |
| prob | 0, 0.25, 0.35, 0.5, 1 |
| confidence | 0.5, 0.8, 0.9, 0.95 |
| days | 7, 14, 30, 90, 180, 365 |
| opPct | 0, 50, 100 |
| inventory | default, kosong, besar |
| levi packs | default, nol, campuran |

Total ± 2 000 kasus. Assert:

```ts
expect(be.totalPulls).toBe(fe.totalPulls);
expect(be.probabilityAtTotal).toBeCloseTo(fe.prob, 9);
expect(be.requiredPullsAtConfidence).toBe(fe.reqPulls);
expect(be.matrix[i].status).toBe(fe.tiers[i].status);
expect(be.matrix[i].monthlySpendUsd).toBeCloseTo(fe.monthlySpend, 2);
```

### 8.2 Invariant tests

1. Total monotonic F2P → LEVIATHAN.
2. Prob monotonic terhadap total.
3. `monthlySpendUsd <= capUsd` (kecuali LEVIATHAN).
4. LEVIATHAN packs tidak mengubah tier lain.
5. `required = 0` → semua GUARANTEED.
6. `ABSENT` → semua prob 0.
7. Isolated → `startPity = 0`.
8. `matrix.length === 6` dan urut.

### 8.3 Contract tests

- Zod schema request/response (di-import dari paket engine).
- Snapshot share tidak mengandung `inventorySnapshot` atau key apa pun.
- `engineVersion` cocok dengan versi paket ter-pin di `package.json`.

---

## 9. Urutan implementasi

| Fase | Repo | Isi | Output |
|---|---|---|---|
| 0 | — | Kunci kontrak (doc ini) + putuskan §10 | approval |
| 1 | `prts-forecast-engine` | `src/*` + `contract.ts` + golden fixtures dari prototype; publish `1.0.0` | parity 100% |
| 2 | `prts-forecast-api` | Migrasi DB + seed (produk, archetype, tier) | schema v2 |
| 3 | `prts-forecast-api` | NestJS forecast service + `POST /forecast` | API v2 |
| 4 | `prts-forecast-web` | Next.js stepper + stores + field primitives | UI parity |
| 5 | `prts-forecast-api` + `web` | Auth, save session, share + snapshot | fitur premium |
| 6 | `prts-forecast-api` + `web` | BYOK + PRTS LLM advice | fitur AI |

**Gate:** fase 3 tidak boleh mulai sebelum fase 1 parity lulus. Fase 4 boleh paralel dengan 2–3 memakai engine lokal. Fase 5–6 menyentuh dua repo, jadi deploy BE dulu (backward-compatible), baru FE.

---

## 10. Keputusan yang masih dibutuhkan

1. **R2/R16** — setuju dengan satu toggle default ON + sensitivity line? Atau mau default OFF (konservatif)?
2. **Label Potential:** `TARGET POTENTIAL` (1–6) sekarang berarti **pot yang ingin dicapai**, dengan `CURRENT POTENTIAL` (0–6, default 0) di kiri — mau ganti label jadi `POT TARGET`?
3. **Snapshot share** — simpan di `forecast_sessions_share.snapshot` (rekomendasi) atau recompute saat dibuka?
4. **Preview FE** — shared engine (rekomendasi) atau selalu round-trip ke server?
5. **`expectedAnnihilationClear`** — tetap 1800 default tanpa UI, atau tambah slider di Step 02?
6. **`selectedTier`** — disimpan di session (rekomendasi) atau hanya state UI?
7. **Starter/event pack** — tetap `is_active=false` di katalog, atau dihapus total?
8. **Slug share** — naikkan ke ≥10 char base62? (prototype 4 hex terlalu mudah ditebak)
9. **`password_hash`** — Google-only sekarang, tapi tetap disimpan untuk email login nanti?

---

## 11. Appendix — contoh request & response v2

```json
{
  "gameId": "arknights",
  "bannerArchetype": "LIMITED",
  "targetEndDate": "2027-02-08",
  "targetMode": "potential",
  "targetPulls": 300,
  "currentTargetPotential": 0,
  "targetPotential": 1,
  "targetAvailability": "FEATURED",
  "targetSixStarProbability": 0.35,
  "confidenceTarget": 0.9,
  "inventorySnapshot": {
    "orundum": 12500,
    "originitePrime": 45,
    "hhTicket1x": 10,
    "hhTicket10x": 1,
    "currentYellowCerts": 180,
    "currentShopTierCleared": 2,
    "currentPity": 0
  },
  "routeSettings": {
    "opConversionPercentage": 100,
    "expectedAnnihilationClear": 1800,
    "monthlyEligibility": {
      "includeCurrentMonthLoginPermit": true,
      "includeCurrentMonthGreenCertShop": true,
      "assumeFutureMonthlyRewardsClaimed": true
    },
    "leviathanPacks": { "op130": 1, "op66": 0, "op40": 0, "op20": 0, "op6": 0, "op1": 0 }
  },
  "selectedTier": "F2P",
  "requestAdvice": false
}
```

```json
{
  "status": "success",
  "engineVersion": "1.2.0",
  "target": {
    "bannerArchetype": "LIMITED",
    "targetEndDate": "2027-02-08",
    "daysRemaining": 90,
    "weeksRemaining": 13,
    "targetMode": "potential",
    "benchmarkPulls": 212,
    "requiredTargetCopies": 1,
    "confidenceTarget": 0.9,
    "probabilityGivenSixStar": 0.35,
    "startPity": 0,
    "horizon": 900
  },
  "matrix": [
    {
      "key": "F2P",
      "name": "F2P",
      "rule": "$0/mo · NATURAL ONLY",
      "capUsd": 0,
      "colorToken": "--f2p",
      "status": "LIKELY",
      "totalPulls": 190,
      "deltaPulls": -22,
      "probabilityAtTotal": 0.872,
      "chanceTargetCopy": 0.872,
      "expectedCopies": 0.872,
      "sparkCopies": 0,
      "monthlySpendUsd": 0,
      "monthlyPulls": 29.6,
      "basket": [],
      "breakdown": [
        { "key": "farming",       "label": "DAILY / WEEKLY / ANNIHILATION", "meta": "90d × 100 + 13w × (500 + 1 800)", "pulls": 64.8, "kind": "recurring" },
        { "key": "login",         "label": "MONTHLY LOGIN PERMIT",         "meta": "4 eligible calendar month(s) × 1 permit", "pulls": 4, "kind": "recurring" },
        { "key": "green",         "label": "GREEN CERT SHOP · TIER 1",     "meta": "4 month(s) × (600 ORU + 4 permits)", "pulls": 20, "kind": "recurring" },
        { "key": "inventory",     "label": "INVENTORY ORUNDUM + TICKETS",  "meta": "12 500 ORU + 20 permits", "pulls": 40.8, "kind": "oneTime" },
        { "key": "inventoryOp",   "label": "INVENTORY OP · 100%",          "meta": "45 OP × 180 ORU ÷ 600", "pulls": 13.5, "kind": "oneTime" },
        { "key": "certs",         "label": "YELLOW CERTS",                 "meta": "180 certs · Tier 2 cleared (2 unspent)", "pulls": 23, "kind": "oneTime" },
        { "key": "archetypeBonus","label": "ARCHETYPE BONUS",              "meta": "free 10-pull + 14 daily free pulls", "pulls": 24, "kind": "oneTime" }
      ],
      "isSelected": true,
      "isStart": false
    }
  ],
  "pity": {
    "chanceAnySixStar": 1,
    "chanceTargetCopy": 0.872,
    "probabilityAtConfidence": 0.872,
    "requiredPullsAtConfidence": 212,
    "expectedCopies": 0.872,
    "notes": ["Spark: 300 pulls → 1 deterministic copy."]
  },
  "assumptions": [
    { "key": "currentMonthClaimed", "value": true, "pullsDeltaIfOff": -6 }
  ],
  "advice": {
    "text": "MINNOW holds 91.9% at 230 pulls. Fund that line, not the one below it.",
    "source": "local"
  }
}
```

> **Contoh di atas dipotong:** `matrix` sebenarnya berisi 6 tier (F2P → LEVIATHAN), di sini hanya F2P yang ditampilkan. Angka adalah snapshot **asOfDate 2026-11-10, targetEndDate 2027-02-08** (90 hari / 13 weekly reset / 4 bulan kalender). Setelah engine dipindah ke paket `@prts/forecast-engine`, angka final mengikuti golden fixtures.

---

## 13. i18n Gap — Catatan Implementasi

### 13.1 Status saat ini

| Item | Status | Keterangan |
|---|---|---|
| `proto/forecast-i18n.js` | ✅ Ada | Dictionary EN/ID, 687 baris, key `en` dan `id` |
| `<script src="forecast-i18n.js">` | ✅ Terload | Di `proto/forecast-v3.html` baris 832 |
| `data-i18n` attributes | ✅ Terpasang | ~184 elemen di HTML, kunci dictionary cocok |
| i18n application engine | ❌ Belum ada | Tidak ada fungsi yang membaca `data-i18n` dan menukar teks |
| Language switcher UI | ❌ Belum ada | Tidak ada tombol pemilih bahasa di layar |
| Default language | Hardcode EN | Semua teks ditampilkan dalam bahasa Inggris |

### 13.2 Apa yang perlu dibangun

1. **i18n engine** — fungsi `applyI18n(lang)` yang:
   - Membaca semua elemen dengan `data-i18n="key"`
   - Mengganti `textContent` dengan nilai dari dictionary `en[key]` atau `id[key]`
   - Menangani `placeholder`, `aria-label`, `title` jika diperlukan
   - Disimpan ke `localStorage` untuk persistensi

2. **Language switcher** — tombol di header (sebelah SETTINGS atau sign-in) untuk toggle EN ↔ ID.

3. **Integrasi ke engine** — panggil `applyI18n()` saat halaman dimuat dan saat bahasa berubah.

### 13.3 Contoh implementasi

```js
var currentLang = 'en'; // atau 'id', dari localStorage

function applyI18n(lang){
  currentLang = lang;
  var dict = window.__I18N__[lang]; // en atau id dari forecast-i18n.js
  document.querySelectorAll('[data-i18n]').forEach(function(el){
    var key = el.getAttribute('data-i18n');
    if (dict && dict[key]) el.textContent = dict[key];
  });
  localStorage.setItem('forecast-lang', lang);
}
```

### 13.4 Konsekuensi

Jika i18n belum diimplementasikan, prototype hanya bisa digunakan dalam bahasa Inggris. Pengguna Indonesia yang tidak mengerti bahasa Inggris akan kesulitan memahami label dan hint di layar. Fitur ini harus diprioritaskan sebelum rilis prototype ke pengguna akhir.

---

## 12. Changelog

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | 2026-11-10 | Kontrak implementasi awal: input/output canonical, diff DB, API v2, FE store split, parity plan |
| 1.1 | 2026-11-10 | R20: ~~`current_target_potential` dihapus dari input/DB/API~~ (dibatalkan R23) |
| 1.2 | 2026-11-10 | i18n gap dicatat: dictionary + markup siap, engine + switcher belum ada |
| 1.3 | 2026-11-10 | R21: **monorepo dibatalkan**, FE & BE jadi repo terpisah + engine sebagai paket npm ber-versi (§1, §4.1, §8.0, §9) |
| 1.4 | 2026-11-10 | R22: semua key contract jadi **camelCase** (input, response, JSONB, config); kolom fisik DB tetap snake_case dengan mapper §5.0 |
| 1.5 | 2026-11-10 | R23: `currentTargetPotential` **dikembalikan** (default 0, UI di kiri TARGET POTENTIAL); `requiredCopies = max(0, target − current)` |
