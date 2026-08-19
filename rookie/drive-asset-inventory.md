# Rookie — Google Drive Asset Inventory

**Crawl date:** 2026-08-19
**Connector:** Google Drive
**Requested scope:** Rookie brand kit and creative assets — keyword sweep (`brand`, `Rookie`, `logo`, `guidelines`) plus a listing of Shared Drive `0AHw1z2SYf25MUk9PVA`.

---

## Headline finding

**No Rookie brand kit or creative asset library exists in the Drive reachable through this connector.**

The crawl completed successfully and returned results — but none of them are Rookie brand or creative assets. Every brand kit, logo set, and guidelines document found in this Drive belongs to a *different* brand (Slate, ICONIC, Vital Peptides Labs, Tim Rauch DDS). All Rookie-named material is written marketing-performance reporting, not design assets.

This inventory therefore records what the crawl **actually** found, including the negative result. It does not list any Rookie logo, palette, type spec, or creative file, because none were located. Nothing below is inferred or reconstructed.

---

## 1. Shared Drive `0AHw1z2SYf25MUk9PVA` — NOT ACCESSIBLE

This drive could not be listed. Two independent checks:

| Check | Result |
|---|---|
| `get_file_metadata(fileId: 0AHw1z2SYf25MUk9PVA)` | `Requested entity was not found.` |
| `search_files(query: parentId = '0AHw1z2SYf25MUk9PVA')` | Empty result set |

The ID is well-formed and matches the Google Shared Drive ID pattern — other shared drives resolved normally in the same session (`0ACTYWjGfTCG_Uk9PVA`, `0AOiFn2_jrLMHUk9PVA`), so the connector *can* read shared drives. This specific drive is either nonexistent, deleted, or not shared with the authenticated account.

**No file listing could be produced for this drive.** If the Rookie brand kit lives here, access must be granted before it can be inventoried.

---

## 2. All Rookie-matching files (complete)

Searches `title contains 'Rookie'` and `fullText contains 'Rookie'` were paginated to exhaustion. The complete Rookie corpus is **7 files** — 5 substantive, 2 incidental keyword matches.

All live at the root of Shared Drive `0ACTYWjGfTCG_Uk9PVA` (Housework Group), owner `drew@houseworkgroup.com`. None sit in a Rookie-specific folder; **no folder anywhere in the Drive matches "Rookie"** (`fullText contains 'Rookie' and mimeType = folder` → empty).

### Substantive Rookie documents

| Name | File ID | Type | Modified |
|---|---|---|---|
| Rookie Wellness - Weekly Performance Report - June 30 2026 | `1gfxRrNPhv0wEP7c_1HrLXmH59GB2uJRS8rDdVNrufSM` | Google Doc | 2026-06-30 |
| Rookie Wellness - Weekly Performance Report - June 30 2026 (v2) | `1cPh322XYCSCu3dbpGjrPctxSE7r53w43AGEnKdfLSxA` | Google Doc | 2026-06-30 |
| Rookie Wellness - Creative Performance (June 30 call) | `1zZhwiD-lLigM-gJ7Y7DGN_lFJlP-fK6sJPeqiEX8g28` | Google Doc | 2026-06-30 |
| Rookie Wellness - Internal Note for Crew (June 30 call) | `1r_rYEIF-v0PYri7ElFN2dF49wd1_SOGvwcUG6Fcx9V0` | Google Doc | 2026-06-30 |
| Rookie Wellness - MER Update (Internal) - June 30 | `1TVat08SYALVjO432Fi2NHbm0PAB5GHQyOKCENPUqHn8` | Google Doc | 2026-07-01 |

**Folder path for all five:** Shared Drive `0ACTYWjGfTCG_Uk9PVA` → (drive root)

Note: "Rookie Wellness - Creative Performance" is an **ad-performance analysis** — it discusses how creative performed, it is not a creative asset or an asset index.

### Incidental matches (body-text only, not Rookie assets)

| Name | File ID | Type | Note |
|---|---|---|---|
| invoice_CP2026003.pdf | `11Q0Mxk_7da_t-D5uTFj322jLjFa4oW8_` | PDF | Invoice; matched on a body mention |
| file (1).csv | `1KBVDp0oW9j05XwUCiWIJi85wwigagfsT` | CSV | Data export; matched on a body mention |

A targeted search for Rookie-matching **media** (`fullText contains 'Rookie'` AND mimeType image/video/PDF) returned exactly one file: the invoice above. There are **no Rookie images, videos, or design files** in this Drive.

---

## 3. Brand / creative assets that DO exist — all non-Rookie

Recorded so the negative finding is verifiable, and in case one of these was the intended target.

### 3a. "BRAND GUIDE" folder — this is **Slate's** brand kit, not Rookie's

Folder ID `1bHiXLvDZQYcRNAg1IKYNrENoGWypW6De`. Listed completely (12 items, no further pages). Every named artifact inside is Slate-branded.

| Name | File ID | Type |
|---|---|---|
| 1_SlateBrand_SHAREABLE | `1eXWx1GhdNP25_k6wDSiAu48Cx-LQ4x9x` | Folder |
| 2025 BRAND REFRESH | `1cUZ67fHzNl7SCSMY2QHu8qiKdkWDaAY-` | Folder |
| Logo | `1UKM3S6I8JqHIYg16DKIec_53qsqQerBm` | Folder |
| Colors | `1M3qpkRk4wbDu_cUlSY-S0EPJzXKEG8q6` | Folder |
| Fonts | `15toHfTX20RrdK-PZBNDzsEzaAyS-mdtN` | Folder |
| Icons | `1r7oho8S8zeNNTKSP2NmN4_zv0om9P3nw` | Folder |
| Patterns | `1WKGTP2DSitmRyYWT55Vc9oI4AznKh_c8` | Folder |
| 2026 Slate Brand Guidelines.pdf | `1uB0MbA1Colm-dMy53bBAEVJqQyi-dpxW` | PDF (10.9 MB) |
| 2026 Slate Brand Guidelines.indd | `1L3o4iwBiKW8HQT36GskwyNQfYSentzIi` | InDesign (55.5 MB) |
| 2025 Slate Brand Guidelines.pdf | `1bsjY2dKsiKDsaEOJnOCudJXbABsH80v0` | PDF (3.4 MB) |
| ADA Guidelines Web - Slate Jan 2026.pdf | `1xwgc9BK8H-d-iQpQNUD4deA__aIH3MfZ` | PDF (2.7 MB) |
| 2025 Moodboard.pdf | `1LlGmLpZBUn0yx6OmIdxmttbopctRiT_2` | PDF (4.8 MB) |

Sub-folder of `Logo`: **Updated Logo (400x400)** — `1WHXkWiPYPBJKitgYZxRVM0TooKT52d73`

### 3b. Other non-Rookie brand material

| Name | File ID | Type | Belongs to |
|---|---|---|---|
| ICONIC Brand Voice & Copy Guide (Dec 2025) | `1FOANLevOM7EadwKU5JXWlt6b6WiG_H1IcVvwlnXS_gU` | Slides | ICONIC (`clayton@drinkiconic.com`) |
| Slate Brand Guidelines March 2025 Folder | `1AAiHg7_hiXlmPEQA3P5qWQmNbkdZ_GTx` | Folder | Slate |
| Logo's | `1h2oU7smCmDWP1kKDVQqRgYY3fIjObTqn` | Folder | Tim Rauch DDS |
| Logos | `1UyYRiWY1Ux1UBzVo8U7T9iISehI2e8be` | Folder | Shared Drive `0AOiFn2_jrLMHUk9PVA` |
| Press Photos and Logo | `1T9PMmXy4Ee20qjfFTNg_ET5uPmOBP_u6` | Folder | — |
| Peptide Website Build / Branding / Ecommerce | `16cqCRWlOj_ZQwC1lv4WJnw4KPHAIc0FI_TcDyYAhrn0` | Doc | Vital Peptides |
| Bone Insurance Website Build / Branding SOW | `1RKWUSaU_9SuUk_FuFP6eQoijLjnbjn36-YOvsnQeL7s` | Doc | Bone Insurance |

---

## 4. Queries run

| Query | Outcome |
|---|---|
| `parentId = '0AHw1z2SYf25MUk9PVA'` | Empty — drive not accessible |
| `get_file_metadata('0AHw1z2SYf25MUk9PVA')` | `Requested entity was not found.` |
| `title contains 'Rookie'` | 5 files, paginated to exhaustion |
| `fullText contains 'Rookie'` | 7 files, paginated to exhaustion |
| `fullText contains 'Rookie' and mimeType = folder` | Empty — no Rookie folders exist |
| `fullText contains 'Rookie' and (image/ or video/ or pdf)` | 1 file (an invoice) |
| `fullText contains 'brand'` / `title contains 'brand'` | Slate, ICONIC, Vital Peptides — no Rookie |
| `fullText contains 'logo'` / `title contains 'logo'` | Slate, Tim Rauch DDS — no Rookie |
| `fullText contains 'guidelines'` | Slate, ICONIC — no Rookie |
| `parentId = '1bHiXLvDZQYcRNAg1IKYNrENoGWypW6De'` | 12 items, complete |
| `parentId = '0ACTYWjGfTCG_Uk9PVA'` | Drive root listed |

---

## 5. Caveats

- **The one drive specifically named in the request could not be read.** The Rookie brand kit may well be inside `0AHw1z2SYf25MUk9PVA`; this crawl can neither confirm nor deny its contents. Restoring access and re-running is the single highest-value next step.
- Scope is limited to what this Drive connector's authenticated account can see. Assets in another Workspace account, a personal Drive, or a design tool (Figma, Canva, Frame.io, a DAM) are out of reach here and would not appear.
- The broad `brand` / `logo` / `guidelines` keyword sweeps were reviewed on their first page plus targeted follow-ups; they were not paginated to exhaustion, since each additional page continued to surface only non-Rookie brands. The **Rookie-specific** searches — the ones this inventory's central claim rests on — *were* paginated to exhaustion.
- File sizes and timestamps are as reported by the Drive API at crawl time.
