# BetterQuill for Builder.io

A production-grade rich text editor plugin for [Builder.io](https://builder.io) that replaces the default text editing experience with a full-featured, professionally designed WYSIWYG editor.

Built for content teams who need real editorial control -- tables, font sizing, image alt text, HTML source editing, fullscreen mode, and a dark UI that stays out of the way.

[![npm version](https://img.shields.io/npm/v/betterquill-builderio.svg)](https://www.npmjs.com/package/betterquill-builderio)
[![license](https://img.shields.io/npm/l/betterquill-builderio.svg)](https://github.com/M8N-MatanDessaur/BuilderIO-BetterQuill-plugin/blob/main/LICENSE)

---

## Quick Start

Add the plugin URL to your Builder.io account:

```
Plugins icon > Advanced Settings > Add:
https://unpkg.com/betterquill-builderio/dist/plugin.system.js
```

Then use **RichText** as the field type in any model. That's it.

---

## Why This Exists

Builder.io's default rich text field is limited. No tables, no font size control, no fullscreen, no source editing, no image alt text. BetterQuill fills every gap:

| Feature | Default | BetterQuill |
|---|---|---|
| Bold, italic, underline, strike | Yes | Yes |
| Headers (H1--H6) | Yes | Yes |
| Text color & highlight color | Basic | Custom modal with 80 swatches + native picker |
| Font size control (10px--72px) | No | Yes |
| Tables with row/column management | No | Yes (grid picker + toolbar) |
| Image alt text & dimensions | No | Yes (click image to edit) |
| Link editing modal | No | Yes (URL, text, new tab toggle) |
| Video embed modal | No | Yes |
| Fullscreen editing (Word-style) | No | Yes |
| HTML source view (CodeMirror 6) | No | Yes |
| Undo / Redo toolbar buttons | No | Yes |
| Clear formatting button | No | Yes |
| Superscript / Subscript | No | Yes |
| Checklists | No | Yes |
| Dynamic toolbar state | No | Yes (reflects current selection) |
| Dark editorial UI | No | Yes |

---

## Features

### Text Formatting

Full formatting toolbar with dynamic state -- selecting bold text shows the bold button as active, selecting 24px text shows "24px" in the size picker, mixed sizes show "Mixed".

- Headers H1--H6
- Font size: 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72px
- Bold, italic, underline, strikethrough
- Superscript and subscript
- Text alignment (left, center, right, justify)
- Ordered lists, bullet lists, checklists
- Indent / outdent
- Blockquotes and code blocks
- Clear formatting button (removes all formatting from selection)
- Undo / Redo buttons (100-step history, also Ctrl+Z / Ctrl+Y)

### Color Picker

Click the text color (A) or highlight icon in the toolbar to open a custom color modal:

- 80 color swatches organized in a 10-column grid (light to dark)
- "Remove color" button to clear the color
- Native OS color picker for custom colors (stays open while you pick)
- Apply button to confirm custom color
- Toolbar icon updates to reflect the currently selected text's color

Replaces Quill's built-in color dropdown (which was invisible on dark backgrounds).

### Tables

Click the table icon in the toolbar to open a visual grid picker (up to 8x8). Click a cell inside the table to reveal the table toolbar:

- Insert row above / below
- Insert column left / right
- Delete row / column
- Delete entire table

Tables render with visible borders (`#444444`) on the dark background and support horizontal scrolling.

### Images

Click any image in the editor to open the image properties modal:

- **Alt text** -- for SEO and accessibility
- **Width** and **Height** -- set dimensions (pixels or percentage)
- **Delete** -- remove the image

### Links

Click any link in the editor to open the link properties modal, or select text and click the link toolbar button to create a new link:

- **URL** -- the link destination
- **Text** -- the visible link text
- **Open in new tab** -- toggle `target="_blank"`
- **Unlink** -- remove the link, keep the text

Replaces Quill's built-in tooltip (which overflows and can't be closed) with a proper modal.

### Video Embed

Click the video icon in the toolbar to open the video embed modal:

- Enter a video URL (YouTube embed, Vimeo, or direct video URL)
- Insert into the editor at the cursor position

### Fullscreen Mode

Click **EXPAND** in the control bar. The editor goes full-viewport with a Word/Google Docs-style layout:

- Sticky toolbar spans the full width at the top
- Dark background (`#111`) fills the viewport
- Content sits on a centered 850px "page" with padding and border
- Single scrollbar on the editor wrapper
- Click **EXIT** to return to inline mode

### Source View

Click **SOURCE** in the control bar to switch to a CodeMirror 6 HTML editor:

- Syntax highlighting (One Dark theme)
- Line numbers
- Auto-formatting via js-beautify
- Line wrapping
- Tab indentation support
- Edits sync back to the visual editor on toggle

### HTML Sanitization

The editor sanitizes output before passing it to Builder.io:

- Strips empty `<p><br></p>` tags (Quill generates these on Enter)
- Removes empty `<p></p>` elements
- Collapses 3+ consecutive `<br>` tags
- Trims trailing `<br>` tags

---

## Installation

### CDN (Recommended)

No installation required. Add one of these URLs in Builder.io:

**unpkg:**
```
https://unpkg.com/betterquill-builderio/dist/plugin.system.js
```

**jsDelivr:**
```
https://cdn.jsdelivr.net/npm/betterquill-builderio/dist/plugin.system.js
```

### npm

```bash
npm install betterquill-builderio
```

### From Source

```bash
git clone https://github.com/M8N-MatanDessaur/BuilderIO-BetterQuill-plugin.git
cd BuilderIO-BetterQuill-plugin
npm install
npm run build
```

### Self-Hosted

Build and upload `dist/plugin.system.js` to any static host (S3, Netlify, Vercel, GitHub Pages). Ensure CORS headers allow Builder.io's origin:

```
Access-Control-Allow-Origin: *
```

---

## Builder.io Setup

1. Go to Builder.io
2. Click the **Plugins** icon in the left sidebar
3. Click **Advanced Settings**
4. Add the plugin URL
5. Click **Save**
6. In any **Model**, add or change a field type to **RichText**

The BetterQuill editor appears wherever you use a RichText field.

---

## Development

```bash
npm start
```

Starts webpack-dev-server on `http://localhost:1268`. Add `http://localhost:1268/plugin.system.js` as the plugin URL in Builder.io for local testing.

**Chrome users:** You may need to click the shield icon in the address bar and select "Load unsafe scripts" to allow the HTTP localhost plugin on Builder.io's HTTPS page.

---

## Design

BetterQuill uses a brutalist editorial design language:

- **Background:** `#191919` (editor), `#1a1a1a` (toolbar/surfaces), `#111111` (fullscreen backdrop)
- **Borders:** `#333333`, 1px solid throughout
- **Text:** `#e0e0e0` (primary), `#a0a0a0` (secondary), `#666666` (tertiary)
- **Tables:** `#444444` borders, `#1f1f1f` row hover
- **Accent:** `#e0e0e0` inverted on hover/active (light on dark becomes dark on light)
- **Typography:** System sans-serif for content, Courier New monospace for UI labels
- **Controls:** Uppercase, letter-spaced, no border-radius, instant feedback
- **Selection:** `rgba(100, 160, 255, 0.3)` highlight
- **Modals:** Overlay with `rgba(0, 0, 0, 0.8)`, `#1a1a1a` background, consistent across link/image/video/color

---

## Tech Stack

| Dependency | Purpose |
|---|---|
| [Quill 2.0](https://quilljs.com/) | WYSIWYG editor core |
| [quill-better-table](https://github.com/soccerloway/quill-better-table) | Table support |
| [CodeMirror 6](https://codemirror.net/) | HTML source editor |
| [js-beautify](https://github.com/beautifier/js-beautify) | HTML auto-formatting |
| [@builder.io/react](https://www.builder.io/) | Builder.io plugin SDK |
| [@emotion/core](https://emotion.sh/) | CSS-in-JS (provided by Builder.io runtime) |
| [Webpack 5](https://webpack.js.org/) | Bundling (System.js output for Builder.io) |

---

## Publishing

```bash
npm version patch   # or minor / major
npm publish         # runs build automatically via prepublishOnly
```

---

## Browser Support

- Chrome / Edge (latest)
- Firefox (latest)
- Safari (latest)

---

## License

[ISC](LICENSE) -- Matan Dessaur, 2026

---

## Links

- [npm](https://www.npmjs.com/package/betterquill-builderio)
- [GitHub](https://github.com/M8N-MatanDessaur/BuilderIO-BetterQuill-plugin)
- [Builder.io Plugin Docs](https://www.builder.io/c/docs/extending/plugins)
