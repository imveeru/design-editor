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
    setupMainMenu(); // Add this
    setupExportImport();
    setupGoogleFonts();

    console.groupEnd();
}

/**
 * Main Menu Logic
 */
function setupMainMenu() {
    const btn = document.getElementById('main-menu-btn');
    const dropdown = document.getElementById('main-menu-dropdown');

    if (btn && dropdown) {
        // Toggle
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
        });

        // Close on click outside
        document.addEventListener('click', () => {
            dropdown.classList.add('hidden');
        });

        // Actions
        document.getElementById('menu-import')?.addEventListener('click', () => {
            document.getElementById('file-input')?.click();
            dropdown.classList.add('hidden');
        });

        document.getElementById('menu-clear')?.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear the canvas? Unsaved changes will be lost.')) {
                store.reset();
            }
            dropdown.classList.add('hidden');
        });

        // Undo / Redo
        document.getElementById('menu-undo')?.addEventListener('click', () => {
            store.undo();
            dropdown.classList.add('hidden');
        });

        document.getElementById('menu-redo')?.addEventListener('click', () => {
            store.redo();
            dropdown.classList.add('hidden');
        });

        // Controls Modal
        const controlsModal = document.getElementById('controls-modal');
        const closeControls = document.getElementById('close-controls');

        document.getElementById('menu-controls')?.addEventListener('click', () => {
            controlsModal.classList.remove('hidden');
            dropdown.classList.add('hidden');
        });

        closeControls?.addEventListener('click', () => {
            controlsModal.classList.add('hidden');
        });

        // Close on clicking background
        controlsModal?.addEventListener('click', (e) => {
            if (e.target === controlsModal) {
                controlsModal.classList.add('hidden');
            }
        });

        // Placeholders
        ['menu-settings'].forEach(id => {
            document.getElementById(id)?.addEventListener('click', () => {
                showToast('Feature coming soon!', 'info');
                dropdown.classList.add('hidden');
            });
        });
    }
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
    // ... (rest of loadFonts remains same, just ensuring context)
    // Actually I can skip replacing loadFonts if I just target `setupGoogleFonts` line for context.
    // But `replace_file_content` needs exact TargetContent.
    // I will use a larger block to be safe or careful selection.
    // Let's just insert setupMainMenu before setupGoogleFonts.

    // Scan layers for font families ...
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
// Global View Update Helper
function updateViewTransform() {
    const state = store.get();
    const { zoom, pan } = state.canvas;
    const container = document.getElementById('canvas-container');
    const label = document.getElementById('zoom-label');

    // Apply Transform: Translate only (Zoom is handled by canvas resolution now)
    container.style.transform = `translate(${pan.x}px, ${pan.y}px)`;

    // Trigger render to ensure resolution updates immediately (though store sub handles it)
    render();

    if (label) label.textContent = `${Math.round(zoom * 100)}%`;
}

// Global Zoom Setter
window.setZoom = (z) => {
    let currentZoom = Math.min(Math.max(z, 0.1), 5); // Clamping 10% to 500%
    store.setState({ canvas: { ...store.get().canvas, zoom: currentZoom } }, false);
    updateViewTransform();
};

// Global Pan Setter (exposed for interactions)
window.setPan = (x, y) => {
    const state = store.get();
    const zoom = state.canvas.zoom;
    const cW = state.canvas.width * zoom;
    const cH = state.canvas.height * zoom;

    const container = document.getElementById('workspace-area') || document.body;
    const vW = container.clientWidth;
    const vH = container.clientHeight;

    // Boundary Logic: Keep at least 100px visible
    const margin = 100;

    // Max X: Canvas left edge is at vW - margin (Almost out to right)
    const maxX = vW - margin;
    // Min X: Canvas right edge is at margin (Almost out to left)
    // Canvas Right Edge = panX + cW
    // panX + cW > margin => panX > margin - cW
    const minX = margin - cW;

    const maxY = vH - margin;
    const minY = margin - cH;

    // Clamp
    const clampedX = Math.min(Math.max(x, minX), maxX);
    const clampedY = Math.min(Math.max(y, minY), maxY);

    store.setState({
        canvas: { ...state.canvas, pan: { x: clampedX, y: clampedY } }
    });
    updateViewTransform();
};

store.subscribe(() => {
    // We could rely on this efficiently or just call updateViewTransform directly when needed.
    // Since we pass 'false' to save on frequent updates (drag/zoom), we might not trigger subs depending on logic.
    // But store.setState notifies by default unless we suppressed it?
    // In main.js, we passed false to persist, but notify is always called in setState.
    // So this subscription will keep UI in sync.
    // However, for high-frequency panning/zooming, avoiding React-like render loops is good.
    // We will call updateViewTransform directly in interactions for speed, but also here for other updates.
    updateViewTransform();
});

function setupZoomControls() {
    const zoomIn = document.getElementById('zoom-in');
    const zoomOut = document.getElementById('zoom-out');
    // zoom-label is inside zoom-value-btn now
    const label = document.getElementById('zoom-label');
    const valueBtn = document.getElementById('zoom-value-btn');

    // Drag Logic
    if (valueBtn) {
        let isDragging = false;
        let startX = 0;
        let startZoom = 1;

        valueBtn.style.cursor = 'ew-resize';

        valueBtn.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startZoom = store.get().canvas.zoom;
            document.body.style.cursor = 'ew-resize';
            e.preventDefault(); // Prevent text selection

            // Add global listeners
            window.addEventListener('mousemove', onDrag);
            window.addEventListener('mouseup', endDrag);
        });

        const onDrag = (e) => {
            if (!isDragging) return;
            const delta = e.clientX - startX;
            // 1px = 0.5% change?
            // startZoom is 0.1 to 5.
            // delta 100px -> +0.5 (50%)
            const sensitivity = 0.005;
            let newZoom = startZoom + delta * sensitivity;

            // Clamp
            newZoom = Math.min(Math.max(newZoom, 0.1), 2.5); // Max 250%

            window.setZoom(newZoom);
        };

        const endDrag = () => {
            isDragging = false;
            document.body.style.cursor = '';
            window.removeEventListener('mousemove', onDrag);
            window.removeEventListener('mouseup', endDrag);
        };
    }

    // Button Logic
    zoomIn?.addEventListener('click', () => window.setZoom(store.get().canvas.zoom + 0.1));
    zoomOut?.addEventListener('click', () => window.setZoom(store.get().canvas.zoom - 0.1));

    // Dropdown / Fit Logic (Legacy, check if elements exist)
    const zoomContainer = document.getElementById('zoom-container'); // Might not exist in new layout
    // ... rest of legacy logic if needed, or cleanup.
    // The previous implementation had a lot of dropdown logic. 
    // In the new layout, we don't have a dropdown, just buttons and drag.
    // So I will remove the old dropdown code if new layout doesn't use it.
    // Based on index.html update, there is no dropdown for zoom anymore.
}

// Preset Delay Logic
const presetTrigger = document.getElementById('preset-trigger');
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
// Scale State
let currentExportScale = 1;

/**
 * Share / Export Menu
 */
function setupExportImport() {
    // Share Dropdown
    const shareBtn = document.getElementById('share-menu-btn');
    const shareDropdown = document.getElementById('share-dropdown');

    if (shareBtn && shareDropdown) {
        // Toggle
        shareBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            shareDropdown.classList.toggle('hidden');
        });

        // Hide on outside click
        document.addEventListener('click', () => {
            shareDropdown.classList.add('hidden');
        });

        // Stop propagation inside dropdown to prevent closing when clicking buttons
        shareDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Handle Scale Selection
        const scaleBtns = shareDropdown.querySelectorAll('.scale-btn');

        function updateScaleVisuals() {
            scaleBtns.forEach(btn => {
                const s = parseInt(btn.dataset.scale);
                if (s === currentExportScale) {
                    btn.classList.add('bg-white', 'dark:bg-[#48484A]', 'shadow-sm', 'text-blue-500', 'font-bold');
                    btn.classList.remove('text-gray-500', 'dark:text-gray-400');
                } else {
                    btn.classList.remove('bg-white', 'dark:bg-[#48484A]', 'shadow-sm', 'text-blue-500', 'font-bold');
                    btn.classList.add('text-gray-500', 'dark:text-gray-400');
                }
            });
        }

        // Init Visuals
        updateScaleVisuals();

        scaleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                currentExportScale = parseInt(btn.dataset.scale);
                updateScaleVisuals();
            });
        });

        // Handle Format Selection (Triggers Export)
        shareDropdown.querySelectorAll('button[data-type]').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.getAttribute('data-type');
                if (type === 'json') {
                    exportJson();
                } else {
                    exportToImage(type, currentExportScale);
                }
                shareDropdown.classList.add('hidden');
            });
        });
    }

    // Import JSON (remains same)
    const fileInput = document.getElementById('file-input');

    // ... rest of import logic

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
    // Old ID 'import-btn' loop removed. Logic is in setupMainMenu now.

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
window.setCanvasSize = (targetW, targetH) => {
    // Preserve absolute pixel positions/sizes
    const state = store.get();
    const oldW = state.canvas.width;
    const oldH = state.canvas.height;

    // Ratios
    const scaleX = oldW / targetW;
    const scaleY = oldH / targetH;

    const newLayers = state.layers.map(layer => {
        // Special case: Backgrounds should always fill 100% of the canvas
        if (layer.type === LAYER_TYPES.BACKGROUND || (layer.content && layer.content.type === 'background')) {
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
        canvas: { ...state.canvas, width: targetW, height: targetH },
        layers: newLayers
    });
};

// Modify init to export helper needed by sidebar?
window.unitConverters = { toUnit, toPx, PPI };

// Start
init();

// Export Helper
function exportJson() {
    exportProject();
}

// End of main.js
