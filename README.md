# WingtraLIDAR Height Colorizer

A browser-based tool to colorize `.las` point clouds by height (Z value).  
All processing runs **100% locally** — no data is uploaded to any server.

![License](https://img.shields.io/badge/license-MIT-orange)

## Features

- Drag & drop `.las` file upload
- Automatic Z-range detection from LAS header
- Manual Min Z / Max Z sliders to fine-tune the color range
- 7-stop height gradient: Deep Blue → Cyan → Green → Yellow → Orange → Red
- Interactive 3D point cloud preview (Three.js) with orbit, zoom, and pan
- Top / Front / Side orthographic view presets
- Import, colorize, and export progress bars
- Download colorized `.las` (uses File System Access API on Chrome/Edge for large files)
- Supports LAS 1.0–1.4, point formats 0–10

## Supported Formats

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

## Usage

Open [the live site](https://your-deployment.vercel.app) in a browser, or run locally:

```bash
# No build step needed — just open the file
open index.html
```

## Deployment (Vercel)

1. Fork or clone this repo
2. Import the repo on [vercel.com](https://vercel.com)
3. Deploy — no configuration needed

## Tech Stack

- Vanilla HTML / CSS / JavaScript (no framework)
- [Three.js r128](https://threejs.org/) via CDN for 3D rendering
- File System Access API for large file downloads (Chrome/Edge)

## License

MIT
