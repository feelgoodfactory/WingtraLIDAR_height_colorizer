# WingtraLIDAR Colorizer

A browser-based tool to colorize `.las` point clouds — by height or by RGB orthomosaic.  
All processing runs **100% locally** — no data is ever uploaded to any server.

![Version](https://img.shields.io/badge/version-2.0.0-orange)
![License](https://img.shields.io/badge/license-MIT-orange)

---

## Modes

### A — Height Colorize
Colorize each point by its Z value using a 7-stop gradient (deep blue → cyan → green → yellow → orange → red).

- Drag & drop a `.las` file
- Automatic Z-range detection from LAS header
- Manual **Min Z / Max Z sliders** to fine-tune the color range
- Instant 3D preview updates as you drag sliders
- Download the colorized `.las`

### B — Orthomosaic Colorize
Project true RGB colors from a GeoTIFF orthomosaic onto each point using its XY coordinates.

- Drag & drop a `.las` **and** a `.tif` (in any order)
- Processing starts automatically once both files are loaded
- Handles uint8 (0–255) and uint16 (0–65535) GeoTIFFs
- Points outside the TIF extent receive black (0, 0, 0)
- **Both files must share the same CRS (coordinate reference system)**

---

## Progress Bars

| Mode | Bar | What it tracks |
|---|---|---|
| Both | Import LAS | FileReader reading .las into memory |
| Ortho | Import TIF | FileReader reading .tif into memory |
| Ortho | Decode TIF | GeoTIFF.js decoding raster pixel data |
| Ortho | Sample Colors | Per-point XY → pixel RGB lookup |
| Height | Colorize | Per-point Z → gradient color mapping |
| Both | Export | Encoding & writing the output file |

---

## LAS Support

| Point Format | Has Color | Output Format |
|---|---|---|
| 0 | ✗ | Upgraded to 2 |
| 1 | ✗ | Upgraded to 3 |
| 2 | ✓ | 2 (unchanged) |
| 3 | ✓ | 3 (unchanged) |
| 4 | ✗ | Upgraded to 5 |
| 5 | ✓ | 5 (unchanged) |
| 6 | ✗ | Upgraded to 8 |
| 7 | ✓ | 7 (unchanged) |
| 8 | ✓ | 8 (unchanged) |
| 9 | ✗ | Upgraded to 10 |
| 10 | ✓ | 10 (unchanged) |

LAS versions 1.0–1.4 supported.

---

## Download / Large Files

- **Chrome / Edge 86+**: uses the File System Access API (`showSaveFilePicker`) — streams directly to disk, no file size limit
- **Firefox / Safari**: uses base64 data URI — works up to ~150 MB
- For files larger than 150 MB on Firefox/Safari, use Chrome or Edge

---

## Tech Stack

- Vanilla HTML / CSS / JavaScript (zero framework, zero build step)
- [Three.js r128](https://threejs.org/) — 3D point cloud preview
- [GeoTIFF.js 2.1.3](https://geotiffjs.github.io/) — GeoTIFF parsing & raster decoding
- File System Access API — large file streaming download

---

## Local Usage

No build step needed:

```bash
# Just open the file directly
open index.html
```

Or serve it locally:

```bash
npx serve .
# → http://localhost:3000
```

---

## Deployment (Vercel)

1. Fork or clone this repo
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo
3. Click **Deploy** — no configuration needed

Every `git push` to `main` triggers an automatic redeploy.

---

## Repository Structure

```
├── index.html      ← the entire application (single file)
├── vercel.json     ← Vercel headers config
└── README.md       ← this file
```

---

## License

MIT
