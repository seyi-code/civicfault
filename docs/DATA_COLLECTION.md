# CivicFault — training data collection

Use this layout for **Google Drive**, **Dropbox**, or **Cloudflare R2** so collection can start with one LC1 / estate this week.

## Folder structure

```text
civicfault-training/
  README.txt                 # short rules for field collectors
  rubric.txt                 # one-page class definitions
  raw/                       # optional: unsorted phone dumps
  labeled/
    pothole/
    water_leak/
    blocked_drain/
    downed_power_line/
    uncollected_waste/
    broken_streetlight/
    damaged_road_sign/
    other/
```

**How to create on Drive:** New folder `civicfault-training` → inside it create `labeled` → inside `labeled` create the 8 class folders exactly as named above (snake_case).

**R2 / S3:** same keys as prefixes, e.g. `labeled/pothole/img001.jpg`.

## Targets (v1)

| Class | Minimum | Comfortable |
|--------|---------|-------------|
| Each of the 7 specific classes | 100 photos | 200–300 |
| `other` | 80 | 150 |

## Capture rules

- Phone photos only (production reality).
- Day + late afternoon; night for streetlights/poles when safe.
- Fault should be visible in frame (not pure sky / selfie).
- One primary class per photo; if unsure → `other`.
- Prefer new scenes over 20 near-identical shots of the same pothole.

## Rubric (paste into `rubric.txt`)

- **pothole** — hole/defect in road or path surface
- **water_leak** — water from pipe/network (not only rain puddle)
- **blocked_drain** — clogged gutter/drain entrance or channel
- **downed_power_line** — fallen/unsafe electrical cable or pole
- **uncollected_waste** — refuse piles, bags, overflowing skips
- **broken_streetlight** — street lighting fixture/pole damaged or dark
- **damaged_road_sign** — traffic or street-name sign damaged
- **other** — unclear, multiple equal faults, or not infrastructure

## Privacy

Blur faces and number plates when practical. Training does not need identity.

## After collection

1. Spot-check 10% of labels (second person).
2. Split train/val/test by **day or area**, not random frames from the same scene.
3. Train YOLOv8-cls; deploy via `YOLO_MODEL_PATH` on Railway.

Until a real model is loaded, the app uses **manual category** on submit (Phase 0).
