import store, { LAYER_TYPES } from './state.js';
import { renderCanvas as render } from './canvas.js';
import { initInteractions } from './interactions.js';
import { initSidebar } from './sidebar.js';
import { initToolbar } from './toolbar.js';
import { initContextMenu } from './contextMenu.js';
import { exportToImage, exportProject } from './export.js';
import { initShortcuts } from './shortcuts.js';
import { showToast } from './toasts.js';
import { generateId, debounce } from './utils.js';

/**
 * Main Entry Point
 */
function init() {
    console.group("Initializing Design Editor");

    // 1. Initial Render
    render();
    console.log("Canvas rendered");

    // 2. Setup Interactions
    initInteractions();
    console.log("Interactions initialized");

    // 3. Setup Sidebar
    initSidebar();
    initToolbar();
    initContextMenu();
    initShortcuts();
    console.log("Sidebar & UI initialized");

    // 4. Setup Global UI (Top Bar)
    setupThemeToggle();
    setupZoomControls();
    setupZoomControls();
    setupExportImport();
    setupGoogleFonts();

    console.groupEnd();
}

/**
 * Google Fonts Loader
 * Dynamically loads fonts referenced in the state.
 */
function setupGoogleFonts() {
    // Initial check
    loadFonts(store.get());

    // Subscribe to state changes to look at fonts
    store.subscribe(debounce(() => {
        loadFonts(store.get());
    }, 1000));
}

function loadFonts(state) {
    const fonts = new Set();

    // Scan layers for font families
    state.layers.forEach(layer => {
        if (layer.type === 'TextElement' && layer.content && layer.content.lines) {
            layer.content.lines.forEach(line => {
                if (line.font) fonts.add(line.font);
            });
        }
    });

    // Check existing links
    // Ideally we assume all fonts are google fonts for MVP
    // Construct URL: https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,400;0,700;1,400&display=swap

    if (fonts.size === 0) return;

    // We can load them individually or in bulk.
    // For simplicity, let's inject a link tag for each NEW font not seen?
    // Or just one massive link tag that gets updated? Updating link tag causes re-flow.

    fonts.forEach(fontFamily => {
        const id = `font-${fontFamily.replace(/\s+/g, '-').toLowerCase()}`;
        if (!document.getElementById(id)) {
            const link = document.createElement('link');
            link.id = id;
            link.rel = 'stylesheet';
            // Encode font family
            const encoded = fontFamily.replace(/\s/g, '+');
            // Load a few weights/styles by default
            link.href = `https://fonts.googleapis.com/css2?family=${encoded}:ital,wght@0,400;0,700;1,400&display=swap`;

            showToast(`Loading font: ${fontFamily}...`, 'info', 2000);

            link.onload = () => {
                showToast(`Font loaded: ${fontFamily}`, 'success');
            };
            link.onerror = () => {
                showToast(`Font "${fontFamily}" not found. Reverting to fallback.`, 'error');

                // Fallback Logic: Revert layers using this font
                const state = store.get();
                const newLayers = state.layers.map(layer => {
                    if (layer.type === 'TextElement' && layer.content && layer.content.lines) {
                        // Check if any line uses the broken font
                        const hasBadFont = layer.content.lines.some(l => l.font === fontFamily);
                        if (hasBadFont) {
                            return {
                                ...layer,
                                content: {
                                    ...layer.content,
                                    lines: layer.content.lines.map(l =>
                                        l.font === fontFamily ? { ...l, font: 'Arial' } : l
                                    )
                                }
                            };
                        }
                    }
                    return layer;
                });

                // Only update if changed
                if (newLayers !== state.layers) {
                    store.setState({ layers: newLayers });
                }
            };

            document.head.appendChild(link);
            console.log(`Requesting Font: ${fontFamily}`);
        }
    });
}

/**
 * Theme Toggle Logic
 */
function setupThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    const iconSun = document.getElementById('theme-icon-sun');
    const iconMoon = document.getElementById('theme-icon-moon');
    const html = document.documentElement;

    // Load initial preference
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        html.classList.add('dark');
        iconSun.classList.remove('hidden');
        iconMoon.classList.add('hidden');
    } else {
        html.classList.remove('dark');
        iconSun.classList.add('hidden');
        iconMoon.classList.remove('hidden');
    }

    btn.addEventListener('click', () => {
        if (html.classList.contains('dark')) {
            html.classList.remove('dark');
            localStorage.theme = 'light';
            iconSun.classList.add('hidden');
            iconMoon.classList.remove('hidden');
            store.setState({ editor: { ...store.get().editor, ui: { theme: 'light' } } }, false);
        } else {
            html.classList.add('dark');
            localStorage.theme = 'dark';
            iconSun.classList.remove('hidden');
            iconMoon.classList.add('hidden');
            store.setState({ editor: { ...store.get().editor, ui: { theme: 'dark' } } }, false);
        }
    });
}

/**
 * Zoom Controls
 */
// Global Zoom Setter
window.setZoom = (z) => {
    let currentZoom = Math.min(Math.max(z, 0.1), 5); // Clamping 10% to 500%
    const container = document.getElementById('canvas-container');
    const label = document.getElementById('zoom-label');

    container.style.transform = `scale(${currentZoom})`;
    label.textContent = `${Math.round(currentZoom * 100)}%`;
    store.setState({ canvas: { ...store.get().canvas, zoom: currentZoom } }, false);
};

function setupZoomControls() {
    const zoomIn = document.getElementById('zoom-in');
    const zoomOut = document.getElementById('zoom-out');
    const label = document.getElementById('zoom-label');
    const zoomContainer = document.getElementById('zoom-container');
    const zoomDropdown = document.getElementById('zoom-dropdown');
    const zoomFit = document.getElementById('zoom-fit');

    let currentZoom = store.get().canvas.zoom;
    // Init
    document.getElementById('canvas-container').style.transform = `scale(${currentZoom})`;
    label.textContent = `${Math.round(currentZoom * 100)}%`;

    // Button Logic
    zoomIn.addEventListener('click', () => window.setZoom(store.get().canvas.zoom + 0.1));
    zoomOut.addEventListener('click', () => window.setZoom(store.get().canvas.zoom - 0.1));

    // Dropdown Logic
    if (zoomContainer && zoomDropdown) {
        // Show on hover container
        zoomContainer.addEventListener('mouseenter', () => zoomDropdown.classList.remove('hidden'));
        zoomContainer.addEventListener('mouseleave', () => zoomDropdown.classList.add('hidden'));

        // Option Clicks
        zoomDropdown.querySelectorAll('button[data-zoom]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const z = parseFloat(e.target.dataset.zoom);
                window.setZoom(z);
                zoomDropdown.classList.add('hidden');
            });
        });

        // Fit Logic
        zoomFit.addEventListener('click', () => {
            // Fit logic: Calculate scale to fit canvas in viewport with padding
            const workspace = document.getElementById('workspace-area');
            const canvas = document.getElementById('canvas-container');
            const padding = 60;

            // Get raw dimensions (unscaled)
            const style = window.getComputedStyle(canvas);
            const w = parseFloat(style.width);
            const h = parseFloat(style.height);

            const availW = workspace.clientWidth - padding;
            const availH = workspace.clientHeight - padding;

            const scaleW = availW / w;
            const scaleH = availH / h;

            const fitZoom = Math.min(scaleW, scaleH, 1); // Capped at 100% or fit? User usually implies seeing whole thing.
            // Let's allow > 100% if screen is huge? No, usually "Fit" means "Fit inside".
            window.setZoom(fitZoom);
            zoomDropdown.classList.add('hidden');
        });
    }
}

// Preset Delay Logic
const presetTrigger = document.getElementById('preset-trigger-container');
const presetPopover = document.getElementById('preset-popover');

if (presetTrigger && presetPopover) {
    let hoverTimeout;

    presetTrigger.addEventListener('mouseenter', () => {
        hoverTimeout = setTimeout(() => {
            presetPopover.classList.remove('hidden');
            presetPopover.classList.add('block', 'animate-in', 'fade-in', 'zoom-in-95', 'duration-100');
        }, 500); // 500ms Delay
    });

    presetTrigger.addEventListener('mouseleave', () => {
        clearTimeout(hoverTimeout);
        presetPopover.classList.add('hidden');
        presetPopover.classList.remove('block');
    });
}

/**
 * Export / Import
 */
function setupExportImport() {
    // Export Dropdown
    const exportMenuBtn = document.getElementById('export-menu-btn');
    const exportDropdown = document.getElementById('export-dropdown');

    if (exportMenuBtn && exportDropdown) {
        // Toggle
        exportMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            exportDropdown.classList.toggle('hidden');
        });

        // Hide on outside click
        document.addEventListener('click', () => {
            exportDropdown.classList.add('hidden');
        });

        // Handle Options
        exportDropdown.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.target.getAttribute('data-type');
                if (type === 'json') {
                    exportJson();
                } else {
                    exportToImage(type);
                }
                exportDropdown.classList.add('hidden');
            });
        });
    }

    // Import JSON
    const fileInput = document.getElementById('file-input');
    // Add Layer Button Listeners
    document.getElementById('add-text-btn')?.addEventListener('click', () => {
        const layer = createLayer(LAYER_TYPES.TEXT);
        store.addLayer(layer);
    });

    document.getElementById('add-image-btn')?.addEventListener('click', () => {
        // Ideally trigger file upload or URL prompt
        const layer = createLayer(LAYER_TYPES.IMAGE);
        store.addLayer(layer);
    });

    // document.getElementById('add-rect-btn')...
    document.getElementById('import-btn').addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target.result);
                // Basic Validation could go here
                store.setState(json);
                console.log("Imported successfully");
            } catch (err) {
                console.error("Error parsing JSON", err);
                alert("Invalid JSON file");
            }
        };
        reader.readAsText(file);
    });

    // File Name Editing (Title)
    const titleInput = document.getElementById('file-name');
    if (titleInput) {
        titleInput.value = store.get().document?.title || "Untitled Design";
        titleInput.addEventListener('input', debounce((e) => {
            store.setState({
                document: { ...store.get().document, title: e.target.value }
            });
        }, 500));
        store.subscribe(() => {
            const t = store.get().document?.title;
            if (t && t !== titleInput.value) {
                titleInput.value = t;
            }
        });
    }

    // File ID Editing
    const idInput = document.getElementById('file-id');
    if (idInput) {
        // Init
        const currentMeta = store.get().meta;
        idInput.value = currentMeta?.id || "";

        // Listen for changes
        idInput.addEventListener('input', debounce((e) => {
            const val = e.target.value.trim();
            if (val) {
                store.setState({
                    meta: { ...store.get().meta, id: val }
                });
            }
        }, 500));

        // Subscribe to updates (e.g. on import)
        store.subscribe(() => {
            const currentId = store.get().meta?.id;
            // Only update if focused element is NOT this input, to avoid cursor jumping
            if (currentId && currentId !== idInput.value && document.activeElement !== idInput) {
                idInput.value = currentId;
            }
        });
    }
}

// Canvas Size Controls
const canvasW = document.getElementById('canvas-w');
const canvasH = document.getElementById('canvas-h');

// Unit Helpers
const PPI = 72; // Screen PPI default
const MM_PER_IN = 25.4;

function toUnit(px, unit) {
    if (unit === 'in') return px / PPI;
    if (unit === 'mm') return (px / PPI) * MM_PER_IN;
    return px;
}

function toPx(val, unit) {
    if (unit === 'in') return val * PPI;
    if (unit === 'mm') return (val / MM_PER_IN) * PPI;
    return val;
}

// Global Helper for Units
window.setUnit = (u) => {
    store.setState({
        canvas: { ...store.get().canvas, unit: u }
    });
};

function updateCanvasInputs(state) {
    const unit = state.canvas.unit || 'px';
    const unitLabel = document.getElementById('current-unit');
    if (unitLabel) unitLabel.textContent = unit.toUpperCase();

    if (document.activeElement !== canvasW) {
        let val = toUnit(state.canvas.width, unit);
        canvasW.value = unit === 'px' ? Math.round(val) : val.toFixed(2);
    }
    if (document.activeElement !== canvasH) {
        let val = toUnit(state.canvas.height, unit);
        canvasH.value = unit === 'px' ? Math.round(val) : val.toFixed(2);
    }

    document.title = `${state.document.title || 'Untitled'} - Design Editor`;
}

// Initial Sync
updateCanvasInputs(store.get());

// Subscribe
store.subscribe(() => {
    updateCanvasInputs(store.get());
});

// Listeners
const handleResize = () => {
    const state = store.get();
    const unit = state.canvas.unit || 'px';

    let w = parseFloat(canvasW.value) || 1080;
    let h = parseFloat(canvasH.value) || 1080;

    w = toPx(w, unit);
    h = toPx(h, unit);

    w = Math.round(w);
    h = Math.round(h);

    // Scale layers to maintain absolute pixel size
    const oldW = state.canvas.width;
    const oldH = state.canvas.height;
    const scaleX = oldW / w;
    const scaleY = oldH / h;

    const newLayers = state.layers.map(layer => {
        if (!layer.transform) return layer;
        return {
            ...layer,
            transform: {
                ...layer.transform,
                position: {
                    x: layer.transform.position.x * scaleX,
                    y: layer.transform.position.y * scaleY
                },
                size: {
                    width: layer.transform.size.width * scaleX,
                    height: layer.transform.size.height * scaleY
                }
            }
        };
    });

    store.setState({
        canvas: { ...state.canvas, width: w, height: h },
        layers: newLayers
    });
};

canvasW.addEventListener('change', handleResize);
canvasH.addEventListener('change', handleResize);
canvasW.addEventListener('keydown', (e) => { if (e.key === 'Enter') { handleResize(); canvasW.blur(); } });
canvasH.addEventListener('keydown', (e) => { if (e.key === 'Enter') { handleResize(); canvasH.blur(); } });

// Global Helper for Presets
window.setCanvasSize = (w, h) => {
    // Preserve absolute pixel positions/sizes
    const state = store.get();
    const oldW = state.canvas.width;
    const oldH = state.canvas.height;

    // Ratios
    const scaleX = oldW / w;
    const scaleY = oldH / h;

    const newLayers = state.layers.map(layer => {
        // Special case: Backgrounds should always fill 100% of the canvas
        if (layer.type === LAYER_TYPES.BACKGROUND || layer.content.type === 'background') {
            return {
                ...layer,
                transform: {
                    ...layer.transform,
                    position: { x: 0.5, y: 0.5 },
                    size: { width: 1, height: 1 }
                }
            };
        }

        // Standard scaling for other layers
        let newT = { ...layer.transform };
        if (layer.transform) {
            newT.position = {
                x: layer.transform.position.x * scaleX,
                y: layer.transform.position.y * scaleY
            };
            newT.size = {
                width: layer.transform.size.width * scaleX,
                height: layer.transform.size.height * scaleY
            };
        }
        return { ...layer, transform: newT };
    });

    store.setState({
        canvas: { ...state.canvas, width: w, height: h },
        layers: newLayers
    });
};

// Modify init to export helper needed by sidebar?
window.unitConverters = { toUnit, toPx, PPI };

// Start
init();

// Export Helper
// Export Helper
function exportJson() {
    exportProject();
}


