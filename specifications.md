You are a **senior front-end engineer and interaction designer** building a **Canva-like canvas editor** for structured graphic design JSON files.

---

## 1. Technology & Constraints

* **Use ONLY**

  * HTML
  * CSS
  * Vanilla JavaScript (ES6+)
* ❌ No React, Vue, Angular, Svelte, or other frameworks
* ❌ No build tools (Webpack, Vite, etc.)
* ✅ Use **Tailwind CSS via CDN**
* ✅ Use **Google Fonts** (dynamic loading based on JSON)
* ✅ Use **HTML5 Canvas** for rendering
* ✅ Use **UI Sans Serif font** for UI
* ✅ Support **Dark & Light Mode**

---

## 2. Input Data Model

The editor operates on a **JSON file** that follows the provided schema:

* Canvas-level properties:

  * `canvas_width`, `canvas_height`
  * `format`, `category`, `industries`, `title`
* Element-level parallel arrays:

  * `type`, `left`, `top`, `width`, `height`, `angle`, `opacity`
  * `text`, `font`, `font_size`, `text_color`, `text_align`
  * `image`, `color`
* Element order = **layer order**
* Any modification must **mutate the JSON in memory**
* Exported JSON must reflect **exact current state**

---

## 3. Application Layout

### Overall Structure

```
-----------------------------------------------------
| Top Bar (File / Export / Zoom / Theme Toggle)    |
-----------------------------------------------------
| Left Sidebar |        Canvas Area                |
|               |  (High-res, zoomable, pannable) |
-----------------------------------------------------
| Toast / Status Overlay                           |
-----------------------------------------------------
```

---

## 4. Left Sidebar (Inspector + Layers)

### A. Context-Aware Inspector (Top Section)

Show controls **based on selected element type**:

#### For all elements

* Position: X, Y
* Size: Width, Height
* Rotation (slider + numeric)
* Opacity
* Lock / Unlock
* Visibility toggle

#### TextElement

* Text content (editable textarea)
* Font family (dropdown from Google Fonts)
* Font size
* Bold / Italic toggles
* Text color picker
* Line height
* Letter spacing
* Text alignment
* Capitalize toggle

#### ImageElement

* Replace image (file upload)
* Opacity
* Crop mode (basic bounding box)

#### SvgElement / Background

* Fill color(s)
* Gradient support (if applicable)

> Controls should be **grouped into collapsible sections**:

* Transform
* Appearance
* Typography
* Advanced

Each group:

* Has an **icon button**
* Expands on click
* Uses minimal UI styling

---

### B. Layer Panel (Bottom Section)

* Shows all elements as **layers**
* Each layer:

  * Thumbnail icon (Text / Image / Shape)
  * Name (auto-generated if missing)
  * Eye icon (hide/show)
  * Trash icon (delete)
* Supports:

  * Drag-to-reorder layers
  * Click to select
* Layer order = rendering order

---

## 5. Canvas Area

### Canvas Behavior

* High-resolution canvas (devicePixelRatio aware)
* Scales crisply on zoom
* Centered within workspace
* Shows checkerboard background outside canvas

### Interactions

* Click to select element
* Drag to move
* Resize using corner handles
* Rotate using rotation handle
* Multi-select (Shift + click)
* Highlight active element with:

  * Bounding box
  * Resize handles
  * Rotation handle

---

## 6. Floating Mini Toolbar (On Canvas)

When an element is selected, show a **contextual floating toolbar** near it:

### For Text

* Font size
* Bold / Italic
* Text color
* Align left / center / right

### For All

* Duplicate
* Bring forward
* Send backward
* Delete

Toolbar:

* Auto-positions to avoid canvas edges
* Semi-transparent background
* Minimal icons

---

## 7. Right-Click Context Menu

Enable right-click on canvas elements:

Options:

* Bring to front
* Send to back
* Duplicate
* Delete

Styled custom menu (not browser default)

---

## 8. Import & Export

### Import

* Upload JSON file
* Validate schema
* Load fonts dynamically from Google Fonts
* Show loading toast while parsing

### Export Options

* Export JSON (current state)
* Export PNG (high resolution)
* Export JPEG (quality slider)

Ensure:

* Canvas is rendered at full resolution during export
* JSON export exactly matches current design state

---

## 9. Zoom & Navigation

* Zoom in / out buttons
* Zoom slider
* Mouse wheel zoom (Ctrl + scroll)
* Pan canvas when spacebar is held
* Zoom percentage indicator

---

## 10. UI & Styling

### Design Language

* Modern, minimal
* Clean spacing
* Rounded corners
* Subtle shadows

### Colors

* Accent color: **soft blue gradient**
* Neutral grays for UI
* Clear contrast in dark mode

### Fonts

* UI: Inter / system-ui / sans-serif
* Canvas fonts: dynamically loaded from Google Fonts

---

## 11. Dark / Light Mode

* Toggle in top bar
* Uses Tailwind dark mode classes
* Persists preference (localStorage)

---

## 12. Toasts & Status Indicators

Use toast notifications for:

* File loading
* Export success
* Errors
* Font loading

Toasts:

* Bottom-right
* Auto-dismiss
* Non-blocking

---

## 13. Code Organization (Important)

Organize code **modularly**, even without frameworks:

```
/index.html
/styles.css (minimal, Tailwind-first)
/js/
  state.js        // JSON state management
  canvas.js       // Rendering & transforms
  sidebar.js      // Inspector & layers
  interactions.js // Drag, resize, rotate
  toolbar.js      // Floating toolbar
  contextMenu.js
  export.js
  utils.js
```

* Single global `editorState` object
* All UI updates are derived from this state
* Canvas re-renders on state change

---

## 14. Performance & Stability

* Efficient redraws (requestAnimationFrame)
* Debounce text edits
* Avoid full re-render on minor changes
* Graceful error handling

---

## 15. Final Goal

The result should feel like:

> **A lightweight, browser-only, Canva-style editor powered entirely by structured JSON**, where the JSON is the single source of truth.

