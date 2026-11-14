# Forecast v3 — Tooltip & Explanation Layer (Modal / Bottom Sheet)

**Status:** Sudah diimplementasi (P0, 13 tooltip) · 10 Nov 2026
**Referensi:** [`FORECAST_V3_LOGIC.md`](./FORECAST_V3_LOGIC.md) · [`FORECAST_V3_IMPLEMENTATION.md`](./FORECAST_V3_IMPLEMENTATION.md)
**Prinsip:** tooltip hanya untuk **yang ambigu**, bukan untuk semua field. Isi penjelasan **selalu** mengacu ke logic doc, supaya copy dan rumus tidak drift.

---

## 0. Interaction spec (final)

| Aspek | Desktop | Mobile |
|---|---|---|
| Breakpoint | `≥ 760px` | `< 760px` (ikut breakpoint mobile yang sudah dipakai design) |
| Bentuk | Modal centered + overlay | Bottom sheet (slide-up), grab handle |
| Lebar | modal `460px`, padding 17 | full-width, height mengikuti konten, rounded top 14px |
| Trigger | ikon **SVG info** di samping label/section | sama |
| Tutup | ✕, overlay click, `Esc` | ✕, overlay click, `Esc` |
| Scroll | body lock + modal scroll | body lock + sheet scroll |
| Focus | fokus ke modal, `Esc` menutup, fokus balik ke trigger | sama |
| Motion | fade + slide 200ms | slide-up (dari `.modal` mobile) |
| Reduced motion | nonaktifkan animasi | nonaktifkan animasi |

**Aturan main:**

1. Memakai komponen `.modal` yang **sudah ada**: di desktop dia modal centered; di ≤760px CSS yang sama otomatis mengubahnya jadi bottom sheet. Tidak ada dua wadah terpisah.
2. Ikon trigger: `<button class="info-trigger" data-info="..." aria-label="Detail ...">` dengan SVG info (bukan teks `ⓘ`).
3. Ikon hanya muncul di label/section P0.
4. Copy bahasa Indonesia, **tanpa rumus/formula** — hanya abstraksi + analogi.
5. Setiap penjelasan punya: **Analogi** → **Cara kerja (abstrak)** → **Contoh angka (hardcode + note)** → **Pengaruhnya ke**. Tanpa referensi dokumen internal — ini UI end-consumer.
6. Angka contoh **hardcode** dari snapshot, dengan catatan: *“Angka contoh dari snapshot — bukan hasil perhitunganmu.”*

---

## 1. Template isi penjelasan

```
┌─────────────────────────────────────────────┐
│ ⓘ  {JUDUL FIELD}                    ✕       │
├─────────────────────────────────────────────┤
│ ANALOGI                                     │
│ {1–2 kalimat analogi sehari-hari}           │
│                                             │
│ CARA KERJA                                  │
│ {penjelasan abstrak, tanpa rumus}           │
│                                             │
│ CONTOH ANGKA                                │
│ {angka contoh dari snapshot}                │
│ *angka contoh — bukan hasil perhitunganmu   │
│                                             │
│ PENGARUHNYA KE                              │
│ {output yang berubah: P(TARGET), badge, …}  │
└─────────────────────────────────────────────┘
```

---

## 2. P0 — Wajib (ambiguitas tinggi, menentukan keputusan user)

### P0-01 · `P(TARGET | 6★)`

| | |
|---|---|
| Trigger | ⓘ di label Step 01 |
| Analogi | Undian berlapis: 6★ = lolos babak final. Angka ini = peluang **menang babak final** kalau sudah lolos. |
| Cara kerja | `pT` dipakai tiap 6★: cabang target `p6 × pT`, cabang bukan target `p6 × (1 − pT)`. Split rate-up 50% / 2 = **25%**. Default 35% = asumsi satu operator di slot rate-up. `ABSENT` → dipaksa 0. |
| Contoh | 6★ rata-rata keluar ~pull 35; per pull target ≈ `2% × 35% = 0,7%`. |
| Pengaruhnya | `P(TARGET)`, `PULLS @ CONF`, badge, `minTier`. |
| Sumber | Logic doc §4, §5 TGT-08 |

### P0-02 · `CONFIDENCE TARGET`

| | |
|---|---|
| Trigger | ⓘ di label chips Step 01 |
| Analogi | Target nilai ujian: “mau yakin 90%” = harus belajar sampai bisa 9 dari 10 soal. |
| Cara kerja | `reqPulls = min n` dengan `success[n] ≥ confidence`. Badge `FEASIBLE` kalau `P(TARGET) ≥ confidence`. Confidence **tidak** mengubah kurva, hanya garis lulus. |
| Contoh | 50%→70 pull, 80%→153, 90%→**212**, 95%→272 (default LIMITED, POT 1, 35%). |
| Pengaruhnya | `BENCHMARK`, badge, `MIN VIABLE TIER`, `TIERS CLEARING`, advice. |
| Sumber | Logic doc §4, §5 TGT-09 |

### P0-03 · `TARGET MODE` (Pulls vs Potential)

| | |
|---|---|
| Trigger | ⓘ di label segmented Step 01 |
| Analogi | Menabung vs mengejar hadiah: “cukup nggak uangku?” vs “berapa peluang dapet hadiah?” |
| Cara kerja | PULLS → badge `total ≥ targetPulls`; `probTarget` dari archetype (info). POTENTIAL → badge `prob ≥ confidence`; `probTarget` dari input user. |
| Contoh | PULLS 300 = cek tier mana sampai 300 pull. POTENTIAL 90% = cek peluang 1 copy. |
| Pengaruhnya | Semua badge, benchmark, angka kedua di kartu. |
| Sumber | Logic doc §5 TGT-03 |

### P0-04 · `TARGET POTENTIAL`

| | |
|---|---|
| Trigger | ⓘ di label Step 01 |
| Analogi | “Aku mau Pot 3” = target akhir, bukan jumlah copy yang harus dibeli. |
| Cara kerja | `requiredCopies = max(0, pot − curPot)` (R23). DP berhenti sukses saat copy capai `required`. `GUARANTEED` kalau current ≥ target atau spark ≥ required. |
| Contoh | Current 0 → target 1 = 1 copy; current 1 → target 3 = 2 copy (bukan 3× pull). |
| Pengaruhnya | `P(TARGET)`, `PULLS @ CONF`, status GUARANTEED. |
| Sumber | Logic doc §5 TGT-05, §9 R23 |

### P0-04b · `CURRENT POTENTIAL`

| | |
|---|---|
| Trigger | ⓘ di label `CURRENT POTENTIAL` (kiri Target Potential) |
| Analogi | “Aku sudah punya 1 duplikat” = mulai dari Pot 1, bukan dari nol. |
| Cara kerja | Select 0–6, default `0` = belum dimiliki. Copy yang dibutuhkan = `max(0, target − current)`. |
| Contoh | Current 3, target 3 → 0 copy, semua tier GUARANTEED. |
| Pengaruhnya | `requiredCopies`, `P(TARGET)`, `PULLS @ CONF`, status GUARANTEED. |
| Sumber | Logic doc §5 TGT-06, §9 R23 |

### P0-05 · `TARGET AVAILABILITY`

| | |
|---|---|
| Trigger | ⓘ di label Step 01 |
| Analogi | Rak toko: FEATURED = rak depan, OFF_BANNER = gudang, ABSENT = tidak dijual. |
| Cara kerja | `ABSENT` → `probTarget = 0`, spark & guarantee dimatikan. `FEATURED`/`OFF_BANNER` pakai angka user; beda keduanya semantik, bukan matematis. |
| Contoh | ABSENT → semua tier DEFICIT 0%. |
| Pengaruhnya | `P(TARGET)`, spark, guarantee, badge. |
| Sumber | Logic doc §5 TGT-07 |

### P0-06 · `CURRENT PITY`

| | |
|---|---|
| Trigger | ⓘ di label Step 02 |
| Analogi | Meteran parkir: makin lama tidak dapat 6★, makin besar peluang berikutnya. |
| Cara kerja | `startPity = isolated ? 0 : min(98, pity)`. `sixStarProb` naik 2%/pull setelah 49 miss. Disabled untuk LIMITED & CROSSOVER (isolated pity). |
| Contoh | Pity 60 → peluang 6★ berikutnya `2% + 2%×(60−49) = 24%`. |
| Pengaruhnya | `P(TARGET)`, `CHANCE ANY 6★`, `reqPulls`. |
| Sumber | Logic doc §5 RES-07 |

### P0-07 · `YELLOW CERTS` + `SHOP TIER CLEARED`

| | |
|---|---|
| Trigger | ⓘ di label Step 02 (satu tooltip gabungan) |
| Analogi | Tukar poin: 10 cert = 1 pull, 18 = 2, 40 = 5, 70 = 10, 120 = 20. |
| Cara kerja | `calcYellowCertPulls`: belanja stok dari tier yang belum dibersihkan ke atas; bulan berikutnya ulangi dari Tier 1 dengan **sisa stok** (tidak ada income cert baru). |
| Contoh | 180 cert, Tier 2 cleared → 21 pull, sisa 14 cert. |
| Pengaruhnya | Total pull, badge. |
| Sumber | Logic doc §5 RES-05/06 |

### P0-08 · `OP CONVERSION %`

| | |
|---|---|
| Trigger | ⓘ di label range Step 02 |
| Analogi | Tukar mata uang: 100% = semua OP ditukar; 50% = setengah disimpan untuk skin/sanity. |
| Cara kerja | Mengalikan **semua** sumber OP: inventory OP, OP dari Monthly Card, HH Pack, dan OP packs. |
| Contoh | 100% → 45 OP = 13,5 pull; 50% → 6,75 pull. |
| Pengaruhnya | `pulls/mo`, total, badge. |
| Sumber | Logic doc §5 RES-08 |

### P0-09 · Badge status tier (`GUARANTEED / FEASIBLE / LIKELY / DEFICIT`)

| | |
|---|---|
| Trigger | ⓘ di header matrix / label badge |
| Analogi | Status pengiriman: pasti sampai / sesuai janji / kemungkinan / gagal. |
| Cara kerja | `GUARANTEED` = spark menjamin copy; `FEASIBLE` = `P ≥ confidence`; `LIKELY` = `P > 50%`; `DEFICIT` = sisanya. |
| Contoh | F2P 87,2% @90% → LIKELY; MINNOW 91,9% → FEASIBLE. |
| Pengaruhnya | Label kartu, `TIERS CLEARING`, `START`. |
| Sumber | Logic doc §7, §9 R7 |

### P0-10 · `BENCHMARK`

| | |
|---|---|
| Trigger | ⓘ di label head stat Outlook |
| Analogi | Garis finish: semua tier dibandingkan ke garis ini. |
| Cara kerja | PULLS → `targetPulls`; POTENTIAL → `reqPulls @ confidence` (fallback `ceil(maxTotal)`). `delta = total − benchmark`. |
| Contoh | Default 90% → benchmark 212 pull; F2P 190 = −22 (short). |
| Pengaruhnya | Delta di kartu, `MIN VIABLE TIER`, advice. |
| Sumber | Logic doc §7 |

### P0-11 · Pity grid (4 sel)

| | |
|---|---|
| Trigger | ⓘ di header section “Pity estimation” |
| Analogi | 4 pertanyaan beda tentang undian: pernah dapat? dapat target? cukup yakin? butuh berapa? |
| Cara kerja | `CHANCE ANY 6★` = P(≥1 6★) (`anySixCurve`). `CHANCE TARGET COPY` = P(≥1 copy). `P(REACH x%)` = P(target) tier aktif vs confidence. `PULLS @ CONF` = `reqPulls` global. |
| Contoh | Tier aktif F2P 190 pull: any 6★ 100%, target copy 87,2%, PULLS @ CONF 212. |
| Pengaruhnya | Semua output probabilitas. |
| Sumber | Logic doc §7 |

### P0-12 · `pulls/mo` vs `total` (bulanan vs window)

| | |
|---|---|
| Trigger | ⓘ di header kartu tier / breakdown |
| Analogi | Gaji bulanan vs tabungan total sampai target tercapai. |
| Cara kerja | `monthlyPulls` = income **recurring** ÷ siklus. `total` = semua `lines` (recurring + one-time: inventory, cert, archetype bonus). |
| Contoh | F2P: 29,6 pull/mo × 3 siklus ≈ 190 total (plus inventory/cert/bonus). |
| Pengaruhnya | Persepsi user terhadap kecepatan & harga. |
| Sumber | Logic doc §7 |

---

## 3. P1 — Bagus ada (ambigu sedang)

| # | Field/section | Analogi singkat | Cara kerja singkat | Sumber |
|---|---|---|---|---|
| P1-01 | `BANNER ARCHETYPE` | Jenis rak/promosi: LIMITED = spark 300, EVENT = jaminan 150, CROSSOVER = 100% rate-up spark 120, STANDARD/KERNEL = tanpa hard pity. | Metadata archetype mengatur `rateUp`, `isolated`, `spark`, `guaranteeAt`, `freePulls`. | §3, TGT-01 |
| P1-02 | `TARGET PULLS` | Ambang spark vs target manual. | Default ikut spark archetype; user bisa override. Mode PULLS murni bandingkan total. | TGT-04 |
| P1-03 | `LEVIATHAN OP PACKS` | Paket tambahan di atas keranjang $500; tanpa bonus first-time. | Hanya tier LEVIATHAN; pack dijumlahkan ke basket $500; SKU 130/66/40/20/6/1. | RES-09, R6 |
| P1-04 | `GREEN CERT SHOP` (line breakdown) | Iuran bulanan: 600 ORU + 4 permit, syarat punya green cert. | Dihitung per bulan kalender; asumsi Tier 1 dibersihkan (R16). | R16 |
| P1-05 | `ARCHETYPE BONUS` (line breakdown) | Pull gratis dari banner. | LIMITED: 10-pull + 14 daily = 24, ditambah ke total (clamp window <14 hari, R17). | R17 |
| P1-06 | Engine note / asumsi | “Semua reward rutin diasumsikan diklaim.” | Annihilation 1800/minggu, reset kalender, income deterministik; event/compensation tidak dihitung. | §8 |
| P1-07 | `MIN VIABLE TIER` / `START` | Tier termurah yang lulus. | `clearTiers[0]` = tier pertama (F2P→LEVIATHAN) yang meet confidence. | §7 |
| P1-08 | `TIERS CLEARING x/6` | Berapa dari 6 jalur yang lulus. | Hitung tier FEASIBLE/GUARANTEED (atau total ≥ target di mode PULLS). | §7 |
| P1-09 | `DAYS LEFT` / weekly reset | Hari sampai deadline & jumlah reset mingguan. | `days` = selisih kalender; `weeks` = jumlah Senin di rentang; cutoff Asia/Jakarta. | §3, TGT-02 |
| P1-10 | Matrix note “best-value basket” | Optimizer beli yang paling hemat per pull. | Urutan: Monthly Card → HH Pack → OP20 → OP6 → OP1; tanpa first-time/starter. | §8 |

---

## 4. P2 — Opsional (jelas, tapi boleh ada)

| # | Field | Alasan |
|---|---|---|
| P2-01 | `ORUNDUM` | Mungkin jelas; tooltip opsional: “1 pull = 600 ORU”. |
| P2-02 | `ORIGINITE PRIME` | Mungkin perlu: “1 OP = 180 ORU sebelum konversi %”. |
| P2-03 | `HH TICKET 1× / 10×` | Jelas; tooltip opsional. |
| P2-04 | Step eyebrow / nav | Penjelasan “STEP 0X OF 04” opsional. |
| P2-05 | Section “Resource accumulation” | Ringkas: “Semua sumber pull dari tier terpilih.” |
| P2-06 | PRTS advisory | “Nasihat lokal berbasis aturan; LLM opsional via BYOK.” |

---

## 5. Peta penempatan trigger

| Step | Label/section | Tooltip |
|---|---|---|
| 01 | BANNER ARCHETYPE | P1-01 |
| 01 | TARGET END DATE | P1-09 |
| 01 | TARGET MODE | P0-03 |
| 01 | TARGET PULLS | P1-02 |
| 01 | CURRENT POTENTIAL | P0-04b |
| 01 | TARGET POTENTIAL | P0-04 |
| 01 | TARGET AVAILABILITY | P0-05 |
| 01 | P(TARGET \| 6★) | P0-01 |
| 01 | CONFIDENCE TARGET | P0-02 |
| 02 | YELLOW CERTS + SHOP TIER | P0-07 |
| 02 | CURRENT PITY | P0-06 |
| 02 | OP CONVERSION | P0-08 |
| 02 | LEVIATHAN OP PACKS | P1-03 |
| 02 | Engine note | P1-06 |
| 03 | Badge / matrix header | P0-09 |
| 03 | Kartu tier (`$/mo`, `pulls/mo`) | P0-12 |
| 03 | Matrix note | P1-10 |
| 04 | BENCHMARK / MIN VIABLE / TIERS CLEARING | P0-10, P1-07, P1-08 |
| 04 | Section pity | P0-11 |
| 04 | Line green cert / archetype bonus | P1-04, P1-05 |

> **Status:** baris P0 sudah dipasang (13 tombol). P1/P2 belum.

---

## 6. Sumber kebenaran per tooltip

> **Internal only.** Tabel ini untuk pemeliharaan copy, **tidak ditampilkan** di UI.

Agar copy tidak drift, tiap tooltip punya anchor logic doc:

| Tooltip | Anchor |
|---|---|
| P0-01, P0-02, P0-03, P0-04, P0-04b, P0-05 | `FORECAST_V3_LOGIC.md` §4 |
| P0-06, P0-07, P0-08 | `§5 RES-*` |
| P0-09, P0-10, P0-11, P0-12 | `§7` |
| P0-03 | `§5 TGT-03` |
| P0-04, P0-04b | `§9 R23` |
| P1-03 | `§9 R6` |
| P1-04, P1-05 | `§9 R16, R17` |
| P1-06 | `§8` |

---

## 7. Implementasi (sudah dikerjakan · P0)

1. **Komponen:** ikon `.info-trigger` + modal `#infoModal`. Modal memakai kelas `.modal` yang sudah ada, jadi di ≤760px otomatis jadi bottom sheet (plus `.grab`).
2. **Data copy:** objek `INFO` di JS prototype (13 key). Nantinya dipindah ke `explanation.ts` / struktur data FE production.
3. **Responsif:** satu wadah, memakai media query existing `@media (max-width:760px)`.
4. **Aksesibilitas:** `role="dialog"`, `aria-modal`, `aria-labelledby`, `Esc`, overlay click, body lock — memakai ulang sistem modal existing.
5. **Body scroll lock:** `document.body.classList.add("locked")` (sistem modal existing).
6. **Reduced motion:** media query existing mematikan semua transisi.
7. **Angka contoh:** hardcode + note *“Angka contoh dari snapshot — bukan hasil perhitunganmu.”*
8. **Z-index:** modal existing `z-index:41`, overlay `40`; di atas flowbar.
9. **Trigger:** SVG info inline; 14 tombol (13 tooltip; `certs` terpasang di 2 label: YELLOW CERTS & SHOP TIER CLEARED).

---

## 8. Keputusan (10 Nov 2026)

1. **Ikon:** SVG info (bukan teks `ⓘ`).
2. **Breakpoint:** **760px** — mengikuti breakpoint mobile yang sudah dipakai design.
3. **Trigger section:** ikon di judul section (badge matrix, Resource accumulation, Pity estimation).
4. **Contoh angka:** hardcode + note “angka contoh”.
5. **Scope:** **P0 dulu** (13 tooltip); P1/P2 menunggu.
6. **Copy:** analogi + cara kerja **abstrak tanpa rumus** + contoh + dampak. **Tanpa baris “Sumber”** — UI end-consumer tidak perlu referensi dokumen internal.

---

## 9. Changelog

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | 2026-11-10 | Daftar usulan tooltip: 12 P0, 10 P1, 6 P2 + interaction spec |
| 1.1 | 2026-11-10 | Implementasi P0 (12 tooltip): SVG info, modal/bottom sheet 760px, copy abstrak + contoh hardcode |
