# kryptdev.me

Personal site of **Ali Saleh** (EG-KRYPT) — computer engineer, software and game developer.
Live at **[kryptdev.me](https://kryptdev.me)**, hosted on GitHub Pages.

Two pages:

| Page | What it is |
| --- | --- |
| `index.html` | Landing page — bio, games, projects, certificates, contact |
| `os.html` | **KryptOS**, an interactive desktop: draggable windows, a working terminal, paint app and calculator |

No frameworks, no build step, no dependencies. Plain HTML, CSS and JavaScript —
edit a file, commit, and it's live.

---

## Structure

```
.
├── index.html            landing page
├── os.html               KryptOS desktop
├── 404.html              not-found page
├── CNAME                 custom domain (kryptdev.me)
├── site.webmanifest      installable-app metadata
├── robots.txt            crawler rules
├── sitemap.xml           page list for search engines
├── .nojekyll             skip Jekyll processing, faster deploys
├── Degrees/              certificate PDFs
└── assets/
    ├── css/
    │   ├── base.css      design tokens, reset, shared primitives
    │   ├── site.css      landing page
    │   └── os.css        KryptOS
    ├── js/
    │   ├── site.js       nav, copy buttons, launch transition
    │   └── os.js         window manager, terminal, calculator, paint
    └── img/              screenshots, icons, social share image
```

## Running it locally

Any static server works. From the repo root:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening the files directly with `file://` mostly works, but the clipboard
buttons need a real origin, so use the server.

## Design tokens

Colours, fonts and spacing all live in `:root` at the top of
`assets/css/base.css`. Change a value there and it updates both pages.

```css
--violet: #a855f7;   /* primary brand */
--magenta: #ec4899;  /* secondary */
--text: #ece9f5;     /* body text */
```

Every text colour in the palette meets WCAG AA contrast against the
background, so keep new colours at 4.5:1 or better.

## Common edits

**Add a game** — copy an `<a class="game">` block in `index.html`, drop a
cover image in `assets/img/`, and add the matching row to the `gamelist` in
`os.html`.

**Add a certificate** — put the PDF in `Degrees/`, then add a `<li>` to the
`creds` list in `index.html` and a `.file` link in the `app-files` window in
`os.html`.

**Add a terminal command** — add a function to the `COMMANDS` object in
`assets/js/os.js`. It receives the arguments as an array. Add a row to the
`help` listing too. Always wrap anything the user typed in `esc()` before
printing it.

**Add a desktop app** — copy a `<section class="win">` block, give it a unique
`id`, `data-title` and `data-glyph`, then add a `<button data-open-app="your-id">`
to both `#icons` and the start menu. The window manager picks it up
automatically.

## Things to keep current

- The age in the hero paragraph of `index.html` is hard-coded — search for
  `18 years old`. The copyright year updates itself.
- The profile photo loads from `https://github.com/egkrypt.png`. If that
  account is ever renamed the image breaks, so it falls back to the local
  `assets/img/icon-512.png`. Saving a local copy would remove the dependency.
- `sitemap.xml` has a `lastmod` date worth refreshing after a big change.
- New images should get a WebP version next to them — see the `<picture>`
  blocks for the pattern. WebP cut the image weight here by about 80%.

## Optimising a new image

```bash
python3 -c "
from PIL import Image
im = Image.open('assets/img/new.png').convert('RGB')
im.save('assets/img/new.webp', 'WEBP', quality=82, method=6)
"
```

## Browser support

Modern Chrome, Edge, Firefox and Safari, plus iOS and Android. The pages
degrade sensibly: with JavaScript off you still get the full landing page and
the KryptOS link, and `prefers-reduced-motion` turns off every animation.

---

© Ali Saleh. Code is free to learn from; the games, screenshots, certificates
and personal content are not for reuse.
