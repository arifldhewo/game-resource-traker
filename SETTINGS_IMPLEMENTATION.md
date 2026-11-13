# Settings Page — Implementation Plan

**Status:** IMPLEMENTED (core). Halaman Settings, store, shared catalog, dan integrasi optimizer sudah live.
**Target:** Halaman `/settings.html` untuk menyalakan/mematikan item shop yang boleh ikut kontestasi basket optimizer di setiap tier cap.
**Storage:** `localStorage` (client-only, tanpa backend).

---

## 1. Tujuan

1. User bisa memilih paket/item mana yang **eligible** dihitung dalam optimizer.
2. Item yang di-toggle ON masuk kontestasi “best value” di cap tier yang sudah ada (`F2P → LEVIATHAN`), bukan dipaksa dipakai.
3. Default settings harus **mereproduksi output sekarang 100%** (tidak ada perubahan angka sebelum user mengubah toggle).
4. Setting tersimpan di `localStorage`, terbaca oleh `forecast.html`, dan tahan reload.
5. Halaman settings konsisten dengan visual forecast (font, warna, 125% desktop zoom, mobile responsive).

**Non-goals untuk fase ini:** backend/akun, sinkronisasi antar device, share settings, event pack live, first-time bonus OP (bisa jadi fase berikutnya).

---

## 2. Hasil riset kode saat ini

### 2.1 Halaman yang ada
| File | Isi |
|---|---|
| `src/index.html` | Landing page |
| `src/forecast.html` | Aplikasi utama (single-file HTML + JS inline + CSS inline) |
| `src/roadmap.html` | Roadmap |
| `src/forecast-i18n.js` | Dictionary EN + ID, dipakai forecast |

`docs/` adalah mirror persis untuk GitHub Pages. Setiap file baru wajib dicopy ke `docs/`.

Belum ada `settings.html`. Key i18n `nav.settings` dan `nav.settingsToast` sudah ada tetapi belum dipakai. Prototype lama (`proto/forecast-v3.html`) hanya punya link SETTINGS yang memunculkan toast.

### 2.2 Storage yang sudah dipakai
| Key | Isi | Ditulis oleh |
|---|---|---|
| `fv3.state` | Semua input forecast | `saveState()` tiap render (debounce 300ms) |
| `fv3.uiLang` | Bahasa UI | `applyUILang()` |
| `fv3.explainLang` | Bahasa tooltip | `applyExplainLang()` |

Settings harus memakai key baru, misal **`fv3.settings`**, supaya tidak menimpa `fv3.state`.

### 2.3 Katalog item saat ini
Lokasi: `src/forecast.html` → `PRODUCT_CATALOG` (sekitar baris 888).

| ID | Nama | Harga | Isi | Pull @100% OP | Pull/$ | Dipakai optimizer sekarang? |
|---|---|---:|---|---:|---:|---|
| `op1` | Originite Prime 1 | $0.99 | 1 OP | 0.30 | 0.303 | ya (filler) |
| `op6` | Originite Prime 6 | $4.99 | 6 OP | 1.80 | 0.361 | ya (filler) |
| `op20` | Originite Prime 20 | $14.99 | 20 OP | 6.00 | 0.400 | ya (filler utama) |
| `op40` | Originite Prime 40 | $29.99 | 40 OP | 12.00 | 0.400 | **tidak** |
| `op66` | Originite Prime 66 | $49.99 | 66 OP | 19.80 | 0.396 | **tidak** |
| `op130` | Originite Prime 130 | $99.99 | 130 OP | 39.00 | 0.390 | hanya panel manual Leviathan |
| `monthly_card` | Monthly Card | $4.99 | 6.000 ORU + 6 OP | 11.80 | **2.365** | ya (toggle) |
| `hh_pack` | Monthly Headhunting Pack | $25.99 | 42 OP + 1 ten-roll | 22.60 | 0.870 | ya (toggle) |
| `starter_hh` | Starter Headhunting Pack | $19.99 | 2 ten-roll | 20.00 | 1.001 | **tidak** |
| `starter_special` | Starter Special Headhunting Pack | $29.99 | 1 ten-roll | 10.00 | 0.333 | **tidak** |

Catatan penting:
- Field `pulls`, `firstTimeOp`, `firstTimePulls` di catalog **tidak dipakai engine**. Pull selalu dihitung `productPulls()` dari `op`, `orundum`, `tenPermits`.
- `op40`, `op66`, `op130`, `starter_hh`, `starter_special` ada di data tapi tidak pernah jadi kandidat optimizer.
- `MASTER_BLUEPRINT`/`FORECAST_V3_IMPLEMENTATION` sudah merencanakan kolom `is_active`, `recurring`, `cycle_days`, dan open question “starter/event pack: tetap inactive atau dihapus?”. Halaman settings ini menjawabnya: **user-controlled eligibility**.

### 2.3.1 Shop Packs yang terlihat di screenshot (belum semua ada di catalog)

Screenshot menunjukkan tab **Packs** dengan item berikut. Semua isi pack sudah dikonfirmasi. Catalog sekarang belum lengkap dan ada mismatch entri lama.

| ID usulan | Nama | Harga | Limit / availability | Isi pull | Pull @100% | Pull/$ | Status |
|---|---|---:|---|---|---:|---:|---|
| `monthly_hh` | Monthly Headhunting Pack | $25.99 | 17d, monthly | 42 OP + 1 ten-roll | 22.6 | 0.870 | sudah ada (`hh_pack`) |
| `starter_pack` | Starter Pack | $0.99 | **Once only** | HH permit ×1 | 1.0 | 1.010 | verified |
| `starter_monthly` | Starter Monthly Pack | $6.99 | Prime Access | HH permit ×3 + Monthly Card ×1 | 14.8 | 2.117 | verified |
| `starter_sync` | Starter Sync. Pack | $2.99 | Once | HH permit ×4 | 4.0 | 1.338 | verified |
| `starter_hh` | Starter Headhunting Pack | $19.99 | 17d, once | ten-roll ×2 | 20.0 | 1.001 | verified |

**Excluded — non-pull, tidak masuk Settings:**
- `starter_special_training` — Starter Special Training Pack $25.99: E2 materials untuk 1 operator 4★/5★/6★, 0 pull.
- `monthly_chip_choice` — Monthly Chip Choice Pack $1.99: chips, 0 pull.
- `monthly_funding` — Monthly Funding Pack $2.99: LMD, 0 pull.
- `monthly_battle` — Monthly Battle Pack ~$4.x: EXP, 0 pull.

**Isi terverifikasi (pull-relevant, dari user):**
- Starter Pack: **HH permit ×1**.
- Starter Monthly Pack: **HH permit ×3 + Monthly Card ×1**. Monthly Card dihitung seperti card biasa: 200 ORU/day × 30 + 6 OP = **11.8 pull** @100% OP, jadi total 3 + 11.8 = **14.8 pull**.
- Starter Sync Pack: **HH permit ×4**.
- Starter Headhunting Pack: **10-roll permit ×2** (20 pull).

Implikasi ranking: **Starter Monthly Pack (2.117 pull/$)** jadi item terbaik kedua setelah Monthly Card (2.365), di atas Starter Sync (1.338), Starter Pack (1.010), Starter HH (1.001), dan HH Pack (0.870). Kalau di-enable, pack ini akan mendominasi basket tier GOLDFISH ke atas.

Catatan mismatch:
- Catalog sekarang punya `starter_special` **$29.99** dengan 1 ten-roll. Itu **bukan** `Starter Special Training Pack` ($25.99, E2 mats, 0 pull). Karena non-pull dan tidak masuk Settings, entri lama ini sebaiknya di-retire saat implementasi.
- Pack dengan label **“Once only”** tidak bisa dimodelkan sebagai unlimited/recurring. Butuh field `purchaseLimit` + `limitScope`.

### 2.3.2 Klasifikasi item
- **Pull-relevant**: mengandung OP, Orundum, HH permit, atau ten-roll permit. **Hanya kategori ini yang masuk Settings dan kontestasi optimizer.**
- **Non-pull**: chips, LMD, EXP, material E2. **Tidak ditampilkan dan tidak di-toggle di Settings.**
- **One-time**: hanya bisa dibeli sekali total (`starter_pack`, `starter_hh`, dll).
- **Recurring**: reset tiap 30 hari / per siklus (`monthly_card`, `hh_pack`, OP packs).

### 2.4 Cara optimizer bekerja sekarang
Lokasi: `optimizeBasket()` (`forecast.html` sekitar 1186–1235).

1. Coba 4 kombinasi Monthly Card × HH Pack.
2. Sisa budget diisi greedy **OP20 → OP6 → OP1**.
3. Pilih total pull terbesar; jika seri, spend terkecil.
4. `op40/66/130/starter` tidak masuk kandidat.
5. `addPackOverrides()` hanya menambahkan pack manual Leviathan.
6. `computeBasketWindow()` mengalikan semua item non-card/HH dengan `months = ceil(days/30)`.

Implikasi: item yang di-enable lewat settings **tidak cukup** hanya ditambahkan ke array kandidat; semantics one-time vs recurring harus dibedakan (lihat §5).

---

## 3. Ruang lingkup halaman Settings

### 3.1 File baru
| File | Fungsi |
|---|---|
| `src/settings.html` | Halaman UI settings |
| `src/settings-store.js` | Shared store: defaults, load/save/validate, subscribe |
| `docs/settings.html` | Mirror |
| `docs/settings-store.js` | Mirror |

`src/forecast.html` akan menambahkan `<script src="settings-store.js"></script>` sebelum script utama.
`src/forecast-i18n.js` ditambah key `settings.*` (EN + ID).

### 3.2 Struktur UI (MVP)
1. **Header/topbar** sama seperti forecast: brand, nav FORECAST / ROADMAP / SETTINGS, language switch.
2. **Page head**: `SETTINGS` + subtitle singkat.
3. **Product eligibility** — hanya item pull-relevant, dalam card/table:
   - Isi: OP packs, Monthly Card, HH packs, dan starter packs yang memberi pull.
   - Tiap row: nama, kategori (`OP`, `MONTHLY`, `STARTER`), harga, isi, pull @100% OP, pull/$, limit (`once only`, `monthly`).
   - Toggle kanan dengan `role="switch"` + `aria-checked`.
   - Item default ON ditandai “CORE”.
   - Item default OFF ditandai “OPTIONAL”.
   - Non-pull pack tidak dirender sama sekali di halaman ini.
4. **Ringkasan efek** (opsional fase 2): preview basket terpilih per tier cap saat toggle berubah.
5. **Storage actions**:
   - `RESET TO DEFAULTS`
   - indikator “Saved locally” + toast saat berubah.
   - (Opsional) export/import JSON di fase lanjut.

### 3.3 Perilaku
- Setiap toggle langsung menulis `localStorage` (tidak perlu tombol Save).
- Toggle OFF item core tetap diizinkan, tetapi halaman menampilkan warning kecil jika semua filler OP dimatikan.
- Settings hanya mengatur eligibility; tidak mengubah input forecast (`fv3.state`) atau target.
- `storage` event: tab forecast yang terbuka ikut re-render saat settings berubah di tab lain (nice-to-have, mudah karena store subscribe).
- `pageshow` listener di forecast untuk kasus bfcache saat user kembali dari settings.

---

## 4. Data contract & storage

### 4.1 Key
```
fv3.settings
```

### 4.2 Shape
```json
{
  "version": 1,
  "products": {
    "op1": true,
    "op6": true,
    "op20": true,
    "op40": false,
    "op66": false,
    "op130": false,
    "monthly_card": true,
    "hh_pack": true,
    "starter_hh": false,
    "starter_pack": false,
    "starter_monthly": false,
    "starter_sync": false
  }
}
```

Catatan: hanya item pull-relevant yang masuk shape ini. Non-pull pack tidak disimpan dan tidak dirender di Settings.

### 4.3 Defaults (wajib sama dengan perilaku sekarang)
```js
const DEFAULT_SETTINGS = {
  version: 1,
  products: {
    op1: true,
    op6: true,
    op20: true,
    op40: false,
    op66: false,
    op130: false,
    monthly_card: true,
    hh_pack: true,
    starter_hh: false,
    starter_pack: false,
    starter_monthly: false,
    starter_sync: false
  }
};
```

**Aturan wajib:** semua produk dengan `category:"starter"` **default `false`**. Jika ada starter pack baru di masa depan, nilainya juga harus `false` di defaults dan tidak boleh ikut aktif saat migrasi/merge settings lama. User hanya bisa menyalakannya secara eksplisit lewat toggle.

### 4.4 Store API (`settings-store.js`)
```js
window.PRTS_SETTINGS = {
  KEY: "fv3.settings",
  DEFAULTS: DEFAULT_SETTINGS,
  load(),                  // merge dengan defaults, buang key asing, fallback saat JSON rusak
  save(settings),          // tulis + dispatch event internal
  isEnabled(id),           // convenience
  setProduct(id, enabled),
  reset(),
  subscribe(fn),           // dipanggil saat settings berubah (termasuk lintas tab)
  onChange                 // internal CustomEvent name
};
```

Validasi:
- `JSON.parse` gagal → pakai defaults, jangan hapus data lama diam-diam (bisa overwrite saat save berikutnya; tampilkan toast error).
- `version` berbeda → migrasi sederhana (unknown version → defaults + simpan).
- Hanya ID yang ada di catalog yang dipertahankan.
- Key produk `category:"starter"` yang tidak ada di saved settings **selalu diisi `false`**, bukan `true`.

---

## 5. Integrasi ke optimizer

### 5.1 Tambahan metadata catalog
Setiap produk perlu:
```js
{
  id, name, price, op, orundum, hhPermits, tenPermits,
  category: "op" | "monthly" | "starter",
  recurring: true | false,        // card/hh/op = true, starter = false
  purchaseLimit: null | 1,         // starter = 1 total; card/hh = 1 per 30d; op = null
  limitScope: "window" | "month", // window = sekali total; month = per 30d
  available: true | false,         // untuk pack time-limited (17 days)
  defaultEnabled: true | false
}
```
Contoh entri starter yang sudah verified:
```js
{ id:"starter_pack", name:"Starter Pack", price:0.99,
  hhPermits:1, category:"starter", recurring:false,
  purchaseLimit:1, limitScope:"window", defaultEnabled:false },

{ id:"starter_monthly", name:"Starter Monthly Pack", price:6.99,
  hhPermits:3, orundum:6000, op:6, // Monthly Card 30 hari di-encode sebagai ORU + OP
  category:"starter", recurring:false,
  purchaseLimit:1, limitScope:"window", defaultEnabled:false },

{ id:"starter_sync", name:"Starter Sync Pack", price:2.99,
  hhPermits:4, category:"starter", recurring:false,
  purchaseLimit:1, limitScope:"window", defaultEnabled:false },

{ id:"starter_hh", name:"Starter Headhunting Pack", price:19.99,
  tenPermits:2, category:"starter", recurring:false,
  purchaseLimit:1, limitScope:"window", defaultEnabled:false }
```

`pulls` dan `firstTime*` tetap disimpan untuk display/roadmap, bukan untuk kalkulasi.

### 5.2 Semantics one-time vs recurring
| Tipe | Contoh | Di basket bulanan | Di window proyeksi |
|---|---|---|---|
| Recurring unlimited | OP packs | boleh berapa pun yang muat | `qty × months` |
| Recurring limited | Monthly Card, HH Pack | maksimal 1 | `1 × months` |
| One-time | Starter Pack, Starter HH, Starter Sync | maksimal 1 **total** | `× 1`, bukan `× months` |

Non-pull (chips/LMD/EXP/E2 mats) tidak dimodelkan di Settings maupun basket.

**Starter Monthly Pack** = one-time bundle berisi 3 HH permit + 1 Monthly Card 30 hari. Rekomendasi: tetap `recurring:false` (sekali beli), nilai card dihitung sekali (11.8 pull @100%). Perlu keputusan apakah card di dalam bundle boleh stack dengan pembelian Monthly Card terpisah pada basket yang sama.

Ini perubahan penting di `computeBasketWindow()`: item `recurring:false` tidak boleh dikalikan `months`.

### 5.3 Algoritma kontestasi yang diusulkan
Kandidat diambil dari `settings.products[id] === true`.

Untuk setiap tier cap:
1. Pisahkan kandidat menjadi `oneTime` (starter) dan `recurring` (card/hh/OP).
2. Enumerasi semua subset `oneTime` yang muat budget (jumlah item kecil, maksimal 2^5 = 32).
3. Untuk tiap subset, enumerasi pilihan card ON/OFF dan HH ON/OFF.
4. Sisa budget diisi OP packs yang eligible:
   - Rekomendasi: **coin-change DP per cap** (maximize pull, tie min spend) agar sisa receh tidak terbuang.
   - Alternatif MVP: greedy sort by `productPulls()/price` menurun.
5. Pilih kandidat dengan **total pull sepanjang window** terbesar (`recurringPulls × months + oneTimePulls`); tie-break window spend terkecil. Ini penting karena starter hanya dihitung sekali, jadi skor per bulan pertama bisa menyesatkan.
6. Simpan hasil sebagai `basket` beserta `recurringPulls`, `oneTimePulls`, `recurringSpend`, `oneTimeSpend`.

Catatan: dengan default settings, hasil algoritma ini harus identik dengan output sekarang. Ini wajib dijadikan regression check.

### 5.4 Dampak ke tampilan forecast
- Kartu tier:
  - `pulls/mo` = recurring pulls per bulan (seperti sekarang).
  - Total = recurring × months + one-time (sekali).
  - `$X/mo` = recurring spend; one-time spend ditampilkan terpisah di breakdown.
- Breakdown menambah line:
  - `STARTER PACK · one-time · $19.99` dengan meta “not repeated”.
- `monthlySpend` yang dipakai badge/harga tier hanya recurring spend; jangan mencampur one-time.
- Jika user mematikan Monthly Card/HH, basket bisa turun drastis; tidak perlu special-case, cukup warning di settings.

### 5.5 `opPct`
Semua perhitungan memakai `productPulls(prod, state.opPct)` yang sudah ada. Ranking otomatis menyesuaikan; tidak perlu logika tambahan.

---

## 6. Navigasi & i18n

### 6.1 Nav
Tambahkan link `SETTINGS` ke:
- `src/forecast.html` (topbar)
- `src/index.html`
- `src/roadmap.html`
- `src/settings.html` (aria-current)

Pastikan tetap muat di mobile 390px dan tidak overflow pada zoom desktop 125%.

### 6.2 i18n
Tambah ke `src/forecast-i18n.js` (EN + ID):
```
settings.title, settings.subtitle,
settings.section.products, settings.section.storage,
settings.core, settings.optional,
settings.toggle.on, settings.toggle.off,
settings.pullsAt100, settings.perDollar,
settings.reset, settings.saved, settings.warning.noFiller,
settings.back
```
Settings page memakai `applyI18n` yang sudah ada, plus language switch yang sama.
Nama produk tidak perlu diterjemahkan.

---

## 7. File & perubahan

### Baru
- `src/settings.html`
- `src/settings-store.js`
- `docs/settings.html`
- `docs/settings-store.js`

### Diubah
- `src/forecast.html`
  - load `settings-store.js`
  - metadata catalog
  - `optimizeBasket()` membaca eligibility
  - `computeBasketWindow()` membedakan recurring vs one-time
  - breakdown line one-time
  - listener `storage`/`pageshow`
  - nav link SETTINGS
- `src/forecast-i18n.js` (settings keys)
- `src/index.html` (nav link)
- `src/roadmap.html` (nav link)
- `docs/*` mirror untuk semua file di atas.

### Tidak disentuh
- `proto/*`
- logic pity/economy selain basket/window

---

## 8. Rencana implementasi bertahap

### Fase 1 — Store + halaman Settings
1. Buat `settings-store.js` dengan defaults, load/save/validate, subscribe.
2. Buat `settings.html`: topbar, daftar produk, toggle, reset, toast.
3. i18n EN/ID.
4. Nav link di settings + minimal di forecast.
5. QA: toggle tersimpan, reload persist, JSON rusak fallback, mobile responsive.

**Output:** settings bisa dibuka dan disimpan, forecast belum berubah.

### Fase 2 — Eligibility di optimizer
1. Tambahkan metadata `recurring`, `purchaseLimit`, `defaultEnabled` di catalog.
2. Refactor `optimizeBasket()`:
   - filter eligibility,
   - enumerasi subset one-time,
   - OP filler (DP atau greedy value-sort).
3. Regression: default settings menghasilkan angka **identik** dengan sekarang.
4. Test toggle `starter_hh` ON → basket GOLDFISH/DOLPHIN berubah sesuai ekspektasi.

### Fase 3 — One-time window accounting + UI
1. Pisahkan recurring vs one-time di `computeBasketWindow()`.
2. Line breakdown `STARTER PACK · one-time`.
3. `pulls/mo` dan total konsisten.
4. QA semua tier + mode PULLS/POTENTIAL.

### Fase 4 — Polish
1. `storage` sync antar tab + `pageshow`.
2. Preview basket per tier di settings (opsional).
3. Warning jika semua filler OP dimatikan.
4. Sync `docs/`.

---

## 9. Test plan

| # | Test | Expected |
|---|---|---|
| 1 | Default settings, data default | F2P total 190, benchmark 212, basket per tier sama dengan sekarang |
| 2 | `starter_hh` ON | Muncul di subset kandidat; basket tier yang muat berubah; total naik |
| 3 | `op40/op66/op130` ON | Masuk filler contest; hasil mengikuti value |
| 4 | Semua OFF | Basket kosong, tidak crash |
| 5 | Reload | Toggle persist, forecast pakai settings tersimpan |
| 6 | JSON `fv3.settings` rusak | Fallback defaults, forecast tetap jalan |
| 7 | Tab A settings, tab B forecast | Tab B re-render (jika storage sync diimplementasikan) |
| 8 | One-time starter | Hanya dihitung sekali di window, bukan × months |
| 9 | Mobile 390px | Tidak ada horizontal overflow |
| 10 | Desktop 1440px zoom 125% | Layout settings tetap rapi |
| 11 | EN/ID | Semua label settings berubah bahasa |
| 12 | `docs/` | Hash file sama dengan `src/` |

Regression wajib: screenshot/angka default sebelum vs sesudah refactor harus sama.

---

## 10. Keputusan yang perlu di-approve

1. **Scope toggle:** semua produk (default mengikuti kondisi sekarang) — rekomendasi — atau hanya starter/op40/66/130?
2. **Starter one-time:** dihitung sekali per window — rekomendasi — atau diamortisasi per bulan?
3. **Filler OP:** exact coin-change DP — rekomendasi — atau greedy pulls/$ untuk MVP?
4. **Monthly Card / HH Pack:** boleh dimatikan user, atau dikunci ON?
5. **Preview basket per tier di settings:** masuk MVP atau fase 4?
6. **First-time OP bonus:** ditambahkan sebagai toggle terpisah sekarang, atau nanti?
7. **Nav:** link teks `SETTINGS` di nav — rekomendasi — atau ikon gear di top-right?
8. **Card di dalam Starter Monthly Pack:** boleh stack dengan pembelian Monthly Card terpisah, atau dianggap sudah menggantikan 1 card untuk siklus itu?
9. **Non-pull packs** (chips/LMD/EXP/E2 training): tampil sebagai info-only di Settings, atau disembunyikan total?
10. **Entri lama `starter_special` $29.99:** retire atau rename? Entri ini tidak sama dengan `Starter Special Training Pack` $25.99 yang non-pull.
11. **Pack time-limited (17 days):** toggle manual saja, atau ada input tanggal availability per pack?

---

## 11. Parallelisasi pekerjaan

Bisa dijalankan paralel, tetapi ada risiko karena repo ini statis dan beberapa file dipakai bersama.

**Rekomendasi pembagian:**
- **Sesi A (Settings page):** `src/settings.html`, `src/settings-store.js`, `docs/settings.*`, key i18n `settings.*` (koordinasikan file i18n).
- **Sesi B (Optimizer):** `src/forecast.html` bagian catalog + `optimizeBasket()` + `computeBasketWindow()`.
- **Sesi C / terakhir:** nav link di `index.html`, `roadmap.html`, `forecast.html`, dan sync `docs/`.

**File konflik yang harus dipegang satu sesi saja:**
- `src/forecast-i18n.js`
- `src/forecast.html` (nav + optimizer + script load)
- `docs/` mirror
- commit/push

**Cara aman:**
1. Selesaikan kontrak store (§4) dulu — dokumen ini sudah cukup sebagai acuan.
2. Buka sesi kedua memakai **git worktree terpisah** (isolated working directory), lalu merge setelah selesai. Jangan dua sesi commit/push ke `master` bersamaan.
3. Atau jalankan berurutan: Fase 1 di sesi A, Fase 2 di sesi B setelah store selesai.

Kalau mau benar-benar paralel tanpa konflik, bagi per-file: Sesi A hanya membuat 4 file baru; Sesi B hanya mengedit `forecast.html`; i18n dan nav dikerjakan setelah keduanya selesai.

---

## 12. Implementation notes (current build)

- File baru: `src/product-catalog.js`, `src/settings-store.js`, `src/settings.js`, `src/settings.html` (+ mirror `docs/`).
- Forecast membaca katalog dari `window.PRTS_CATALOG`; sumber data tunggal dengan Settings.
- Store key `fv3.settings`. Defaults diturunkan dari catalog; **semua starter dipaksa `false`**.
- Optimizer:
  - eligibility dari Settings;
  - Card/HH sebagai toggle;
  - subset starter one-time yang muat cap;
  - filler OP diurutkan `pulls/$` menurun (greedy, belum DP).
- Skor kandidat memakai **window pulls** (`recurringPulls × months + oneTimePulls`), tie-break window spend. Karena itu starter bisa kalah di cap pendek meskipun `pulls/$`-nya bagus.
- Starter dihitung **sekali** di window; breakdown menampilkan line `STARTER PACKS · ONE-TIME`.
- `monthlySpend` = recurring spend; total pull tetap memasukkan one-time.
- Non-pull pack tidak ada di catalog dan tidak pernah muncul di Settings.
- Monthly Card di dalam `Starter Monthly Pack` saat ini boleh stack dengan pembelian Monthly Card terpisah (open decision).
- Belum diimplementasikan: preview basket per tier, first-time OP bonus, import/export settings, input availability per pack.
- Regression default: F2P 190, benchmark 212, GOLDFISH `HH PACK×1 · OP1×4`, WHALE `CARD×1 · HH PACK×1 · OP20×31 · OP1×4`.
