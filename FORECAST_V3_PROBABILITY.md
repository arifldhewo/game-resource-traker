# Relasi P(TARGET) dan Confidence — Korelasi Lengkap

Dokumen ini menjabarkan bagaimana dua knob probabilitas di forecast v3 **berinteraksi dan berkaitan satu sama lain**, supaya konteksnya tidak terpecah-pecah.

---

## 1. Dua Angka yang Berbeda (tapi saling nyambung)

| Label di UI | Arti | Sifat | Sumber |
|---|---|---|---|
| **`P(TARGET \| 6★)`** | Kalau 6★ sudah keluar, peluangnya isinya target operator | Fakta banner (input user) | `state.prob` (default 35%) |
| **`CONFIDENCE`** | Seberapa yakin kamu ingin berada? | Keputusan / threshold | `state.confidence` (default 0.9) |
| **`P(TARGET)` di kartu tier** | Peluang tier ini mencapai required copies | Hasil hitungan DP | `dp.success[totalPulls]` |

Keduanya **tidak sama**, tapi confidence **memakai** P(TARGET) sebagai bahan pengukuran.

---

## 2. Alur Logika: Dari Input ke Keputusan

```
┌─────────────────────────────────────────────────────────────┐
│ LAPIS 1: INPUT                                              │
│   P(TARGET│6★) = 35%  ← user isi (bukan per pull!)         │
│   CONFIDENCE = 90%   ← user pilih (50/80/90/95)            │
│   requiredCopies = max(0, targetPot − currentPot)            │
│   totalPulls per tier (hasil lapis economy+basket)          │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│ LAPIS 2: DP (Dynamic Programming)                           │
│   per pull: P(6★) × P(TARGET│6★) → transisi state copies   │
│   hasil: dp.success[n] = P(TARGET dalam n pull)            │
│   hasil: dp.chanceTarget[n] = P(≥1 copy dalam n pull)      │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│ LAPIS 3: KEPUTUSAN (badge + required pulls)                 │
│   IF dp.success[totalPulls] >= CONFIDENCE → FEASIBLE        │
│   IF dp.success[totalPulls] > 0.5    → LIKELY               │
│   ELSE                                → DEFICIT             │
│                                                             │
│   requiredPulls = min n di mana dp.success[n] >= CONFIDENCE │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Korelasi Secara Angka (Snapshot Default)

Asumsi: banner **LIMITED**, POT 1, `P(TARGET│6★) = 35%`, window 90 hari.

| Confidence | PULLS @ confidence | P(TARGET) di pull itu | Badge di tier terendah yang lulus |
|---|---|---|---|
| **50%** | 70 | ~50% | F2P (190 pull, 87.2%) |
| **80%** | 153 | ~80% | MINNOW (230 pull, 91.9%) |
| **90%** | 212 | ~90% | MINNOW (230 pull, 91.9%) |
| **95%** | 272 | ~95% | GOLDFISH (261 pull, 94.4%) ← close |

**Insight utama:**
- Dari 90% → 95%: **cuma +5 poin confidence**, tapi butuh **+60 pull**.
- Dari 80% → 90%: **+10 poin confidence**, butuh **+59 pull**.
- Confidence semakin tinggi, penambahan pull-nya **semakin mahal** (kurva lembek ke kanan).

---

## 4. Bagaimana P(TARGET│6★) Mempengaruhi Confidence

`P(TARGET│6★)` bukan peluang per pull, tapi **kondisional** setelah 6★ muncul.

```
P(target per 1 pull) ≈ P(6★) × P(TARGET│6★)
                     ≈ 2% × 35%  ≈ 0,07%  (awal, tanpa pity)
```

Dengan pity (peluang 6★ naik setelah 49 pull tanpa 6★), kurva P(TARGET) vs pull menjadi **S-shaped** (sigmoid), bukan linier.

### Contoh: Ganti `P(TARGET│6★)` dari 35% → 50%

| Confidence | PULLS @ 35% | PULLS @ 50% | Δ pull |
|---|---|---|---|
| 90% | 212 | 142 | −70 |
| 95% | 272 | 183 | −89 |

**Insight:** Tingkatkan kualitas rate-up (35% → 50%) jauh lebih murah dari tingkatkan confidence (90% → 95%).

---

## 5. Bagaimana Required Copies (Target − Current) Mempengaruhi Confidence

`requiredCopies = max(0, targetPot − currentPot)`. Semakin banyak copy yang masih dibutuhkan, semakin kanan curva geser. Kalau current ≥ target (0 copy), semua tier `GUARANTEED` tanpa pull.

| requiredCopies | PULLS @ 90% conf (LIMITED, 35%) |
|---|---|
| 0 (sudah tercapai) | 0 — GUARANTEED |
| 1 | 212 |
| 2 | ~320 |
| 3 | ~410 |
| 4 | ~490 |
| 5 | ~560 |
| 6 | ~620 |

Setiap copy tambahan butuh pull tambahan, dan confidence tetap memegang jumlah pull tersebut di `dp.success[n] >= 0.9`. `currentPot` default 0 = belum dimiliki.

---

## 6. Status Badge: Di Mana Confidence Memutuskan

Berdasarkan `dp.success[totalPulls]` dibandingkan `state.confidence`:

| `P(TARGET)` vs Confidence | Status | Arti |
|---|---|---|
| `>= confidence` | `FEASIBLE` | Lulus standar yang kamu pilih |
| `> 0.5` dan `< confidence` | `LIKELY` | Lebih dari koin, tapi belum cukup yakin |
| `<= 0.5` | `DEFICIT` | Kurang dari koin, risiko zonk tinggi |

Contoh snapshot default (confidence = 90%):
- **F2P**: P(TARGET) = 87.2% < 90% → `LIKELY` (belum lulus)
- **MINNOW**: P(TARGET) = 91.9% >= 90% → `FEASIBLE` (lulus, tier termurah)
- **DOLPHIN+**: P(TARGET) = 100% → `GUARANTEED` (spark menjamin)

---

## 7. Ringkasan Korelasi

```
P(TARGET│6★) ↑   →   P(TARGET per pull) ↑   →   butuh pull lebih sedikit   →   confidence tercapai lebih cepat
CONFIDENCE ↑    →   ambang keberhasilan ↑   →   butuh pull lebih banyak    →   P(TARGET) di total pull harus lebih tinggi
requiredCopies (target − current) ↑   →   butuh pull lebih banyak    →   confidence tercapai lebih sulit
```

**Aturan emas untuk membaca hasil:**
1. Lihat dulu `P(TARGET│6★)` — ini kualitas banner yang kamu target.
2. Pilih `CONFIDENCE` — seberapa risiko-averse kamu.
3. Lihat `PULLS @ confidence` — itu target pull kamu harus kumpulkan.
4. Cek tier mana yang `FEASIBLE` di jumlah pull itu — itu rekomendasi spending tier terendah.

---

## 8. Catatan untuk Implementasi

- `confidence` adalah **threshold yang dipakai untuk mem-filter tier**, bukan untuk merubah hitungan DP itu sendiri.
- DP dihitung **sekali** per request, semua 6 tier hanya meng-index `dp.success[min(totalPulls, horizon)]`.
- `confidence` tidak mempengaruhi `chanceTarget` (P(≥1 copy)) — itu metrik terpisah untuk informasi tambahan.
- Jika `requiredCopies = 0` (POT 0 / sudah punya), semua tier otomatis `GUARANTEED` regardless confidence.