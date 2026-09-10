# Slice Lab — GitHub Pages package

The complete ENGR-120 3D printing explainer, ready to add to a GitHub Pages site. Includes alternating lines, grid, hexagonal honeycomb, and gyroid infill; all three sample models; animated nozzle motion; and the blue retro artwork.

**No build step, npm installation, API keys, backend, or ChatGPT login is required.** All JavaScript, fonts, and graphics are included locally. The reading links open external reference pages. Students need a modern browser with WebGL 2 for the 3D view.

## Add to your existing GitHub Pages repo

1. Extract the ZIP. It contains a folder named `slice-lab`.
2. Copy that entire folder into the directory your existing site publishes. Use the repository root for a root-based site, or `docs/slice-lab` if your site publishes from `/docs`. For a custom build workflow, include this folder unchanged in its published output.
3. Commit and push using your existing Pages workflow.
4. Open the `slice-lab/` path beneath your site's current URL. Example: `https://dinocrates.github.io/YOUR-REPOSITORY/slice-lab/`.

Keep `index.html`, the JavaScript modules, `styles.css`, `assets`, and `vendor` together. All runtime paths are relative, so you can rename the `slice-lab` folder without changing the code. Add a link from your existing site navigation if desired. Your site's existing homepage can stay as it is.

GitHub's guide explains how the publishing folder maps to the site: [Creating a GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site).

## Use a dedicated repository instead

Copy the **contents** of the extracted `slice-lab` folder into the new repository root, including the empty `.nojekyll` file. In GitHub, choose **Settings → Pages → Build and deployment → Deploy from a branch**, then choose your publishing branch and **/(root)** and save. For a repository named `slice-lab`, the project URL would be `https://dinocrates.github.io/slice-lab/`.

The `.nojekyll` file disables Jekyll when placed at the publishing root. When adding Slice Lab beneath an existing Jekyll site, keep that site's existing configuration. This app's files do not require Jekyll processing.

Reference: [Configuring a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Try it locally

Serve the extracted `slice-lab` folder over HTTP. If Python is installed, open a terminal in that folder and run:

```bash
python -m http.server 8000
```

On Windows, `py -m http.server 8000` is another option. Then open `http://localhost:8000/`. You can also use an editor's static-site preview server. Opening `index.html` directly with `file://` can block the JavaScript modules.

## Edit the app

| File | Purpose |
| --- | --- |
| `index.html` | Controls, instructions, page title, and learning content |
| `styles.css` | Colors, fonts, layout, and responsive styling |
| `app.mjs` | 3D rendering, camera controls, and playback |
| `engine.mjs` | Sample models, slicing, walls, supports, and ordered toolpaths |
| `infill.mjs` | Honeycomb and gyroid geometry |
| `assets/printer.png` | Transparent pixel-art printer illustration |
| `assets/fonts/` | Included fonts and their license files |
| `vendor/` | Three.js, OrbitControls, and their MIT license |
| `tests/infill.test.mjs` | Geometry and path checks; not needed for hosting |
| `TECHNICAL-NOTES.md` | Model assumptions, limitations, sources, and artwork prompt |

If Node.js is installed, run the included checks from the extracted folder:

```bash
node tests/infill.test.mjs
```

The package's geometry checks and local asset references were verified. Visual browser testing has not been performed. This is an educational slicer for the included models, not a general STL slicer or machine-ready G-code generator.

## Third-party files

Retain `vendor/LICENSE` and the font license files in `assets/fonts/` when redistributing those dependencies. See `THIRD-PARTY-NOTICES.md` for their locations.
