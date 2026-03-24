# WingtraLIDAR Point Cloud Tool — Beta v6.0

Browser-based LiDAR point cloud processing. All computation runs **100% locally** in the browser — no data is uploaded to any server.

---

## Workflow

| Step | Description |
|---|---|
| **1** | Open Point Cloud |
| **2** | Select Tool |
| **3** | Review Results |
| **4** | Export Deliverables |

Ground Classifier uses all 4 steps. All other tools go 1 → 2 → 3 → 4.

---

## Tools

| Tool | Description | Output |
|---|---|---|
| 👁️ **Viewer** | 3D view with All Points / Ground Only / RGB layer switching | — |
| 🏔️ **Height Colorizer** | Colorize by Z value with adjustable min/max range | Colorized `.las` |
| 🗺️ **Ground Classifier** | Progressive DTM-based ground detection | Classified `.las` + Ground-only `.las` |
| 📷 **Ortho Colorizer** | Project RGB from a GeoTIFF orthomosaic onto each point | Colorized RGB `.las` |

---

## Tech Stack

- **Vanilla HTML/CSS/JS** — no build step, single file app
- **Three.js r128** — 3D point cloud preview
- **GeoTIFF.js 2.1.3** — raster decoding for ortho colorization
- **File System Access API** — large file exports in Chrome/Edge (no size cap)
- **Base64 fallback** — export in other browsers (up to 150 MB)

---

## Deploy

### Local
Open `index.html` directly in Chrome or Edge — no server needed.

### Vercel
1. Push repo to GitHub
2. Import at [vercel.com](https://vercel.com) and click **Deploy**
3. `vercel.json` sets the required `Cross-Origin-Opener-Policy` header for the File System Access API

```bash
git add .
git commit -m "WingtraLIDAR Point Cloud Tool v6.0"
git push
```

Auto-redeploys on every push.

---

## Supported LAS Formats

- LAS 1.0 – 1.4
- Point formats 0 – 10
- Large files (LAS 1.4 64-bit point count)

---

*All processing runs locally in your browser. No data is uploaded to any server.*
