# WingtraLIDAR Colorizer & Classifier Beta

A browser-based point cloud processing tool for `.las` files.  
All processing runs **100% locally** — no data is ever uploaded to any server.

---

## Three Modes

### 🏔️ Height Colorizer
Colorize each point by its Z value using a 7-stop gradient (deep blue → cyan → green → yellow → orange → red).
- Drag & drop a `.las` file
- Automatic Z-range detection from LAS header
- Manual Min Z / Max Z sliders to fine-tune the color range
- Interactive 3D preview with orbit, zoom, pan, auto-rotate, and point size control

### 📷 Ortho Colorizer
Project true RGB colors from a GeoTIFF orthomosaic onto each point using its XY coordinates.
- Drag & drop a `.las` and a `.tif` — processing starts automatically when both are loaded
- Handles uint8 and uint16 GeoTIFFs
- Both files must share the same CRS (coordinate reference system)

### 🗺️ Ground Classifier
Detect ground points using a progressive grid-based DTM algorithm, apply height colorization, and export.
- Tune 4 parameters: Grid Cell Size, Max Ground Thickness, Surface Smoothness, Accuracy Passes
- Ground points (Class 2): colored by height gradient
- Non-ground points (Class 1): neutral gray
- Two exports: all points with classification, or ground-only `.las`

---

## 3D Viewer Controls

| Input | Action |
|---|---|
| Drag | Rotate |
| Scroll | Zoom |
| Shift + Drag | Pan |
| View buttons | Snap to 3D / Top / Front / Side |
| Point Size slider | Adjust point size |
| Auto Rotate toggle | Toggle slow rotation |
| ⤢ button | Fullscreen |

---

## LAS Support

LAS 1.0–1.4, point formats 0–10. Formats without RGB are automatically upgraded (0→2, 1→3, 4→5, 6→8, 9→10). LAS Classification byte written per spec.

---

## Large File Downloads

- **Chrome / Edge 86+** — File System Access API, streams directly to disk, no size limit
- **Firefox / Safari** — Base64 data URI, up to ~150 MB

---

## Tech Stack

- Vanilla HTML / CSS / JavaScript — no framework, no build step
- [Three.js r128](https://threejs.org/) — 3D point cloud preview
- [GeoTIFF.js 2.1.3](https://geotiffjs.github.io/) — GeoTIFF parsing (Ortho mode)

---

## Local Usage

```bash
# Open directly — no server needed
open index.html

# Or serve locally
npx serve .
```

## Deployment (Vercel)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo
3. Click **Deploy** — no configuration needed

Every `git push` to `main` triggers an automatic redeploy.

---

## File Structure

```
├── index.html    ← full application (~100 KB, single file)
├── vercel.json   ← COOP header required for File System Access API
└── README.md
```

---

MIT License
