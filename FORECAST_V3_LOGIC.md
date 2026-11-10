# Forecast v3 — Logic & Input Reference

**Status:** Reconciliation document (living)
**Snapshot:** 10 Nov 2026 · `proto/forecast-v3.html`
**Pasangan:** [`MASTER_BLUEPRINT.md`](./MASTER_BLUEPRINT.md) (v4.0)
**Fungsi:** menjembatani **product intent** (blueprint) dengan **design surface + logic** (prototype v3), supaya setiap fitur bisa “ditabrakin” lalu direkonsiliasi di tengah.

---

## 0. Cara pakai dokumen ini

Dokumen ini bukan spec baru dan bukan pengganti blueprint. Ini **peta terjemahan** antara tiga lapisan:

```
MASTER_BLUEPRINT.md            proto/forecast-v3.html           FORECAST_V3_LOGIC.md
(product intent, API,           (design surface, UX,             (apa yang sebenarnya
 data model, aturan)             implementasi logic)              dihitung & kenapa)
        │                              │                              │
        └────────── dibandingkan ──────┴────── dijelaskan di sini ────┘
                              ↓
                   rekonsiliasi / keputusan
```

**Protokol tabrakan (per fitur):**

1. Cari fitur di **§5 (Input Reference)** atau **§9 (Collision Table)**.
2. Bandingkan kolom **Blueprint** vs **Prototype**.
3. Tentukan tipe gap: `LOGIC` (rumus/aturan beda), `DATA` (konstanta/SKU beda), `UX` (perilaku layar beda), `SCOPE` (belum dibangun).
4. Putuskan: **adopt blueprint**, **adopt prototype**, atau **kompromi** — lalu catat di §10 Decision Log.
5. Kalau prototype diubah, update angka snapshot & tabel dampak di §6.

> Aturan emas: **setiap input di prototype harus punya alasan produk.** Kalau tidak ada anchor-nya di blueprint, itu harus ditandai sebagai *intentional deviation*, bukan diam-diam.

---

## 1. Hierarki sumber kebenaran

| Prioritas | Sumber | Menang untuk |
|---|---|---|
| 1 | `MASTER_BLUEPRINT.md` | Aturan produk, semantik pity, kontrak API, data model |
| 2 | `proto/forecast-v3.html` | Angka konkret yang benar-benar dihitung & tampil hari ini |
| 3 | Dokumen ini | Penjelasan perilaku, dependency map, daftar gap |

Kalau §1 dan §2 berbeda, **itu gap**, bukan bug — dan wajib masuk §9.

---

## 2. Model mental: tiga lapisan

Semua angka di UI lahir dari tiga lapisan berurutan. Tidak ada lapisan yang melompati lapisan lain.

```
┌─────────────────────────────────────────────────────────────────┐
│ LAPIS 1 · ECONOMY (deterministik)                               │
│ end date → hari / minggu / bulan kalender                       │
│ → orundum farming + login permit + green cert + inventory       │
│ → semua dikonversi ke PULL (1 pull = 600 ORU)                    │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│ LAPIS 2 · BASKET (per tier, per bulan)                          │
│ budget cap tier → optimizer beli produk terbaik                 │
│ → basket bulanan ($/mo, pulls/mo) → diperluas ke window         │
│ → total pull per tier (F2P → LEVIATHAN)                         │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│ LAPIS 3 · PROBABILITY (pity DP)                                 │
│ total pull tier + required copies + P(target|6★) + spark        │
│ → kurva P(TARGET) vs pull → badge per tier                      │
└─────────────────────────────────────────────────────────────────┘
```

**Konsekuensi penting:** lapisan 3 **tidak** tahu soal uang, bulan, atau basket. Dia hanya menerima *jumlah pull*. Jadi kalau ada yang aneh di badge, biasanya masalahnya di lapisan 1–2 (jumlah pull), bukan di probabilitas.

---

## 3. Konstanta & satuan

| Konstanta | Nilai | Arti |
|---|---|---|
| `PULL_COST` | 600 | 1 pull = 600 Orundum |
| `OP_ORUNDUM` | 180 | 1 Originite Prime = 180 Orundum (pada konversi 100%) |
| `CYCLE_DAYS` | 30 | Siklus reset Monthly Card & Monthly HH Pack |
| `DAY_MS` | 86 400 000 | Aritmetika hari |
| `CERT_STAGES` | 10/1, 18/2, 40/5, 70/10, 120/20 | (biaya cert → pull) per tier shop |
| `horizon` | `min(900, max(350, ceil(maxTotal)+40))` | Batas atas pull yang disimulasikan DP |
| `TIERS` | F2P, MINNOW, GOLDFISH, DOLPHIN, WHALE, LEVIATHAN | 6 profil belanja bulanan |

**Archetype (`ARCH`):**

| Archetype | `rateUp` | Isolated | Spark | Guarantee | Free pulls |
|---|---|---|---|---|---|
| LIMITED | 70% | ya | 300 | — | 24 |
| EVENT | 50% | tidak | — | 150 | 0 |
| STANDARD | 50% | tidak | — | — | 0 |
| CROSSOVER | 100% | ya | 120 | — | 0 |
| KERNEL | 50% | tidak | — | — | 0 |

> `rateUp` **hanya** dipakai di mode PULLS untuk info. Di mode POTENTIAL, peluang target selalu datang dari input user (`targetSixStarProbability`), sesuai blueprint §5.1.

---

## 4. Dua knob probabilitas — versi awam (dan versi rumus)

Ini bagian yang paling sering salah baca. Ada **dua angka berbeda** di layar:

| Label di UI | Arti | Sifat |
|---|---|---|
| `P(TARGET \| 6★)` | Kalau 6★ keluar, seberapa besar isinya target? | **Fakta banner** (input) |
| `CONFIDENCE` 50/80/90/95 | Kamu mau seberapa yakin? | **Keputusan kamu** (threshold) |
| `P(TARGET)` di kartu | Peluang tier itu mencapai target | **Hasil hitungan** |

### 4.1 Versi awam

> **35% = kualitas undiannya. 90% = seberapa yakin kamu mau.**

- `35%` itu **bukan** peluang dapat target per pull. Itu peluang target **setelah** 6★ sudah muncul. 6★ sendiri jarang (2% dasar, naik setelah 49 pull tanpa 6★).
- Peluang target per satu pull kira-kira `2% × 35% ≈ 0,7%`.
- Karena pull-nya ratusan, peluangnya menumpuk. Mesin pity membuat **kurva** “peluang dapat target vs jumlah pull”.
- `CONFIDENCE` cuma **memilih satu titik** di kurva itu: “aku butuh pull berapa supaya yakin 90%?”

**Cara baca pilihan confidence:**

| Pilihan | Arti | Butuh pull (default: LIMITED, POT 1, 35%) |
|---|---|---|
| **50%** | Koin. Coba-coba, siap gagal setengah | **70 pull** |
| **80%** | Kompromi wajar, masih bisa zonk 1 dari 5 | **153 pull** |
| **90%** | Default aman. 9 dari 10 dapat | **212 pull** |
| **95%** | Nyaris pasti. 19 dari 20 dapat | **272 pull** |

Dari 90% → 95% cuma +5 poin, tapi butuh **+60 pull**. Itu sebabnya 90% jadi default.

**Cara baca kartu tier:**

> “Saya minta 90% yakin. Tier ini kasih 87,2% → belum lulus. Tier sebelah kasih 91,9% → lulus.”

Contoh snapshot default (**as-of 2026-11-10, end 2027-02-08**, 90 hari / 13 weekly reset / 4 bulan kalender):

| Tier | Total pull | `P(TARGET)` | Badge | Arti |
|---|---|---|---|---|
| F2P | 190 | 87,2% | `LIKELY` | di bawah standar 90% |
| MINNOW | 230 | 91,9% | `FEASIBLE` | tier termurah yang lulus |
| GOLDFISH | 261 | 94,4% | `FEASIBLE` | lulus |
| DOLPHIN | 374 | 100% | `GUARANTEED` | spark menjamin |
| WHALE | 854 | 100% | `GUARANTEED` | spark menjamin |
| LEVIATHAN | 971 | 100% | `GUARANTEED` | spark menjamin |

**Panduan praktis:**

- Hemat / cuma coba → **50%**, lihat tier termurah, terima risiko.
- Pemain normal → **90%** (default).
- Karakter wajib / anti-FOMO → **95%**, siap naik 1–2 tier.
- Kalau banner sebenarnya rate-up tunggal 50% (bukan split), ganti input `35` → `50`; butuh 90% turun jadi **142 pull** dan F2P langsung lulus.

### 4.2 Versi rumus (untuk implementasi)

```js
sixStarProb(q) = q < 50 ? 0.02 : min(0.02 + 0.02*(q-49), 1)
pT             = guaranteeAktif ? 1 : probTarget
perPullTarget  = sixStarProb(q) * pT
```

Tiga transisi DP per pull:

```
tanpa 6★       p × (1 − p6)        → copies tetap, q+1
6★ target      p × p6 × pT         → copies+1 (cap required), q=0
6★ bukan target p × p6 × (1 − pT)  → copies tetap, q=0
```

Agregasi:

```
success[n]       = Σ p(state) where copies + spark(n) >= required   → P(TARGET)
chanceTarget[n]  = 1 − P(copies = 0) + spark(n)                     → ≥1 copy
expected[n]      = E[min(copies + spark(n), required)]
```

Sanity check intuisi: tanpa pity, 212 pull × 0,7% ≈ 77% — pity yang mendorong ke **90%**. Jadi pity bukan detail kosmetik; dia yang menutup gap 13 poin itu.

---

## 5. Input Reference

Format tiap entri:

- **Kenapa ada** — alasan produk
- **Cara kerja** — rumus / jalur data
- **Nyambung ke** — input & output lain
- **Catatan** — edge case / gap

Semua input disimpan di objek `state` dan dirender ulang lewat `render()`.

---

### Step 01 — TARGET

#### TGT-01 · Banner Archetype (`#fArch`)

| | |
|---|---|
| Kontrol | Select: LIMITED / EVENT / STANDARD / CROSSOVER / KERNEL |
| Default | `LIMITED` |
| State | `state.arch` |
| Blueprint | §4.1 Predefined Archetypes |

**Kenapa ada.** MVP tidak memakai scraper nama banner. Archetype adalah cara user menyatakan “aturan banner apa yang berlaku” tanpa database live. Satu pilihan ini membawa satu set aturan pity.

**Cara kerja.** Memilih satu objek `ARCH[...]` yang menyuntik:

- `rateUp` → dipakai sebagai `probTarget` **hanya di mode PULLS**
- `isolated` → menentukan apakah `current_pity` dipakai (`startPity = 0` kalau isolated)
- `spark` → jumlah pull untuk 1 copy deterministik
- `guaranteeAt` → setelah pull ke-N, 6★ berikutnya pasti target
- `freePulls` → bonus pull arketipe (LIMITED: 10 multi + 14 daily = 24)

**Nyambung ke.** `TGT-04` (kalau spark, `targetPulls` ikut di-set), `TGT-08` (sumber prob di mode PULLS), `RES-07` (disable pity kalau isolated), `OUT-P` (spark/guarantee mengubah kurva), `OUT-STAT` (GUARANTEED).

**Catatan.** Ganti archetype **tidak** mereset `state.prob`. Kalau user pindah dari LIMITED ke EVENT, angka 35% tetap; ini benar untuk mode POTENTIAL (peluang target adalah input user), tapi bisa mengejutkan. Di mode PULLS, `probTarget` otomatis ikut archetype.

---

#### TGT-02 · Target End Date (`#fEnd`)

| | |
|---|---|
| Kontrol | Text `DD/MM/YYYY`, `inputmode=numeric`, max 10 |
| Default | hari ini + 90 hari |
| State | `state.endDate` (ISO `YYYY-MM-DD` internal) |
| Blueprint | §5.2 Calendar-Month Rules |

**Kenapa ada.** Semua income deterministik bergantung pada horizon. Ini satu-satunya input waktu.

**Cara kerja.**

- User mengetik `DD/MM/YYYY` → `dmyToISO()` memvalidasi tanggal nyata (menolak `31/02/2026`), menyimpan ISO.
- `calendarInfo()` menurunkan:
  - `days` = selisih hari `(as_of, end]`
  - `weeks` = jumlah hari Senin dalam rentang itu
  - `months` = bucket bulan kalender dari tanggal 1 bulan berjalan sampai end
- Tampilan header memakai `isoToDMY()` supaya tetap `DD/MM/YYYY`.

**Nyambung ke.** Semua output lapis 1: farming harian/mingguan, login permit, green cert, dan window basket (`CYCLE_DAYS`) — lalu ke total pull tiap tier.

**Catatan.**

- Tanggal masa lalu tidak diblokir. `days` jadi 0, dan `months` bisa kosong (kalau end sebelum tanggal 1 bulan berjalan) atau tetap 1 — income jadi 0 atau hanya 1 bulan. **Disarankan guard**: tolak tanggal ≤ hari ini.
- Format ISO (`2027-02-07`) sengaja **ditolak** oleh `dmyToISO()` — hanya DMY.
- Perubahan tanggal tidak mengubah kurva probabilitas, hanya jumlah pull yang tersedia.
- **Bug fix 10 Nov 2026:** helper `defaultDate()` dulu memakai `toISOString()` (UTC), sehingga di timezone WIB (UTC+7) default “+90 hari” turun jadi 89 hari tergantung jam pemakaian. Sekarang memakai komponen tanggal **lokal** (`getFullYear/getMonth/getDate`), jadi stabil 90 hari / 13 weekly reset.

---

#### TGT-03 · Target Mode (`#modeSeg`)

| | |
|---|---|
| Kontrol | Segmented: `TARGET PULLS` / `TARGET POTENTIAL` |
| Default | `POTENTIAL` |
| State | `state.mode` |
| Blueprint | §5 Pity & Target Modes |

**Kenapa ada.** Dua pertanyaan user berbeda: *“cukup nggak dapat 300 pull?”* vs *“berapa peluang dapat 1 copy?”*. Dua mode ini yang membedakan.

**Cara kerja.**

| | PULLS | POTENTIAL |
|---|---|---|
| Field tampil | `TGT-04` | `TGT-05..09` |
| `probTarget` | `arch.rateUp` | `state.prob` |
| Badge | `total >= targetPulls` → FEASIBLE, else DEFICIT (GUARANTEED kalau spark terpenuhi) | `prob >= confidence` → FEASIBLE |
| Angka kedua di kartu | surplus / short pull | `P(TARGET)` |
| Benchmark | `targetPulls` | `reqPulls @ confidence` |

**Nyambung ke.** `TGT-04`, `TGT-08`, `TGT-09`, semua badge, `OUT-BM`, `OUT-RQ`, teks advisory.

**Catatan.** Di mode PULLS, `state.pot` tetap tersimpan dan tetap dipakai DP internal (`requiredCopies`), tapi **tidak** dipakai untuk badge. Ini quirk yang perlu diputuskan saat rekonsiliasi: kalau mode PULLS seharusnya murni hitung pull, DP-nya bisa di-skip.

---

#### TGT-04 · Target Pulls (`#fPulls`)

| | |
|---|---|
| Kontrol | Number 1–2000, step 1 |
| Default | 300 |
| State | `state.targetPulls` |
| Blueprint | §5 Mode 1 (Sparking) |

**Kenapa ada.** Untuk mode sparking: user tahu dia butuh 300 pull (LIMITED) atau 120 (CROSSOVER), dan ingin tahu tier mana yang sampai.

**Cara kerja.** Jadi `benchmark`, dan `t.clear = total >= targetPulls`. Tidak mempengaruhi kurva probabilitas.

**Nyambung ke.** `OUT-BM`, badge mode PULLS, delta surplus/short, `minTier`, advisory.

**Catatan.** Saat archetype punya spark, nilai ini otomatis di-set ke spark (`syncArch`). User masih bisa override manual.

---

#### TGT-05 · Target Pot (`#fPot`)

| | |
|---|---|
| Kontrol | Select 1–6 |
| Default | 1 |
| State | `state.pot` |
| Label UI | `TARGET POTENTIAL` (di-update 10 Nov 2026) |
| Blueprint | §5.1 Target Copy Semantics |

**Kenapa ada.** Pot adalah **level pot yang ingin dicapai**. Copy yang dibutuhkan dihitung dari selisih dengan Current Pot (TGT-06). Tanpa ini, aplikasi tidak bisa menjawab “berapa peluang max pot”.

**Cara kerja.** `requiredCopies = max(0, pot − curPot)`. Nilai ini menjadi **cap** di DP: begitu copy mencapai `required`, state dianggap sukses.

**Nyambung ke.** `OUT-P`, `OUT-CT`, `OUT-RQ`, status GUARANTEED (kalau spark ≥ required).

**Catatan.** Menaikkan pot dari 1 ke 2 **bukan** menggandakan pull; karena copies di-cap, kurvanya jadi lebih landai (butuh jauh lebih banyak pull).

---

#### TGT-06 · Current Pot (`#fCurPot`)

> **Status 10 Nov 2026 (R23):** field ini **dikembalikan**. Default `0` = operator belum dimiliki. Diletakkan **di kiri Target Pot** dalam satu baris dua kolom.

| | |
|---|---|
| Kontrol | Select 0–6 |
| Default | 0 (`POTENTIAL 0 · NOT OWNED`) |
| State | `state.curPot` |
| Label UI | `CURRENT POTENTIAL` |
| Blueprint | §5.1 `currentTargetPotential` |
| Data-i18n | `step1.currentPot`, `step1.pot0` |

**Cara kerja.** `requiredCopies = max(0, state.pot − state.curPot)`. Kalau current ≥ target, kebutuhan copy = 0 dan semua tier `GUARANTEED` tanpa pull.

**Nyambung ke.** `requiredCopies`, `OUT-RQ`, status GUARANTEED, hint di bawah kedua field.

---

#### TGT-07 · Target Availability (`#fAvail`)

| | |
|---|---|
| Kontrol | Select: FEATURED / OFF_BANNER / ABSENT |
| Default | FEATURED |
| State | `state.avail` |
| Blueprint | §5.1 `availability` |

**Kenapa ada.** Operator bisa tidak ada di banner. Ini memisahkan “peluang kecil” dari “mustahil”.

**Cara kerja.**

- `ABSENT` → `probTarget = 0`, `spark = null`, `guaranteeAt = null`, input prob di-disable dan dipaksa 0.
- `FEATURED` / `OFF_BANNER` → pakai `state.prob` apa adanya. Perbedaan keduanya **semantik**, bukan matematis: user yang menentukan angkanya.

**Nyambung ke.** `TGT-08`, `TGT-01` (guarantee & spark), semua output.

**Catatan.** Di mode PULLS, `ABSENT` juga mematikan klaim spark.

---

#### TGT-08 · `P(TARGET | 6★)` (`#fProb`)

| | |
|---|---|
| Kontrol | Number 0–100, step 1 |
| Default | 35 |
| State | `state.prob` (0–1) |
| Blueprint | §5.1 `target_six_star_probability` |

**Kenapa ada.** Ini **inti** akurasi. Archetype hanya tahu total rate-up; peluang operator **tunggal** harus dinyatakan eksplisit. Contoh: dua rate-up 6★ membagi 50% → target tunggal 25%.

**Cara kerja.** Menjadi `pT` di setiap transisi 6★ (kecuali guarantee aktif, maka `pT = 1`). Perubahan 1 poin di sini menggeser seluruh kurva.

**Nyambung ke.** `TGT-01` (di mode PULLS nilai ini diabaikan), `TGT-03`, `TGT-07`, `OUT-P`, `OUT-CT`, `OUT-RQ`, `minTier`.

**Catatan.** Hint UI menyebut split rate-up: “50% / 2 = 25%”. Nilai default 35% adalah asumsi **satu operator di slot rate-up**, bukan angka resmi banner. Ini harus tetap *user-editable*.

---

#### TGT-09 · Confidence Target (`#confChips`)

| | |
|---|---|
| Kontrol | Chips 50% / 80% / 90% / 95% |
| Default | 90% |
| State | `state.confidence` |
| Blueprint | §5.1 `confidence_target` |

**Kenapa ada.** “Peluang 60%” tidak berarti apa-apa tanpa standar kelulusan. Confidence adalah garis lulus yang dipilih user.

**Cara kerja.**

- `FEASIBLE` kalau `t.prob >= confidence`
- `reqPulls` = `n` terkecil dengan `dp.success[n] >= confidence`
- `benchmark` (mode POTENTIAL) = `reqPulls` (fallback `ceil(maxTotal)` kalau tidak tercapai)
- `P(REACH x%)` di Outlook = `t.prob` dibandingkan lagi dengan threshold yang sama

**Nyambung ke.** `OUT-STAT`, `OUT-BM`, `OUT-RQ`, `minTier`, `clearTiers`, teks advisory, label kartu matriks.

**Catatan.** Confidence **tidak** mengubah kurva. Dia hanya menggeser titik potong. Karena itu, dua user dengan input sama tapi confidence beda bisa dapat `minTier` berbeda tanpa ada angka probabilitas yang berubah.

---

### Step 02 — RESOURCES

#### RES-01 · Orundum (`#fOrundum`)

| | |
|---|---|
| Kontrol | Number ≥ 0, step 100 |
| Default | 12 500 |
| State | `state.orundum` |
| Blueprint | §5.2 `inventorySnapshot.orundum` |

**Kenapa ada.** Stok awal adalah sumber pull **one-time** terbesar bagi pemain lama.

**Cara kerja.** `inventoryPulls += orundum / 600`. Dihitung sekali di total window, **tidak** masuk `pulls/mo` (karena bukan income recurring).

**Nyambung ke.** total pull tiap tier → `P(TARGET)`, badge, `minTier`.

**Catatan.** Tidak dikenai `OP conversion %` (memang sudah Orundum).

---

#### RES-02 · Originite Prime (`#fOP`)

| | |
|---|---|
| Kontrol | Number ≥ 0, step 1 |
| Default | 45 |
| State | `state.op` |
| Blueprint | §5.2 inventory + §5.1 konversi |

**Kenapa ada.** OP adalah currency premium yang bisa dikonversi ke Orundum.

**Cara kerja.** `inventoryPulls += op × 180 × (opPct/100) / 600`. Nilainya **ikut** slider `RES-08`.

**Nyambung ke.** `RES-08`, total pull, badge.

**Catatan.** OP yang dipakai untuk skin/sanity tidak dimodelkan; user menurunkannya lewat `RES-08`.

---

#### RES-03 · HH Ticket 1× (`#fHH1`)

| | |
|---|---|
| Kontrol | Number ≥ 0, step 1 |
| Default | 10 |
| State | `state.hh1` |

**Kenapa ada.** Permit tunggal adalah pull instan tanpa konversi.

**Cara kerja.** `+1 pull` per tiket, langsung ditambahkan ke inventory pulls.

**Nyambung ke.** `RES-04`, total pull.

**Catatan.** Digabung dengan `RES-04` menjadi `invTickets`.

---

#### RES-04 · HH Ticket 10× (`#fHH10`)

| | |
|---|---|
| Kontrol | Number ≥ 0, step 1 |
| Default | 1 |
| State | `state.hh10` |

**Kenapa ada.** Ten-roll ticket punya nilai 10 pull dan sering jadi stok terpisah.

**Cara kerja.** `+10 pull` per tiket.

**Nyambung ke.** `RES-03`, total pull.

**Catatan.** Tidak ada bonus/garansi khusus ten-roll di model.

---

#### RES-05 · Yellow Certs (`#fCerts`)

| | |
|---|---|
| Kontrol | Number ≥ 0, step 1 |
| Default | 180 |
| State | `state.certs` |
| Blueprint | §5.2 Green Cert shop (hanya tier 1) vs Yellow Cert shop |

**Kenapa ada.** Yellow cert bisa ditukar permit dengan tangga harga bertingkat.

**Cara kerja.** `calcYellowCertPulls(certs, shop, futureMonths)`:

1. **Bulan berjalan:** mulai dari tier yang belum dibersihkan (`shop`), beli selama saldo cukup.
2. **Bulan-bulan berikutnya:** setiap reset, ulangi dari Tier 1 dengan **saldo yang sama** (stok dibelanjakan lintas reset, bukan income baru).
3. Sisa cert dilaporkan sebagai `remaining` (tidak dipakai).

**Nyambung ke.** `RES-06`, total pull, breakdown “YELLOW CERTS”.

**Catatan.** Model tidak menambah income cert baru; stok yang ada dibelanjakan lintas reset bulanan. Ini konsisten dengan prinsip deterministik blueprint, tapi **berbeda** dengan green cert shop (600 ORU + 4 permit/bulan) yang diasumsikan selalu bisa dibeli — lihat R16 di §9.

---

#### RES-06 · Shop Tier Cleared (`#fShop`)

| | |
|---|---|
| Kontrol | Select 0–5 |
| Default | 2 |
| State | `state.shop` |

**Kenapa ada.** User yang sudah membersihkan tier bawah tidak bisa membelinya lagi bulan ini. Tanpa ini, pull dari cert akan diovercount.

**Cara kerja.** Menjadi **index awal** loop pembelian cert bulan berjalan. `0` = mulai dari Tier 1; `2` = Tier 1–2 dilewati, mulai Tier 3.

**Nyambung ke.** `RES-05`.

**Catatan.** Untuk bulan-bulan berikutnya, loop selalu mulai dari Tier 1 (reset).

---

#### RES-07 · Current Pity (`#fPity`)

| | |
|---|---|
| Kontrol | Number 0–98, step 1 |
| Default | 0 |
| State | `state.pity` |
| Blueprint | §5.1 `consecutiveNonSixStarPullsBeforeCurrentPull` + §7.2 |

**Kenapa ada.** Counter pity yang sudah berjalan sangat mempengaruhi pull berikutnya. Abai soal ini = forecast terlalu pesimis untuk pemain aktif.

**Cara kerja.** `startPity = arch.isolated ? 0 : min(98, pity)`. Di DP, `q` mulai dari nilai ini dan naik 1 tiap pull tanpa 6★, reset 0 saat 6★.

**Nyambung ke.** `TGT-01`, `OUT-P`, `OUT-CT`, `OUT-RQ`, durasi sampai 6★ pertama.

**Catatan.** Untuk LIMITED & CROSSOVER input **di-disable** (isolated pity), sesuai blueprint §7.2. Nilai tetap tersimpan agar tidak hilang saat ganti archetype.

---

#### RES-08 · OP Conversion (`#fOPPct`)

| | |
|---|---|
| Kontrol | Range 0–100, step 5 |
| Default | 100 |
| State | `state.opPct` |
| Blueprint | §5 `opConversionPercentage` |

**Kenapa ada.** Tidak semua orang mau menghabiskan OP untuk gacha; sebagian disimpan untuk skin/sanity. Ini satu knob untuk “seberapa agresif OP dipakai”.

**Cara kerja.** Mengalikan **semua** sumber OP:
- inventory OP (`RES-02`)
- OP dari Monthly Card, HH Pack, dan OP packs di basket
- karena itu juga mempengaruhi `pulls/mo` dan total tiap tier

**Nyambung ke.** `RES-02`, seluruh lapisan basket, total pull, badge, `minTier`.

**Catatan.** Menurunkan ke 0% tidak mematikan pembelian pack; hanya mematikan nilai Orundum-nya. Ini bisa terasa aneh (bayar tapi 0 pull) — kandidat perbaikan UX.

---

#### RES-09 · Leviathan OP Packs (`#fLevi130/66/40/20`)

| | |
|---|---|
| Kontrol | Number 0–99 per SKU (OP130, OP66, OP40, OP20) |
| Default | OP130 = 1, sisanya 0 |
| State | `state.levi{op130,op66,op40,op20}` |
| Blueprint | §3 LEVIATHAN + §8 `opPacksToBuy` |

**Kenapa ada.** LEVIATHAN didefinisikan sebagai “$500+/mo”, jadi butuh cara menambah di atas basket $500 standar. Tanpa input ini, tier LEVIATHAN tidak bisa dikustomisasi.

**Cara kerja.** `basketForTier("LEVIATHAN")` = `optimizeBasket(500)` **+** pack pilihan user. Pack dianggap normal (tanpa first-time bonus) dan unlimited, jadi hanya dijumlahkan.

**Nyambung ke.** Hanya baris/pill LEVIATHAN. Tier lain tidak terpengaruh (dijamin oleh test monotonicity).

**Catatan.** Panel hanya muncul saat LEVIATHAN dipilih di Outlook. Blueprint menyebut `pack_50_op`; katalog prototype tidak punya SKU 50 OP (ada 40/66/130). Ini gap data yang harus diputuskan.

---

### Step 03 — MATRIX

#### MTX-01 · Tier Selection (`.tier` cards)

| | |
|---|---|
| Kontrol | Klik kartu tier |
| Default | `WHALE` |
| State | `state.selected` |

**Kenapa ada.** Matriks menampilkan 6 profil sekaligus, tapi detail (breakdown, pity, advisory) hanya untuk satu tier. Kartu adalah pemilih “tier yang sedang diperiksa”.

**Cara kerja.** Set `state.selected` → `render()` → `OUT-01` dan panel breakdown ikut berganti. **Tidak** mengubah perhitungan apa pun.

**Nyambung ke.** `OUT-01`, breakdown, pity grid, advisory, panel LEVIATHAN.

**Catatan.** Kartu menampilkan: nama tier, badge, aturan spend, `$/mo`, `pulls/mo`, komposisi basket, total window, dan `P(TARGET)` (mode POTENTIAL) atau surplus/short (mode PULLS). Tier dengan badge `FEASIBLE`/`GUARANTEED` pertama diberi label `START`.

---

### Step 04 — OUTLOOK

#### OUT-01 · Tier Pills (`.tier-pill`)

| | |
|---|---|
| Kontrol | Klik pill |
| State | `state.selected` (sama dengan `MTX-01`) |

**Kenapa ada.** Supaya user bisa bandingkan breakdown antar tier tanpa balik ke Step 03.

**Cara kerja.** Identik dengan `MTX-01`; dua kontrol, satu state.

**Catatan.** Sinkron dua arah: memilih di matriks akan menyorot pill yang sama.

---

#### OUT-02 · Save / Deploy (`#saveBtn`, `#deployBtn`)

| | |
|---|---|
| Kontrol | Tombol aksi |
| State | `state.signedIn`, `state.shareDur` |
| Blueprint | §7.3 Action Bar + §9 share |

**Kenapa ada.** Dua fitur premium: simpan forecast dan bagikan tautan dinamis (SSR OG).

**Cara kerja (prototype).** Placeholder: klik → modal auth → toast sukses (`SESSION op-xxxx` / `SHARE LINK LIVE`). **Belum** ada persistensi, API call, atau slug nyata.

**Nyambung ke.** Tidak mempengaruhi perhitungan.

**Catatan.** Ini gap `SCOPE` paling besar vs blueprint (DB, auth JWT, share route). Jangan dianggap sudah selesai.

---

## 6. Dependency Map

Baris = input, kolom = output. `●` = pengaruh langsung, `○` = tidak langsung.

| Input | Farming | Basket/total | `P(TARGET)` | Benchmark | Badge | `$/mo` | Advisory |
|---|---|---|---|---|---|---|---|
| TGT-01 archetype | ○ | ○ | ● | ● | ● | ○ | ● |
| TGT-02 end date | ● | ● | ○ | ● | ● | ○ | ● |
| TGT-03 mode | ○ | ○ | ○ | ● | ● | ○ | ● |
| TGT-04 target pulls | — | — | — | ● | ● | — | ● |
| TGT-05 pot | — | — | ● | ● | ● | — | ● |
| TGT-06 cur pot | — | — | ● | ● | ● | — | ● |
| TGT-07 availability | — | — | ● | ● | ● | — | ● |
| TGT-08 P(target\|6★) | — | — | ● | ● | ● | — | ● |
| TGT-09 confidence | — | — | ○ | ● | ● | — | ● |
| RES-01 orundum | ● | ● | ● | ● | ● | ○ | ● |
| RES-02 OP | ● | ● | ● | ● | ● | ○ | ● |
| RES-03 HH 1× | ● | ● | ● | ● | ● | ○ | ● |
| RES-04 HH 10× | ● | ● | ● | ● | ● | ○ | ● |
| RES-05 certs | ● | ● | ● | ● | ● | ○ | ● |
| RES-06 shop tier | ● | ● | ● | ● | ● | ○ | ● |
| RES-07 pity | ○ | — | ● | ● | ● | — | ● |
| RES-08 OP % | ● | ● | ● | ● | ● | ○ | ● |
| RES-09 Levi packs | — | ● (LEVI only) | ● (LEVI only) | ● (LEVI only) | ● (LEVI only) | ● (LEVI only) | ● |
| MTX-01 selection | — | — | — | — | — | — | ● |

**Urutan eksekusi aktual (`computeState`):**

```
endDate → calendarInfo
archetype + avail → probTarget, guaranteeAt, spark
pot → requiredCopies
inventory + certs + archetype bonus → lines (one-time)
tier cap → optimizer → basket → window (recurring)
lines + window → total per tier
total + required + pT + pity + spark → DP
DP + confidence → prob, reqPulls, status
```

---

## 7. Output glossary

| ID | Output | Rumus | Dipakai di |
|---|---|---|---|
| `OUT-TOT` | `total` | Σ semua `lines` per tier (farming, login, green, inventory, OP inv, card, HH, packs, certs, archetype bonus) | Kartu, breakdown |
| `OUT-MO` | `monthlyPulls` | `(farming+login+green)/months + (card+hh+op)/months` — **recurring saja** | Kartu `pulls/mo`, breakdown sub |
| `OUT-USD` | `monthlySpend` | `basket.spend` | Kartu `$/mo` |
| `OUT-P` | `P(TARGET)` (`t.prob`) | `dp.success[min(total, horizon)]` | Kartu, `P(REACH x%)` |
| `OUT-CT` | `chanceTarget` | `1 − P(0 copy) + spark` | “CHANCE TARGET COPY” |
| `OUT-EXP` | `expected` | `E[min(copies+spark, required)]` | Info pendukung, **bukan** dasar badge |
| `OUT-RQ` | `reqPulls` | `min n` dengan `success[n] >= confidence` | `PULLS @ CONF` |
| `OUT-BM` | `benchmark` | mode PULLS → `targetPulls`; POTENTIAL → `reqPulls` | Header stat, delta |
| `OUT-CL` | `clearTiers` | tier yang FEASIBLE/GUARANTEED (atau `total >= targetPulls`) | `x OF 6`, `minTier` |
| `OUT-MIN` | `minTier` | `clearTiers[0]` (urutan F2P → LEVIATHAN) | `MIN VIABLE TIER`, label `START` |
| `OUT-STAT` | `status` | GUARANTEED / FEASIBLE / LIKELY / DEFICIT | Badge |
| `OUT-6` | `anySixCurve` | DP terpisah: `P(≥1 6★ dalam n pull)` | “CHANCE ANY 6★” |

**Urutan status (evaluasi berhenti di yang pertama cocok):**

```js
if (requiredCopies === 0 || sparkAtTier(total) >= requiredCopies) → GUARANTEED
else if (prob >= confidence)                                      → FEASIBLE
else if (prob > 0.5)                                              → LIKELY
else                                                              → DEFICIT
```

> `expected` sengaja **bukan** dasar badge — sesuai blueprint §5: *“Expected Value hanya sebagai informasi pendukung”*.

---

## 8. Asumsi & invariant

### 8.1 Asumsi pesimistis (disengaja)

| Asumsi | Konsekuensi |
|---|---|
| Tanpa first-time OP bonus | Semua pack dihargai normal |
| Tanpa starter pack / event pack | Hanya katalog recurring + OP normal |
| Reset 30 hari untuk card & HH pack | Bukan bulan kalender |
| `CYCLE_DAYS = 30` | Window 90 hari = 3 siklus penuh |
| Green cert shop Tier 1 diasumsikan dibersihkan tiap bulan | 600 ORU + 4 permit/bulan |
| Annihilation diasumsikan 1800/minggu | Tidak bisa dikonfigurasi (gap) |
| Income deterministik saja | Event/compensation/story tidak dihitung |

### 8.2 Invariant yang harus selalu benar

1. **Monotonic total:** `total(F2P) ≤ total(MINNOW) ≤ … ≤ total(LEVIATHAN)`.
2. **Monotonic prob:** `P(TARGET)` tidak turun saat total pull naik.
3. **Budget cap:** `monthlySpend ≤ tier.cap` (kecuali LEVIATHAN yang memang unbounded).
4. **LEVIATHAN isolation:** mengubah `RES-09` **hanya** mengubah baris LEVIATHAN.
5. **Required = Pot − Current:** `requiredCopies = max(0, pot − curPot)` (0 = sudah tercapai). GUARANTEED lewat current ≥ target atau spark (`sparkAtTier >= required`).
6. **ABSENT → 0%:** tidak ada jalur yang menghasilkan prob > 0.
7. **Isolated → pity 0:** `startPity` tidak boleh > 0 untuk LIMITED/CROSSOVER.

### 8.3 Cara verifikasi cepat

Prototype mengekspos `window.__PRTS__`:

```js
const P = window.__PRTS__;
P.state;                 // seluruh input
P.compute();             // view lengkap (tiers, dp, benchmark, ...)
P.dp;                    // hasil DP terakhir
P.optimizeBasket(99.99, 100);   // basket untuk budget tertentu
P.basketForTier(tier, 100);
```

Uji yang sudah dijalankan: sweep 7–500 hari × OP 0–100% (0 kegagalan monotonicity), dan perbandingan optimizer vs exact DP (0 selisih).

---

## 9. Collision Table — prototype vs blueprint

Status: `MATCH` · `GAP` · `INTENTIONAL` · `SCOPE` · `DECIDED`

| # | Area | MASTER_BLUEPRINT | Prototype v3 | Tipe | Status | Usul rekonsiliasi |
|---|---|---|---|---|---|---|
| R1 | Jumlah tier | **5**: F2P, GOLDFISH, DOLPHIN, WHALE, LEVIATHAN | **6**: + MINNOW ($0.01–$9.99) | UX + LOGIC | **DECIDED** | Tambah MINNOW; blueprint §3 di-update mengikuti design |
| R2 | Eligibility bulan berjalan | Default **false** untuk login permit & green cert bulan ini | Bulan berjalan **selalu** dihitung (`months.length`) | LOGIC | PENDING | Usul: satu toggle default ON + sensitivity line (`FORECAST_V3_IMPLEMENTATION.md` §2.1) |
| R3 | Annihilation | `expectedAnnihilationClear` 0–1800, user-set | Hardcode **1800** | LOGIC | GAP | Jadikan input di Step 02 |
| R4 | OP conversion default | Contoh 80% | Default **100%** | DATA/UX | GAP | Samakan default (80% lebih konservatif) atau beri preset |
| R5 | Route settings | Boolean eksplisit: `isMonthlyCardActive`, `monthlyHeadhuntingPacksToBuy`, `opPacksToBuy` | Diturunkan otomatis via **budget cap + optimizer** | LOGIC | **DECIDED** | Design-first: user pilih tier, optimizer pilih produk; update blueprint |
| R6 | SKU OP pack | `pack_130`, `pack_50`, `pack_20` | OP 130/66/40/20/6/1; **tidak ada 50** | DATA | **DECIDED** | Ikuti design (verified di app); hapus `pack_50` dari DTO |
| R7 | Badge | Hanya `FEASIBLE` / `DEFICIT` | 4 status: GUARANTEED / FEASIBLE / LIKELY / DEFICIT | UX | INTENTIONAL | Blueprint §5 sudah membolehkan GUARANTEED; LIKELY perlu ditambahkan ke spec |
| R8 | Layout | 2-column (input kiri, monitor kanan) | **Stepper** 4 langkah, single column 720px | UX | INTENTIONAL | Update blueprint §7.3 (stepper lebih mobile-first) |
| R9 | Pity input | Disable/hide untuk LIMITED & CROSSOVER | Disable (tetap terlihat dengan label `IGNORED`) | UX | MATCH | — |
| R10 | Confidence options | 50 / 80 / 90 / 95 | 50 / 80 / 90 / 95 | — | MATCH | — |
| R11 | `rateUp` semantics | Bukan otomatis peluang target tunggal | Di mode POTENTIAL tidak dipakai; mode PULLS hanya info | LOGIC | MATCH | — |
| R12 | Matrix content | `total_projected_pulls` + `deficit_pulls` | Tambah `$/mo`, `pulls/mo`, komposisi basket, `P(TARGET)` | UX | INTENTIONAL | Update kontrak response bila mau parity |
| R13 | “Days remaining” | Ditampilkan di matrix | Dipindah ke Outlook (`DAYS LEFT`) | UX | INTENTIONAL | Catat sebagai keputusan desain |
| R14 | Save / Share | Auth + DB + SSR OG + slug | Modal + toast placeholder | SCOPE | SCOPE | Belum dibangun; jangan dianggap selesai |
| R15 | PRTS advisory | BYOK LLM (OpenAI/Claude/Gemini) | Teks rule-based lokal | SCOPE | SCOPE | Sambungkan ke endpoint AI saat backend siap |
| R16 | Green cert shop | “Engine tidak mengasumsikan otomatis” | Tier 1 diasumsikan dibersihkan tiap bulan | LOGIC | PENDING | Usul: toggle R2 + hint 600 cert/bulan, tanpa input saldo (`FORECAST_V3_IMPLEMENTATION.md` §2.2) |
| R17 | Free pulls LIMITED | 1 ten-pull + 14 daily = 24 | 24 flat, ditambahkan ke total | LOGIC | GAP (minor) | Kalau window < 14 hari, 14 daily free pull tidak mungkin; perlu clamp |
| R18 | Horizon DP | Tidak disebut | Cap 900 pull | LOGIC | INTENTIONAL | Dokumentasikan; di atas 900 probabilitas di-evaluasi di 900. Snapshot LEVIATHAN 971 sudah menyentuh cap |
| R19 | USD spend input | Tidak ada | Sudah dihapus dari prototype | — | MATCH | — |
| R20 | Current Pot | `current_target_potential` + `requiredCopies = max(0, pot − curPot)` | ~~Field dihapus~~ — **dibatalkan R23** | LOGIC | **SUPERSEDED** | Lihat R23 |
| R23 | Current Pot (revisi) | — | **Dikembalikan**: select 0–6, default 0, di kiri Target Pot | LOGIC | **DECIDED** | `requiredCopies = max(0, pot − curPot)`; update design, blueprint §5.1, kontrak API |

### 9.1 Status setelah keputusan 10 Nov 2026

1. **R1, R5, R6, R23** — **selesai** (keputusan ada di §10). R20 dibatalkan R23. Blueprint sudah di-update.
2. **R2 & R16** — masih **PENDING**. Ini satu-satunya gap yang bisa bikin forecast **terlalu optimistis** dan berisiko user gagal. Usul detail di `FORECAST_V3_IMPLEMENTATION.md` §2.
3. **R3, R4, R17** — gap minor, bisa ditutup kapan saja: annihilation jadi input, OP default konsisten, clamp free pulls saat window < 14 hari.

---

## 10. Decision Log

| Tanggal | Item | Keputusan | Alasan | Dampak |
|---|---|---|---|---|
| 2026-11-10 | R1 | **6 tier**, MINNOW ditambahkan | Granularitas budget $0–$10 | Blueprint §3, response matrix jadi array |
| 2026-11-10 | R5 | **Design-first**: input = budget tier; optimizer pilih produk | UX design lebih jelas; blueprint menyesuaikan | Drop `isMonthlyCardActive`, `monthlyHeadhuntingPacksToBuy`, `opPacksToBuy` |
| 2026-11-10 | R6 | **Ikuti SKU design**: 130/66/40/20/6/1 | Sudah diverifikasi langsung di app | Hapus `pack_50_op` dari DTO; katalog jadi tabel |
| 2026-11-10 | R2 + R16 | **Usul**: satu toggle eligibility default ON + sensitivity line; tanpa input saldo green cert | Jujur tanpa menambah currency baru | Menunggu approval; lihat `FORECAST_V3_IMPLEMENTATION.md` §2 |
| 2026-11-10 | R20 | ~~**Hapus Current Pot**~~ **dibatalkan R23** | Pemangkasan input (revisi: field tetap dibutuhkan) | — |
| 2026-11-10 | R23 | **Kembalikan Current Pot** (`#fCurPot`, default 0, kiri Target Pot) | User perlu mulai dari pot yang sudah dimiliki | `requiredCopies = max(0, pot − curPot)`; design + blueprint §5.1 + API v2 di-update |

> Isi tabel ini setiap kali hasil “tabrakan” diselesaikan. Format: satu baris per keputusan, sebutkan R-number.

---

## 11. Pertanyaan terbuka

Sudah diputuskan: tier **6** (R1), input **budget-first** (R5), SKU **ikut design** (R6). Sisa:

1. **R2/R16:** default eligibility bulan berjalan ON atau OFF? (usul: ON + sensitivity line)
2. **Cert:** apakah stok yellow cert boleh diproyeksikan lintas beberapa reset (perilaku sekarang), atau hanya sekali?
3. **Badge `LIKELY`:** apakah masuk spec resmi, atau cukup `FEASIBLE`/`DEFICIT`?
4. **Mode PULLS:** apakah tetap menjalankan DP (untuk info) atau murni aritmetika pull?
5. **Horizon 900:** cukup untuk LEVIATHAN? Snapshot sekarang LEVIATHAN 971 pull, artinya sudah menyentuh cap.
6. **Implementasi:** lihat 9 pertanyaan terbuka di `FORECAST_V3_IMPLEMENTATION.md` §10 (snapshot share, preview FE, dsb.).

---

## 12. Peta file

| File | Isi |
|---|---|
| `MASTER_BLUEPRINT.md` | Product vision, arsitektur, API, data model, aturan pity |
| `FORECAST_V3_LOGIC.md` | Dokumen ini — terjemahan logic + input reference + gap |
| `FORECAST_V3_IMPLEMENTATION.md` | Kontrak implementasi: BE/FE/DB/API, diff schema, parity plan |
| `proto/forecast-v3.html` | Prototype stepper (UI + engine dalam satu file) |
| `GameTracker.pen` | Frame desain mobile (referensi stepper) |

---

## 13. Changelog

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | 2026-11-10 | Dokumen awal: pipeline 3 lapis, 18 input + 2 aksi, dependency map, collision table 19 baris |
| 1.1 | 2026-11-10 | Keputusan R1/R5/R6 dicatat; status R2/R16 jadi PENDING dengan usul; snapshot default diperbarui (as-of 2026-11-10) |
| 1.2 | 2026-11-10 | Pemangkasan design: hapus hint tanggal, `MVP`, `DD/MM/YYYY`, `1–6`, `REQUIRED`; ~~hapus field Current Pot (R20)~~ (dibatalkan); fix `defaultDate` UTC→local |
| 1.3 | 2026-11-10 | R23: **Current Pot dikembalikan** (`#fCurPot`, default 0, di kiri Target Pot); `requiredCopies = max(0, pot − curPot)` |
