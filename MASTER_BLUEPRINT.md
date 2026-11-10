# Arknights Gacha Forecaster: Master Blueprint

**Version:** 4.1 (Unified Final Build - NestJS DDD, TypeORM, BFF Proxy, 6 Marine Tiers)  
**Tech Stack:** 
* **Repo terpisah (bukan monorepo):**
  * `prts-forecast-web` — Next.js App Router UI + BFF Proxy.
  * `prts-forecast-api` — NestJS core engine via DDD + TypeORM.
  * `prts-forecast-engine` — paket npm `@prts/forecast-engine` (rumus + contract types + Zod), dipakai web & api dengan versi ter-pin identik.
* **Contract naming:** camelCase untuk semua key JSON/TS/query. Kolom fisik DB tetap snake_case (konvensi Postgres), dipetakan di mapper.
* **Database & ORM:** PostgreSQL + TypeORM.
* **State & Fetching:** Zustand (Auth & Client Store), TanStack Query (Server State Cache).
* **Styling & UI:** Tailwind CSS, shadcn/ui.
* **Auth:** NextAuth.js / Custom JWT (Double Token: In-memory Access Token + HTTP-only Refresh Cookie) + Google SSO.

---

## 1. Product Vision & Strategy

Kalkulator prediksi gacha deterministik bertema militeristik/taktis yang mengadopsi antarmuka **PRTS (Primitive Ruthless Tactical System)** dari Arknights. Aplikasi menghitung akumulasi resource (*Orundum*, *Originite Prime*, *Headhunting Tickets*, *Yellow Certs*) secara matematis hingga batas waktu tertentu dan mengevaluasi kelayakan target di 6 spending tier sekaligus.

* **Product-Led Growth (PLG):** Kalkulator dasar sepenuhnya gratis dan bisa digunakan oleh user anonim tanpa login.
* **Conversion Funnel:** Login (Google SSO) dipicu saat user ingin mengakses fitur premium:
  * Menyimpan sesi forecast ke database profile.
  * Membuat tautan share dinamis (SSR Open Graph preview untuk Discord/Twitter).
  * Mengaktifkan AI Tactical Advisory via **BYOK (Bring Your Own Key)**.

---

## 2. System Architecture & Tech Decisions

### 2.1. Backend-for-Frontend (BFF) Proxy Pattern
1. Client UI mengirim request ke Next.js BFF (`/api/v1/forecast`) — same-origin, jadi cookie refresh aman.
2. Next.js melakukan validasi session/auth, menyisipkan security token, lalu mem-proxy ke NestJS lewat `API_BASE_URL` (env, mis. `https://api.prts.app/api/v1/forecast`).
3. Core Engine NestJS memanggil `computeForecast()` dari paket `@prts/forecast-engine`, lalu mengembalikan hasilnya ke Next.js.
4. Next.js merender atau meneruskan response ke client.

> FE dan BE **deploy terpisah**. Karena itu: (a) tidak ada akses `internal-nestjs` via nama container, pakai URL publik/private network + TLS; (b) kalau ada call langsung dari browser, BE wajib allowlist origin FE dan `credentials: true`; (c) versi `@prts/forecast-engine` di dua repo harus identik.

### 2.2. Directory Structure (Separate Repos with DDD)

```text
prts-forecast-engine/                       # paket npm @prts/forecast-engine
├── src/
│   ├── contract.ts                         # ForecastInput/Response + Zod schema
│   ├── economy.ts                          # calendar, income, cert
│   ├── basket.optimizer.ts                 # best-value fill
│   ├── pity.dp.ts                          # runPity, sixStarProb
│   └── index.ts                            # computeForecast()
├── seed/                                   # fallback seed (archetypes, tiers, products)
└── fixtures/                               # golden fixtures (CI parity)

prts-forecast-web/                          # FE — Next.js App Router
├── src/app/
│   ├── api/                                # BFF Proxy Route Handlers ke NestJS
│   ├── forecast/                           # Main Calculator UI (2-Column Layout)
│   ├── settings/                           # BYOK AI Management (Protected)
│   └── share/[slug]/                       # SSR Dynamic OG Link Preview (Read-only)
├── src/components/                         # UI Components (shadcn/ui + custom PRTS)
├── src/stores/                             # Zustand (AuthStore, ForecastDraftStore)
└── src/hooks/                              # TanStack Query (useForecast, useValidateAiKey)

prts-forecast-api/                          # BE — NestJS DDD
├── src/common/                             # Guards, Decorators, Base DTOs, Interceptors
├── src/infrastructure/
│   ├── database/                           # TypeORM Module, Migrations, Entities
│   ├── auth/                               # JWT Double Token Service & Google OAuth
│   └── llm-adapter/                        # Game-agnostic LLM Caller
├── src/domains/forecast/                   # Controller, service, DTO, mapper, share
└── ormconfig.ts                            # TypeORM Configuration
```

### 2.3. Deployment Topology (repo terpisah)

| Komponen | Host | Env / catatan |
|---|---|---|
| `prts-forecast-web` | Vercel (atau Node container) | `API_BASE_URL`, `NEXTAUTH_*`, `NEXT_PUBLIC_APP_URL` |
| `prts-forecast-api` | Container (Fly.io / Railway / VPS) | `DATABASE_URL`, `JWT_*`, `CORS_ORIGINS`, kredensial LLM |
| `prts-forecast-engine` | GitHub Packages (private) | publish saat tag `vX.Y.Z`; CI wajib lulus parity fixtures |
| PostgreSQL | Managed (Neon / Supabase / RDS) | migration dijalankan dari repo API, bukan FE |

**Urutan rilis:** engine → api (backward-compatible) → web. Kalau API belum siap, FE tetap bisa rilis dengan meng-pin engine versi lama dan mematikan fitur save/share. Rollback = pin versi engine lama, bukan deploy ulang semua.

---

## 3. The 6 Marine Biology Spending Tiers (Matrix)

Tier sekarang adalah **budget cap per bulan**, bukan toggle produk (R5). Engine memilih produk terbaik yang muat di cap tersebut.

1. **F2P (Free to Play):** `$0/mo` — hanya akumulasi natural (harian, mingguan, annihilation); nol pembelian.
2. **MINNOW:** `$0–$4.99/mo` — monthly access (mis. 1× monthly card).
3. **GOLDFISH:** `$5–$29.99/mo` — monthly card + paket kecil.
4. **DOLPHIN:** `$30–$99.99/mo` — monthly card + paket headhunting bulanan.
5. **WHALE:** `$100–$499.99/mo` — ditambah Originite Prime mentah (`op130`…`op1`).
6. **LEVIATHAN:** `$500+/mo` — WHALE + pembelian OP pack custom (`leviathanPacks`) dan konversi ekstrem farming Base Originium Shard.

> Tidak ada lagi `isMonthlyCardActive` / `monthlyHeadhuntingPacksToBuy` di request; optimizer yang menentukan komposisi basket per tier. Detail kontrak: [`FORECAST_V3_IMPLEMENTATION.md`](./FORECAST_V3_IMPLEMENTATION.md) §3.

---

## 4. Banner Handling & Event Stages (MVP Isolation Rules)

### 4.1. Banner Handling: Selection by Type (Archetype-Driven)
> [!IMPORTANT]
> **MVP Scope Rule:** Pengguna **tidak** memilih nama aktual banner (contoh: "Wis'adel Debut" dsb.) dan sistem **tidak** menjalankan scraper/cron banner live pada fase MVP.
> 
> * **User Experience:** User memilih **Banner Archetype** (`LIMITED`, `EVENT`, `STANDARD`, `CROSSOVER`, `KERNEL`) dan memasukkan estimasi tanggal target secara manual.
> * **Engine Integration:** Engine kalkulasi membaca aturan pity, rate-up chance, dan bonus pull langsung dari metadata archetype yang dipilih.
> * **Database Infra:** Tabel `banners` disiapkan di schema database untuk masa depan, tetapi **didecouple** dari engine kalkulasi MVP.

#### Predefined Archetypes & Pity Mechanics:
1. **LIMITED (Anniversary/Festival):**
   * `rateUpChance`: 70% | `hardPityThreshold`: 300 (Spark) | `pityGroup`: ISOLATED (Pity tidak diwariskan)
   * `hasFreeMulti`: true (1x Tiket 10-pull gratis) | `dailyFreePulls`: 14
2. **EVENT (New Solo 6-Star Debut):**
   * `rateUpChance`: 50% | `hardPityThreshold`: 150 (Guaranteed Rate-up) | `pityGroup`: STANDARD_SHARED
3. **STANDARD (Regular 2x 6-Star Pool):**
   * `rateUpChance`: 50% (Split 25/25) | `hardPityThreshold`: null | `pityGroup`: STANDARD_SHARED
4. **CROSSOVER (Collab, e.g. Monster Hunter, R6S):**
   * `rateUpChance`: 100% | `hardPityThreshold`: 120 (Spark) | `pityGroup`: ISOLATED
5. **KERNEL (Classic Pool):**
   * `rateUpChance`: 50% | `hardPityThreshold`: null | `pityGroup`: KERNEL_SHARED

`rateUpChance` pada archetype berarti peluang mendapat **seluruh set operator featured** setelah 6★ muncul. Ia bukan otomatis peluang satu operator target. Potential mode selalu memakai `targetSixStarProbability`, yaitu peluang operator target tunggal setelah 6★ muncul; misalnya total featured 50% yang dibagi dua operator berarti nilai target tunggal `0.25`.

### 4.2. Event Stages & Rewards (MVP+ Infrastructure - LOCKED)
* **Status:** Tabel `events` disiapkan di database TypeORM (menyimpan data stage OP reward dan tiket rerun).
* **Rule:** **TIDAK** diintegrasikan ke dalam perhitungan engine pada fase MVP dan **TIDAK** dibuatkan scraper otomatis untuk mencegah *scope creep*.

---

## 5. Pity & Target Modes

Mesin kalkulasi mendukung dua mode evaluasi target:

* **Mode 1: Target Pulls (Sparking):**
  * User memasukkan jumlah pull eksplisit (contoh: 300 pull untuk Limited Spark, 120 untuk Collab).
  * Engine mengevaluasi rute mana yang mencapai persis `targetPulls` sebelum `targetEndDate`.
* **Mode 2: Target Potential (Probability / Expected Value):**
  * User mengisi **Current Potential** (0–6, default 0 = belum dimiliki) dan **Target Potential** (1–6). Copy yang dibutuhkan = selisihnya.
  * Engine menghitung **peluang mendapatkan minimal copy yang dibutuhkan pada jumlah pull tertentu**. *Expected Value* hanya ditampilkan sebagai informasi pendukung dan **bukan** dasar badge `FEASIBLE`.
  * `FEASIBLE` berarti tier tersebut mencapai jumlah pull minimum untuk memenuhi confidence target; `GUARANTEED` hanya boleh dipakai bila ada rule hard guarantee/spark yang benar-benar menjamin target.

### 5.1. Potential Probability Model (Pot 1-6)

#### Target Copy Semantics

`currentTargetPotential` = pot yang sudah dimiliki (0 = belum punya). `targetPotential` = pot yang ingin dicapai. Kebutuhan copy adalah selisihnya, minimal 0.

```typescript
requiredCopies = Math.max(0, targetPotential - currentTargetPotential);
// currentTargetPotential: 0..6 (default 0)
// targetPotential: 1..6
// requiredCopies = 0 → semua tier GUARANTEED tanpa pull
```

Banner archetype saja tidak cukup untuk mengetahui peluang operator tertentu: operator dapat tidak tersedia di banner tersebut, dapat menjadi featured, atau hanya menjadi off-banner. Karena MVP tidak memakai database banner live, user harus memasukkan profil peluang target yang sudah dikonfirmasi.

```typescript
type TargetProbabilityProfile = {
  availability: 'FEATURED' | 'OFF_BANNER' | 'ABSENT';
  // Peluang operator target, dengan syarat pull tersebut menghasilkan 6★; rentang 0..1.
  // Contoh: dua rate-up 6★ yang membagi total 50% => 0.25 untuk satu target.
  targetSixStarProbability: number;
  currentTargetPotential: 0 | 1 | 2 | 3 | 4 | 5 | 6; // default 0
  confidenceTarget: 0.5 | 0.8 | 0.9 | 0.95;
};
```

> Di kontrak API v2, isi profile ini **diflatten** ke top-level (`targetAvailability`, `targetSixStarProbability`, `currentTargetPotential`, `confidenceTarget`) — lihat `FORECAST_V3_IMPLEMENTATION.md` §3.1. Tipe di atas adalah bentuk model internal.

Validasi: `ABSENT` harus bernilai `targetSixStarProbability = 0`; `FEATURED` atau `OFF_BANNER` wajib memberi probabilitas eksplisit. Nilai `rateUpChance` archetype tidak boleh langsung dipakai untuk Pot sebelum dipastikan apakah nilai tersebut adalah peluang **operator target tunggal**, atau total peluang seluruh operator rate-up.

#### 6★ Pity Formula

Definisikan `consecutiveNonSixStarPullsBeforeCurrentPull` sebagai jumlah pull berturut-turut tanpa 6★ tepat sebelum pull berikutnya. Peluang pull berikutnya menghasilkan 6★ dihitung dengan fungsi eksplisit berikut:

```typescript
function calculateSixStarProbability(
  consecutiveNonSixStarPullsBeforeCurrentPull: number,
): number {
  if (consecutiveNonSixStarPullsBeforeCurrentPull < 50) {
    return 0.02;
  }

  const additionalPityIncrements =
    consecutiveNonSixStarPullsBeforeCurrentPull - 49;

  return Math.min(0.02 + (0.02 * additionalPityIncrements), 1);
}
```

Dengan definisi ini, setelah 50 pull tanpa 6★, pull berikutnya memiliki peluang 4%; setiap miss berikutnya menaikkan peluang sebesar 2 poin persentase sampai 100%. Begitu 6★ muncul, `consecutiveNonSixStarPullsBeforeCurrentPull` kembali ke 0. Aturan pity dasar ini konsisten dengan pengumuman resmi Arknights tentang peningkatan peluang setelah 50 pull tanpa 6★.

Peluang mendapatkan copy target pada pull berikutnya harus dipisahkan dengan jelas antara peluang mendapat 6★ dan peluang 6★ tersebut adalah operator target:

```typescript
function calculateTargetOperatorProbabilityGivenSixStar(
  potentialState: PotentialState,
  targetProbabilityProfile: TargetProbabilityProfile,
): number {
  if (potentialState.guarantee === 'NEXT_6STAR_IS_TARGET') {
    return 1;
  }

  return targetProbabilityProfile.targetSixStarProbability;
}

function calculateTargetCopyProbabilityOnCurrentPull(
  potentialState: PotentialState,
  targetProbabilityProfile: TargetProbabilityProfile,
): number {
  const sixStarProbability = calculateSixStarProbability(
    potentialState.consecutiveNonSixStarPullsBeforeCurrentPull,
  );
  const targetOperatorProbabilityGivenSixStar =
    calculateTargetOperatorProbabilityGivenSixStar(
      potentialState,
      targetProbabilityProfile,
    );

  return sixStarProbability * targetOperatorProbabilityGivenSixStar;
}
```

Secara normal `targetOperatorProbabilityGivenSixStar` sama dengan `targetSixStarProbability`. Jika state guarantee aktif dan rule banner menyatakan 6★ berikutnya adalah target, nilainya menjadi `1`.

#### Exact Distribution via Dynamic Programming

Engine **tidak** memakai distribusi binomial biasa, karena peluang 6★ berubah oleh pity dan pity reset setelah setiap 6★. Sebagai gantinya, `PityCalculator` menjalankan dynamic programming (DP) dengan state:

```typescript
type PotentialState = {
  consecutiveNonSixStarPullsBeforeCurrentPull: number;
  targetCopiesObtained: number;    // capped pada requiredCopies
  guarantee: 'NONE' | 'NEXT_6STAR_IS_TARGET';
  guaranteeProgressPullCount: number;
};
```

`probabilityDistributionAfterPullCount` menyimpan probabilitas dari setiap `PotentialState` setelah sejumlah pull selesai. Untuk setiap state pada satu iterasi pull, engine melakukan tiga transisi berikut:

```typescript
const sixStarProbability = calculateSixStarProbability(
  potentialState.consecutiveNonSixStarPullsBeforeCurrentPull,
);
const targetOperatorProbabilityGivenSixStar =
  calculateTargetOperatorProbabilityGivenSixStar(
    potentialState,
    targetProbabilityProfile,
  );

// 1. Pull bukan 6★: pity bertambah, jumlah copy target tidak berubah.
addProbabilityToNextState({
  consecutiveNonSixStarPullsBeforeCurrentPull:
    potentialState.consecutiveNonSixStarPullsBeforeCurrentPull + 1,
  targetCopiesObtained: potentialState.targetCopiesObtained,
  guarantee: advanceGuaranteeOnNonSixStarPull(potentialState),
  guaranteeProgressPullCount: advanceGuaranteeProgressOnNonSixStarPull(potentialState),
}, currentStateProbability * (1 - sixStarProbability));

// 2. Pull menghasilkan 6★ operator target: pity di-reset dan copy target bertambah.
addProbabilityToNextState({
  consecutiveNonSixStarPullsBeforeCurrentPull: 0,
  targetCopiesObtained: Math.min(
    potentialState.targetCopiesObtained + 1,
    requiredCopies,
  ),
  guarantee: clearOrAdvanceGuaranteeOnTargetOperator(potentialState),
  guaranteeProgressPullCount: advanceGuaranteeProgressOnTargetOperator(potentialState),
}, currentStateProbability * sixStarProbability * targetOperatorProbabilityGivenSixStar);

// 3. Pull menghasilkan 6★ selain operator target: pity di-reset, copy tidak bertambah.
addProbabilityToNextState({
  consecutiveNonSixStarPullsBeforeCurrentPull: 0,
  targetCopiesObtained: potentialState.targetCopiesObtained,
  guarantee: advanceGuaranteeOnNonTargetSixStar(potentialState),
  guaranteeProgressPullCount: advanceGuaranteeProgressOnNonTargetSixStar(potentialState),
}, currentStateProbability * sixStarProbability * (1 - targetOperatorProbabilityGivenSixStar));
```

Fungsi transisi guarantee—`advanceGuaranteeOnNonSixStarPull`, `clearOrAdvanceGuaranteeOnTargetOperator`, dan `advanceGuaranteeOnNonTargetSixStar`—tidak boleh di-hardcode global. Setiap archetype harus mendeklarasikan apakah guarantee tidak ada, berlaku tepat pada pull tertentu, atau membuat **6★ berikutnya** menjadi target setelah counter tertentu. Ini menghindari asumsi yang salah terhadap rule 150-pull maupun banner khusus.

#### Spark / Hard Guarantee Model

Spark tidak mengubah pity atau peluang random pull; ia memberi copy target deterministik ketika syarat penukaran terpenuhi. Rule banner harus memodelkan limit penukaran secara eksplisit:

```typescript
type SparkRule = {
  pullsPerRedemption: number;       // contoh: 300
  copiesPerRedemption: number;      // biasanya 1
  maxRedemptionsPerBanner: number;  // 0 jika tidak ada Spark
};
```

Jika user otomatis menggunakan Spark untuk target, bonus copy pada jumlah pull tertentu dihitung dengan fungsi eksplisit berikut:

```typescript
function calculateSparkTargetCopyBonus(totalPullsPerformed: number): number {
  const completedSparkRedemptions = Math.min(
    sparkRule.maxRedemptionsPerBanner,
    Math.floor(totalPullsPerformed / sparkRule.pullsPerRedemption),
  );

  return completedSparkRedemptions * sparkRule.copiesPerRedemption;
}

function calculateTotalTargetCopiesAfterPulls(
  randomTargetCopiesObtained: number,
  totalPullsPerformed: number,
): number {
  return Math.min(
    requiredCopies,
    randomTargetCopiesObtained + calculateSparkTargetCopyBonus(totalPullsPerformed),
  );
}
```

Formula tersebut hanya valid bila redemption dapat digunakan untuk operator target. Jika target `ABSENT` dan tidak tersedia di Spark shop, `copiesPerRedemption` harus diperlakukan sebagai 0 untuk target itu.

#### Result Formula & Feasibility

Setelah DP dijalankan sampai jumlah pull yang dievaluasi, peluang berhasil mencapai target Pot dihitung sebagai berikut:

```typescript
function calculateProbabilityOfReachingTargetPotential(
  totalPullsPerformed: number,
): number {
  return sumProbabilitiesForStatesWhere(
    probabilityDistributionAfterPullCount[totalPullsPerformed],
    (potentialState) => calculateTotalTargetCopiesAfterPulls(
      potentialState.targetCopiesObtained,
      totalPullsPerformed,
    ) >= requiredCopies,
  );
}

function calculateRequiredPullsAtConfidence(
  confidenceTarget: number,
): number | null {
  return findSmallestPullCountWhere(
    (totalPullsPerformed) =>
      calculateProbabilityOfReachingTargetPotential(totalPullsPerformed)
        >= confidenceTarget,
  );
}
```

Probabilitas mendapat jumlah copy target tertentu dapat ditampilkan dengan memfilter state yang memiliki `targetCopiesObtained` sesuai jumlah tersebut, sesudah bonus Spark diterapkan. *Expected Value* copy target yang sudah dicap pada kebutuhan Pot dihitung dengan formula berikut:

```typescript
expectedTargetCopies = sumForEveryTargetCopyCount(
  1,
  requiredCopies,
  (targetCopyCount) => calculateProbabilityOfAtLeastTargetCopies(
    targetCopyCount,
    totalPullsPerformed,
  ),
);
```

Status pada matrix:

| Status | Kondisi |
| --- | --- |
| `GUARANTEED` | Rule deterministic menjamin `totalTargetCopiesAfterPulls ≥ requiredCopies`. |
| `FEASIBLE` | `probabilityOfReachingTargetPotential ≥ confidenceTarget`, tetapi belum deterministic. |
| `LIKELY` | Probabilitas berada di atas 50% tetapi belum mencapai confidence target. |
| `DEFICIT` | Probabilitas belum mencapai 50%, atau pull belum mencapai syarat target. |

Contoh: Pot 1 pada 300 pull dapat ditandai `GUARANTEED` hanya jika target bisa ditukar lewat Spark pada 300 pull. Pot 6 **tidak** otomatis guaranteed pada 300 pull; ia membutuhkan enam copy dari kombinasi hasil random dan redemption yang valid.

### 5.2. Recurring Economy & Calendar-Month Rules

MVP hanya memasukkan sumber resource yang **recurring**, **recurring-ish**, atau **paid recurring**. Reward event, compensation, stage first-clear, story, dan sumber variabel lainnya tidak dihitung agar forecast tetap deterministik.

| Source | Cadence | Rule |
| --- | --- | --- |
| Daily missions | Daily | `100 Orundum` per hari forecast yang selesai. |
| Weekly missions | Weekly reset | `500 Orundum` untuk setiap weekly reset yang dapat diselesaikan sebelum deadline. |
| Annihilation | Weekly reset | `expectedAnnihilationClear` (`0-1800`) Orundum untuk setiap weekly reset yang dapat diselesaikan sebelum deadline. |
| Monthly login/calendar | Calendar month | `1` Headhunting Permit per bulan kalender yang eligible. Tidak dihitung secara pro-rata atau per 30 hari. |
| Green Certificate shop, Tier 1 | Calendar month / recurring-ish | `600 Orundum + 4` Headhunting Permit per bulan kalender yang eligible. User harus memiliki Green Certificate yang cukup; engine tidak mengasumsikan otomatis. |
| Monthly Card | Paid, 30-day entitlement | `200 Orundum` per hari selama 30 hari dan `6 Originite Prime` setiap pembelian/renewal. Ini bukan reward calendar-month. |

#### Calendar-Month Eligibility

* Seluruh cutoff kalender dihitung pada timezone `Asia/Jakarta`.
* Engine memakai `as_of_date` (waktu saat forecast dibuat) dan `target_end_date` untuk membuat bucket bulan kalender, **bukan** `days_remaining / 30`.
* Reward bulan berjalan tidak pernah dikreditkan secara otomatis: user harus secara eksplisit menyatakan masih eligible melalui `monthlyEligibility`.
* Reward bulan yang akan datang dihitung hanya jika reset bulan tersebut terjadi pada atau sebelum `target_end_date`, serta `assumeFutureMonthlyRewardsClaimed` bernilai `true`.
* Jika user terlambat memenuhi syarat suatu bulan, reward bulan itu hangus dan tidak boleh diproyeksikan ke bulan berikutnya.
* Untuk forecast yang konservatif, default seluruh reward bulan berjalan adalah `false`, sementara reward bulan depan diasumsikan dapat diklaim.

```typescript
type MonthlyEligibility = {
  includeCurrentMonthLoginPermit: boolean;
  includeCurrentMonthGreenCertShop: boolean;
  assumeFutureMonthlyRewardsClaimed: boolean;
};
```

#### Deterministic Income Formula

```typescript
baseOrundum =
  (completedForecastDays * 100) +
  (completedWeeklyCycles * 500) +
  (completedWeeklyCycles * expectedAnnihilationClear);

monthlyLoginTickets = eligibleCalendarMonths.loginPermit * 1;

greenCertIncome = {
  orundum: eligibleCalendarMonths.greenCertShop * 600,
  hhTicket1x: eligibleCalendarMonths.greenCertShop * 4,
};
```

`completedWeeklyCycles` adalah jumlah reset mingguan yang terjadi pada atau sebelum `target_end_date` dan masih dapat diselesaikan; ia tidak dihitung dengan pembagian kasar jumlah hari dengan tujuh. Definisi hari forecast memakai interval `(as_of_date, target_end_date]`.

---

## 6. Database Schema (PostgreSQL + TypeORM Entities)

> 📌 **Superseded untuk `forecast_sessions`:** bentuk final entity, kolom baru, dan urutan migrasi ada di [`FORECAST_V3_IMPLEMENTATION.md`](./FORECAST_V3_IMPLEMENTATION.md) §5. Bagian di bawah adalah snapshot awal (v1) — masih berguna untuk entity lain (`users`, `user_ai_keys`, `banners`, `events`, `game_configs`). Ingat: properti entity = snake_case (kolom DB), payload JSONB = camelCase.

### 6.1. Core Entities

```typescript
// users entity
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  password_hash: string;

  @Column({ type: 'enum', enum: ['local', 'google'], default: 'local' })
  auth_provider: string;

  @Column({ type: 'varchar', nullable: true, unique: true })
  google_id: string;

  @Column({ type: 'enum', enum: ['user', 'admin'], default: 'user' })
  role: string;

  @CreateDateColumn()
  created_at: Date;
}

// user_ai_keys entity (BYOK)
@Entity('user_ai_keys')
export class UserAiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: ['openai', 'claude', 'gemini', 'deepseek', 'custom'] })
  provider: string;

  @Column()
  provider_label: string; // e.g. "My Local LM Studio"

  @Column({ type: 'text' })
  encrypted_key: string; // AES-256-GCM

  @Column({ type: 'varchar', nullable: true })
  endpoint: string; // Custom endpoint URL / Proxy

  @Column({ default: true })
  is_active: boolean;
}

// forecast_sessions entity
@Entity('forecast_sessions')
export class ForecastSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ default: 'arknights' })
  game_id: string;

  @Column({ default: 'PRTS Operation Forecast' })
  session_name: string;

  @Column({ type: 'enum', enum: ['pulls', 'potential'] })
  target_mode: string;

  @Column({ type: 'int', nullable: true })
  target_potential: number; // 1 - 6

  @Column({ type: 'jsonb', nullable: true })
  target_probability_profile?: {
    availability: 'FEATURED' | 'OFF_BANNER' | 'ABSENT';
    target_six_star_probability: number; // P(target | 6-star), 0 - 1
    current_target_potential: number; // 0 - 6; 0 = operator belum dimiliki
    confidence_target: number; // 0.5, 0.8, 0.9, atau 0.95
  };

  @Column({ type: 'enum', enum: ['LIMITED', 'EVENT', 'STANDARD', 'CROSSOVER', 'KERNEL'] })
  target_banner_type: string;

  @Column({ type: 'timestamp with time zone' })
  target_end_date: Date;

  @Column({ type: 'jsonb' })
  inventory_snapshot: {
    orundum: number;
    originite_prime: number;
    hh_ticket_1x: number;
    hh_ticket_10x: number;
    current_yellow_certs: number;
    current_shop_tier_cleared: number;
    current_pity?: number;
  };

  @Column({ type: 'jsonb' })
  route_settings: {
    isMonthlyCardActive: boolean;
    monthlyHeadhuntingPacksToBuy: number;
    opConversionPercentage: number;
    expectedAnnihilationClear: number;
    monthlyEligibility: {
      includeCurrentMonthLoginPermit: boolean;
      includeCurrentMonthGreenCertShop: boolean;
      assumeFutureMonthlyRewardsClaimed: boolean;
    };
    opPacksToBuy?: Record<string, number>;
  };

  @CreateDateColumn()
  created_at: Date;
}

// forecast_sessions_share entity
@Entity('forecast_sessions_share')
export class ForecastSessionShare {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => ForecastSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: ForecastSession;

  @Column({ unique: true })
  share_slug: string;

  @Column({ default: true })
  is_active: boolean;

  @Column({ default: 0 })
  views_count: number;

  @Column({ type: 'timestamp with time zone', nullable: true })
  expires_at: Date | null; // Null = permanent
}

// game_configs entity
@Entity('game_configs')
export class GameConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'arknights' })
  game_id: string;

  @Column({ unique: true })
  config_key: string; // e.g. "op_to_orundum_ratio"

  @Column({ type: 'jsonb' })
  config_value: any; // e.g. 180
}
```

### 6.2. MVP+ Infrastructure Entities (Prepared, Decoupled from Engine)

```typescript
// banners entity (Infra ready, decoupled in MVP)
@Entity('banners')
export class Banner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'arknights' })
  game_id: string;

  @Column()
  name: string; // e.g. "Inudi Huhu"

  @Column({ type: 'enum', enum: ['LIMITED', 'EVENT', 'STANDARD', 'CROSSOVER', 'KERNEL'] })
  banner_type: string;

  @Column({ type: 'timestamp with time zone' })
  start_date: Date;

  @Column({ type: 'timestamp with time zone' })
  end_date: Date;

  @Column({ type: 'jsonb' })
  metadata: {
    has_free_multi: boolean;
    multi_pulls: number;
    daily_free_pulls: number;
    rate_up_chance: number;
    hard_pity_threshold: number | null;
    pity_group: string;
  };
}

// events entity (Infra ready, locked in MVP)
@Entity('events')
export class GameEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'arknights' })
  game_id: string;

  @Column()
  name: string;

  @Column({ type: 'timestamp with time zone' })
  start_date: Date;

  @Column({ type: 'timestamp with time zone' })
  end_date: Date;

  @Column()
  event_type: string; // 'sidestory', 'storycollection', 'rerun'

  @Column({ default: 0 })
  total_op_reward: number;

  @Column({ default: false })
  is_rerun: boolean;
}
```

---

## 7. Frontend Architecture & UI Specification (Next.js)

### 7.1. State & Data Fetching Architecture
* **Zustand (`AuthStore`):** Menyimpan short-lived JWT Access Token di memori klien, role pengguna, dan session status.
* **Zustand (`ForecastDraftStore`):** Menyimpan draft input pengguna secara lokal (persisted ke `localStorage` untuk pengunjung anonim).
* **TanStack Query:** Menangani query caching ke endpoint BFF (`/api/v1/forecast`), auto re-fetch status validasi AI Key, dan mutasi Save/Share.

### 7.2. Dynamic UI Form Logic
* **Pity Field Dinamis:**
  * Jika user memilih `bannerArchetype` bernilai `LIMITED` atau `CROSSOVER`: Input `currentPity` **di-disable atau disembunyikan**, karena jenis banner ini memiliki *isolated pity* yang selalu mulai dari 0.
  * Jika user memilih `EVENT`, `STANDARD`, atau `KERNEL`: Input `current_pity` **ditampilkan**, karena pity berasal dari pity group yang dapat diwariskan.
* **Target Probability Profile (Potential mode):** User menetapkan status operator target (`FEATURED`, `OFF_BANNER`, atau `ABSENT`), peluang tepat operator tersebut ketika 6★ muncul, current potential, dan confidence target (50%, 80%, 90%, atau 95%). Input ini wajib; archetype banner saja tidak cukup untuk menyimpulkan peluang operator spesifik.

### 7.3. Wireframe & Layout Specification
**Halaman Utama: `/forecast` (2-Column Tactical Layout)**
* **Header Bar:** Logo PRTS Terminal, Status Koneksi Neural Link (AI Active/Inactive), Tombol Google SSO / User Avatar Profile.
* **Kolom Kiri (Input Controls - Collapsible Cards):**
  1. *Target Mission:* Dropdown Banner Archetype, Date Picker (Target Horizon), Toggle Target Mode (Target Pulls vs Target Potential 1-6). Pada Potential mode, tampilkan **Current Potential** (default 0) di kiri **Target Potential** dalam satu baris, lalu Target Availability, P(TARGET│6★), dan confidence selector.
  2. *Current Inventory Snapshot:* Orundum, Originite Prime, Tiket 1x, Tiket 10x, Yellow Certs, Shop Tier Cleared (0-5), dan Dynamic Pity Input.
  3. *Tactical Route Parameters:* Toggle Monthly Card, Jumlah Paket Headhunting, Persentase Konversi OP (0-100%), Annihilation clear level (max 1800), rincian pembelian OP Pack, serta status eligibility reward bulan berjalan (Monthly Login dan Green Cert shop). Default UI bersifat konservatif: reward bulan berjalan tidak dicentang.
* **Kolom Kanan (PRTS Display Monitor):**
  1. *Pre-flight Matrix:* Grid 6 Marine Tiers (F2P, MINNOW, GOLDFISH, DOLPHIN, WHALE, LEVIATHAN) dengan status badge `GUARANTEED` / `FEASIBLE` / `LIKELY` / `DEFICIT`, total proyeksi pull, dan sisa hari.
  2. *Resource Accumulation Breakdown:* Grafik/tabel sumber pendapatan (Orundum harian/mingguan, konversi OP, tiket Yellow Certs).
  3. *PRTS Terminal Feed (AI Advice):* Layar terminal gelap dengan teks hijau monospaced dan **efek mesin tik (typewriter)**.
  4. *Action Control Bar:* Tombol "Save Forecast" (Protected) dan "Deploy Share Link" (Protected, memunculkan modal durasi masa aktif link).

---

## 8. API Contracts & Payloads

> ⚠️ **DEPRECATED (v1).** Contoh di bawah adalah kontrak lama dan **tidak boleh dipakai**. Kontrak aktif (camelCase, 6 tier, `matrix[]`, `assumptions[]`) ada di [`FORECAST_V3_IMPLEMENTATION.md`](./FORECAST_V3_IMPLEMENTATION.md) §3 (tipe), §6 (diff), §11 (contoh request/response lengkap).

### POST `/api/v1/forecast` (Public Calculation Endpoint)

#### 8.1. Request Payload (legacy, jangan dipakai)
```json
{
  "game_id": "arknights",
  "target_banner_type": "LIMITED",
  "target_end_date": "2027-05-01T00:00:00.000Z",
  "requestPrtsSummary": true,
  
  "target_mode": "potential",
  "target_potential": 1,
  "target_probability_profile": {
    "availability": "FEATURED",
    "target_six_star_probability": 0.35,
    "current_target_potential": 0,
    "confidence_target": 0.9
  },

  "inventory_snapshot": {
    "orundum": 12500,
    "originite_prime": 45,
    "hh_ticket_1x": 10,
    "hh_ticket_10x": 1,
    "current_yellow_certs": 180,
    "current_shop_tier_cleared": 2,
    "current_pity": 0
  },

  "route_settings": {
    "isMonthlyCardActive": true,
    "monthlyHeadhuntingPacksToBuy": 1,
    "opConversionPercentage": 80,
    "expectedAnnihilationClear": 1800,
    "monthlyEligibility": {
      "includeCurrentMonthLoginPermit": false,
      "includeCurrentMonthGreenCertShop": false,
      "assumeFutureMonthlyRewardsClaimed": true
    },
    "opPacksToBuy": {
      "pack_130_op": 2,
      "pack_50_op": 1,
      "pack_20_op": 0
    }
  }
}
```

#### 8.2. Response Payload
```json
{
  "status": "success",
  "target_info": {
    "banner_type": "LIMITED",
    "days_remaining": 175,
    "weeks_remaining": 25,
    "evaluated_target_pulls": 300,
    "required_target_copies": 1,
    "confidence_target": 0.9
  },
  "pity_estimation": {
    "chance_any_6star": "100.0%",
    "chance_rateup_6star": "100.0%",
    "notes": "Spark threshold (300) applied. Inherited pity ignored for isolated banner."
  },
  "potential_estimation": {
    "target_six_star_probability": 0.35,
    "probability_at_evaluated_target": 1.0,
    "expected_target_copies": 1.0,
    "required_pulls_at_confidence": 300,
    "status": "GUARANTEED"
  },
  "calculation_matrix": {
    "F2P": {
      "isFeasible": false,
      "total_projected_pulls": 150,
      "deficit_pulls": 150,
      "breakdown": {
        "from_orundum_farming": 126,
        "from_op_conversion": 0,
        "from_yellow_certs": 0,
        "from_archetype_bonus": 24
      }
    },
    "GOLDFISH": {
      "isFeasible": false,
      "total_projected_pulls": 190,
      "deficit_pulls": 110,
      "breakdown": {
        "from_orundum_farming": 156,
        "from_op_conversion": 10,
        "from_yellow_certs": 0,
        "from_archetype_bonus": 24
      }
    },
    "DOLPHIN": {
      "isFeasible": false,
      "total_projected_pulls": 240,
      "deficit_pulls": 60,
      "breakdown": {
        "from_orundum_farming": 156,
        "from_op_conversion": 10,
        "from_yellow_certs": 50,
        "from_archetype_bonus": 24
      }
    },
    "WHALE": {
      "isFeasible": true,
      "total_projected_pulls": 320,
      "surplus_pulls": 20,
      "breakdown": {
        "from_orundum_farming": 156,
        "from_op_conversion": 90,
        "from_yellow_certs": 50,
        "from_archetype_bonus": 24
      }
    },
    "LEVIATHAN": {
      "isFeasible": true,
      "total_projected_pulls": 380,
      "surplus_pulls": 80,
      "breakdown": {
        "from_orundum_farming": 216,
        "from_op_conversion": 90,
        "from_yellow_certs": 50,
        "from_archetype_bonus": 24
      }
    }
  },
  "prtsTacticalAdvice": "Doctor, reaching the spark constraint is impossible within F2P or GOLDFISH parameters. Initiating the WHALE protocol is advised to guarantee acquisition before the deadline."
}
```

---

## 9. AI Integration (PRTS Persona) & Security Flow

### 9.1. BYOK (Bring Your Own Key) Architecture
* User memasukkan API key LLM sendiri (OpenAI, Claude, Gemini, DeepSeek, atau URL endpoint proxy kustom).
* Kunci dienkripsi menggunakan **AES-256-GCM** sebelum disimpan ke tabel `user_ai_keys`.
* **Validation Endpoint (`POST /api/v1/ai-keys/validate`):** Mengirim prompt minimal (`max_tokens: 5`) untuk memverifikasi handshake endpoint tanpa menguras kuota pengguna.

### 9.2. PRTS Persona & System Prompt Decoupling
* Adapter LLM di `src/infrastructure/llm-adapter` bersifat game-agnostik murni.
* Persona PRTS diinjeksikan langsung dari domain Arknights (`src/domains/arknights`):
  * Karakter: Dingin, analitis, militeristik, memanggil user "Doctor".
  * Output: Ringkas, fokus pada rute belanja paling optimal dan peringatan defisit resource.
