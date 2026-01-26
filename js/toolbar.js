import store, { LAYER_TYPES } from './state.js';
import { debounce, deepClone, generateId, createScrubInput, showTooltip } from './utils.js';
import { FONT_LIBRARY } from './fonts.js';
import { alignLayers, distributeLayers, groupLayers, ungroupLayers, moveLayer, duplicateLayer, deleteLayer } from './layerActions.js';
import { openColorPicker } from './colorPicker.js';

const toolbar = document.getElementById('floating-toolbar');
const canvasContainer = document.getElementById('canvas-container');

export function initToolbar() {
    // Initial check
    updateToolbar();
    store.subscribe(() => requestAnimationFrame(updateToolbar));
}

/**
 * Update Toolbar Visibility & Content
 */
export function updateToolbar() {
    const state = store.get();
    const selectedIds = state.editor.selectedLayerIds;

    if (selectedIds.length === 0) {
        toolbar.classList.add('opacity-0', 'pointer-events-none');
        return;
    }

    // Handle Multi-Select (Different UI)
    if (selectedIds.length > 1) {
        renderMultiSelectToolbar(selectedIds);
        // Show
        toolbar.classList.remove('opacity-0', 'translate-y-2', 'pointer-events-none');
        toolbar.style.top = '';
        toolbar.style.left = '';
        toolbar.style.transform = '';
        toolbar.style.display = 'flex';
        return;
    }

    const layer = state.layers.find(l => l.id === selectedIds[0]);
    if (!layer) {
        toolbar.classList.add('opacity-0', 'pointer-events-none');
        return;
    }

    // Render content based on type
    renderToolbarContent(layer);

    // Calculate Position (Dynamic) - DISABLED
    // The toolbar is now statically positioned via CSS in index.html (at the top center)
    // updateToolbarPosition(layer); 

    // Show
    toolbar.classList.remove('opacity-0', 'translate-y-2', 'pointer-events-none');

    // Clear manual positioning styles to let CSS take over
    toolbar.style.top = '';
    toolbar.style.left = '';
    toolbar.style.transform = '';

    // Ensure display is not none
    toolbar.style.display = 'flex';
}

// Function removed as we want static positioning
// function updateToolbarPosition(layer) { ... }

function renderToolbarContent(layer) {
    toolbar.innerHTML = '';
    // Remove inline bg to allow classes to work
    toolbar.style.backgroundColor = '';
    // Added bg-white dark:bg-[#2C2C2E] dark:border-white/10
    // Reduced padding and gap
    toolbar.className = 'flex items-center gap-2 rounded-xl shadow-xl border border-gray-200 bg-white dark:bg-[#2C2C2E] dark:border-white/10 p-1.5 transition-all duration-200 z-[50] max-w-[90vw] overflow-x-auto pointer-events-auto scrollbar-hide';

    // --- TRANSFORM CONTROLS (Common) ---
    // User request: No W/H. Only Rotation?
    // --- TRANSFORM CONTROLS (Common) ---
    // User request: No W/H. Only Rotation?
    if (layer.type !== LAYER_TYPES.BACKGROUND && !layer.locked) {
        const transformGroup = document.createElement('div');
        // Reduced gap and padding
        transformGroup.className = 'flex items-center gap-2 pr-2 border-r border-gray-200 dark:border-white/10';

        // Rotation
        transformGroup.appendChild(createScrubInput('ph-arrow-clockwise', 'Rotation', layer.transform.rotation, 1, (v) => {
            store.updateLayer(layer.id, { transform: { ...layer.transform, rotation: v } });
        }));

        toolbar.appendChild(transformGroup);
    }


    // --- TYPE SPECIFIC CONTROLS ---

    if (!layer.locked) {
        if (layer.type === LAYER_TYPES.TEXT) {
            renderTextControls(layer);
            renderStrokeControls(layer); // Add stroke controls
        } else if (layer.type === LAYER_TYPES.IMAGE) {
            renderImageControls(layer);
            renderStrokeControls(layer); // Add stroke controls
        } else if (layer.type === LAYER_TYPES.SVG) {
            renderFillControls(layer);
            renderStrokeControls(layer); // Add stroke controls
        } else if (layer.type === LAYER_TYPES.BACKGROUND) {
            renderFillControls(layer);
        }
    } else {
        // Locked State Message?
        const msg = document.createElement('div');
        msg.className = 'px-2 text-xs font-semibold text-gray-500 flex items-center gap-2';
        msg.innerHTML = '<i class="ph ph-lock-key text-amber-500"></i> Locked';
        toolbar.appendChild(msg);
    }

    // --- COMMON ACTIONS (Right Side) ---
    // --- COMMON ACTIONS (Right Side) ---
    if (layer.type !== LAYER_TYPES.BACKGROUND) {
        const actionsGroup = document.createElement('div');
        // Reduced gap and padding
        actionsGroup.className = 'flex items-center gap-1 pl-2 border-l border-gray-200 dark:border-white/10 ml-auto';

        if (!layer.locked) {

            // UnGroup Option if Group
            if (layer.type === LAYER_TYPES.GROUP) {
                const ungroupBtn = createIconButton('ph-exclude', 'Ungroup', () => ungroupLayers());
                actionsGroup.appendChild(ungroupBtn);
            }

            // Duplicate
            const dupBtn = createIconButton('ph-copy', 'Duplicate', () => duplicateLayer(layer));
            actionsGroup.appendChild(dupBtn);

            // Delete
            const delBtn = createIconButton('ph-trash', 'Delete', () => deleteLayer(layer.id), true);
            actionsGroup.appendChild(delBtn);

            // Layer Order
            const upBtn = createIconButton('ph-arrow-fat-up', 'Bring Forward', () => moveLayer(layer.id, 1));
            const downBtn = createIconButton('ph-arrow-fat-down', 'Send Backward', () => moveLayer(layer.id, -1));
            actionsGroup.appendChild(downBtn);
            actionsGroup.appendChild(upBtn);
        }

        // Lock Toggle (Always Available)
        const lockBtn = createIconButton(layer.locked ? 'ph-lock-key-open' : 'ph-lock-key', layer.locked ? 'Unlock' : 'Lock', () => {
            store.updateLayer(layer.id, { locked: !layer.locked });
        });
        if (layer.locked) {
            lockBtn.classList.add('text-amber-500', 'bg-amber-50', 'hover:bg-amber-100');
            lockBtn.classList.remove('text-gray-500');
        }
        actionsGroup.appendChild(lockBtn);

        toolbar.appendChild(actionsGroup);
    }
}

function renderMultiSelectToolbar(selectedIds) {
    toolbar.innerHTML = '';
    toolbar.style.backgroundColor = '';
    toolbar.className = 'flex items-center gap-2 rounded-xl shadow-xl border border-gray-200 bg-white dark:bg-[#2C2C2E] dark:border-white/10 p-1.5 transition-all duration-200 z-[50] max-w-[90vw] overflow-x-auto pointer-events-auto';

    const countMsg = document.createElement('div');
    countMsg.className = 'px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 select-none border-r border-gray-200 dark:border-white/10 pr-2';
    countMsg.textContent = `${selectedIds.length} Selected`;
    toolbar.appendChild(countMsg);

    // Alignment
    const alignGroup = document.createElement('div');
    alignGroup.className = 'flex items-center gap-1 border-r border-gray-200 dark:border-white/10 pr-2';

    // Icons for alignment
    const aligns = [
        { type: 'left', icon: 'ph-align-left' },
        { type: 'center', icon: 'ph-align-center-horizontal' },
        { type: 'right', icon: 'ph-align-right' },
        { type: 'top', icon: 'ph-align-top' },
        { type: 'middle', icon: 'ph-align-center-vertical' }, // "middle" usually means vertical center
        { type: 'bottom', icon: 'ph-align-bottom' },
    ];

    aligns.forEach(a => {
        const btn = createIconButton(a.icon, `Align ${a.type}`, () => alignLayers(a.type));
        alignGroup.appendChild(btn);
    });
    toolbar.appendChild(alignGroup);

    // Distribution (Always show, disable if < 3)
    const distGroup = document.createElement('div');
    distGroup.className = 'flex items-center gap-1 border-r border-gray-200 dark:border-white/10 pr-2';

    // Check if enough items
    const canDistribute = selectedIds.length >= 3;
    const baseClass = canDistribute ? '' : 'opacity-40 cursor-not-allowed';

    const btn1 = createIconButton('ph-distribute-horizontal', 'Distribute Centers (H)', () => canDistribute && distributeLayers('horizontal'));
    if (!canDistribute) btn1.style.pointerEvents = 'none';
    btn1.className += ` ${baseClass}`;
    distGroup.appendChild(btn1);

    const btn2 = createIconButton('ph-distribute-vertical', 'Distribute Centers (V)', () => canDistribute && distributeLayers('vertical'));
    if (!canDistribute) btn2.style.pointerEvents = 'none';
    btn2.className += ` ${baseClass}`;
    distGroup.appendChild(btn2);

    const btn3 = createIconButton('ph-arrows-left-right', 'Distribute Spacing (H)', () => canDistribute && distributeLayers('horizontal-spacing'));
    if (!canDistribute) btn3.style.pointerEvents = 'none';
    btn3.className += ` ${baseClass}`;
    distGroup.appendChild(btn3);

    const btn4 = createIconButton('ph-arrows-vertical', 'Distribute Spacing (V)', () => canDistribute && distributeLayers('vertical-spacing'));
    if (!canDistribute) btn4.style.pointerEvents = 'none';
    btn4.className += ` ${baseClass}`;
    distGroup.appendChild(btn4);

    toolbar.appendChild(distGroup);

    // Grouping
    const groupContainer = document.createElement('div');
    groupContainer.className = 'flex items-center gap-1';

    groupContainer.appendChild(createIconButton('ph-selection-plus', 'Group Selection', () => groupLayers()));

    // Delete
    const delBtn = createIconButton('ph-trash', 'Delete', () => {
        selectedIds.forEach(id => deleteLayer(id));
    }, true);
    groupContainer.appendChild(delBtn);

    toolbar.appendChild(groupContainer);
}

function renderTextControls(layer) {
    const content = layer.content;
    const firstLine = content.lines[0];

    // Font Family Picker
    const fontGroup = document.createElement('div');
    // Reduced gap and padding
    fontGroup.className = 'flex items-center gap-2 pr-2 border-r border-gray-200 dark:border-white/10';

    // Create Font Picker (Button -> Popover)
    // We reuse logic but adapt for horizontal bar (Popover opens down)
    const pickerId = generateId('font-picker');
    const pickerBtn = document.createElement('button');
    // Reduced padding, font size, min-width
    pickerBtn.className = 'flex items-center gap-1.5 px-2 py-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md text-xs font-medium text-gray-700 dark:text-gray-200 min-w-[100px] justify-between transition-colors border border-gray-200 dark:border-white/10';

    const currentFamily = firstLine.font || 'Inter';
    pickerBtn.innerHTML = `
        <span class="truncate max-w-[120px]" style="font-family: '${currentFamily}', sans-serif">${currentFamily}</span>
        <i class="ph ph-caret-down text-xs text-gray-400"></i>
    `;

    // Popover Logic (Simple toggle)
    pickerBtn.onclick = (e) => {
        e.stopPropagation();
        toggleFontPopover(pickerBtn, layer);
    };

    fontGroup.appendChild(pickerBtn);

    // Font Size (Redesigned with +/- buttons)
    const fontSizeContainer = document.createElement('div');
    fontSizeContainer.className = 'flex items-center gap-0.5 border border-gray-200 dark:border-white/10 rounded-md bg-white dark:bg-white/5';

    const updateFontSize = (v) => {
        const newSize = Math.max(1, v);
        const newLines = content.lines.map(l => ({ ...l, fontSize: newSize }));
        store.updateLayer(layer.id, { content: { ...content, lines: newLines } });
        fontInput.value = newSize;
    };

    // Decrease button
    const decBtn = createIconButton('ph-minus', 'Decrease Size', () => updateFontSize(firstLine.fontSize - 1));
    // Reduced size w-6 h-6
    decBtn.className = 'w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-white/10 rounded-l-md transition-colors';

    // Input field
    const fontInput = document.createElement('input');
    fontInput.type = 'number';
    fontInput.value = firstLine.fontSize;
    fontInput.className = 'w-8 text-center text-xs font-medium bg-transparent focus:outline-none tabular-nums border-none p-0 appearance-none';
    fontInput.onchange = (e) => updateFontSize(parseInt(e.target.value) || firstLine.fontSize);
    fontInput.onkeydown = (e) => { if (e.key === 'Enter') fontInput.blur(); };

    // Increase button
    const incBtn = createIconButton('ph-plus', 'Increase Size', () => updateFontSize(firstLine.fontSize + 1));
    // Reduced size w-6 h-6
    incBtn.className = 'w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-white/10 rounded-r-md transition-colors';

    fontSizeContainer.appendChild(decBtn);
    fontSizeContainer.appendChild(fontInput);
    fontSizeContainer.appendChild(incBtn);
    fontGroup.appendChild(fontSizeContainer);

    // Color
    fontGroup.appendChild(createColorPickerButton(firstLine.color, (val) => {
        const newLines = content.lines.map(l => ({ ...l, color: val }));
        store.updateLayer(layer.id, { content: { ...content, lines: newLines } });
    }));

    toolbar.appendChild(fontGroup);

    // Style Group
    const styleGroup = document.createElement('div');
    // Reduced gap
    styleGroup.className = 'flex items-center gap-1';

    // Bold
    styleGroup.appendChild(createToggleInfo('ph-text-b', firstLine.bold, () => {
        const newLines = content.lines.map(l => ({ ...l, bold: !l.bold }));
        store.updateLayer(layer.id, { content: { ...content, lines: newLines } });
    }, 'Bold'));

    // Italic
    styleGroup.appendChild(createToggleInfo('ph-text-italic', firstLine.italic, () => {
        const newLines = content.lines.map(l => ({ ...l, italic: !l.italic }));
        store.updateLayer(layer.id, { content: { ...content, lines: newLines } });
    }, 'Italic'));

    // Align (Compact: Cycle or Dropdown? Let's do Cycle for space)
    const alignIcons = { left: 'ph-text-align-left', center: 'ph-text-align-center', right: 'ph-text-align-right' };
    const nextAlign = { left: 'center', center: 'right', right: 'left' };

    const alignBtn = createIconButton(alignIcons[content.align || 'left'], `Align ${content.align}`, () => {
        store.updateLayer(layer.id, { content: { ...content, align: nextAlign[content.align || 'left'] } });
    });
    styleGroup.appendChild(alignBtn);

    // Uppercase
    styleGroup.appendChild(createToggleInfo('ph-text-aa', content.capitalize, () => {
        store.updateLayer(layer.id, { content: { ...content, capitalize: !content.capitalize } });
    }, 'Uppercase'));

    toolbar.appendChild(styleGroup);
}

function renderImageControls(layer) {
    const group = document.createElement('div');
    // Reduced gap and padding
    group.className = 'flex items-center gap-2 pr-2 border-r border-gray-200 dark:border-white/10';

    // Opacity
    group.appendChild(createScrubInput('ph-drop', 'Opacity', layer.opacity !== undefined ? layer.opacity : 1, 0.05, (v) => {
        store.updateLayer(layer.id, { opacity: Math.max(0, Math.min(1, v)) });
    }));

    // Replace Button
    const fileLabel = document.createElement('label');
    // Reduced padding
    fileLabel.className = 'cursor-pointer flex items-center gap-1.5 px-2 py-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md text-xs font-medium text-gray-700 dark:text-gray-200 transition-colors border border-gray-200 dark:border-white/10';
    fileLabel.innerHTML = '<i class="ph ph-swap"></i> Replace';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.className = 'hidden';
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const src = ev.target.result;
            // Just update src, keep dimensions? Or reset? Usually keep frame unless ratio changes drastically.
            store.updateLayer(layer.id, { content: { ...layer.content, src } });
        };
        reader.readAsDataURL(file);
    };
    fileLabel.appendChild(fileInput);
    group.appendChild(fileLabel);

    toolbar.appendChild(group);
}

function renderFillControls(layer) {
    const group = document.createElement('div');
    // Reduced gap and padding
    group.className = 'flex items-center gap-2 pr-2 border-r border-gray-200 dark:border-white/10';

    // Opacity
    group.appendChild(createScrubInput('ph-drop', 'Opacity', layer.opacity !== undefined ? layer.opacity : 1, 0.05, (v) => {
        store.updateLayer(layer.id, { opacity: Math.max(0, Math.min(1, v)) });
    }));

    // Fill Color
    const fill = layer.style && layer.style.fill ? layer.style.fill : (layer.content.fill || { colors: ['#ffffff'] });
    const currentColor = layer.content.color || fill.colors[0] || '#ffffff';

    group.appendChild(createColorPickerButton(currentColor, (val) => {
        const newFill = { ...fill, colors: [val] };
        let updates = {};
        if (layer.type === LAYER_TYPES.SVG) {
            updates = {
                content: { ...layer.content, color: val },
                style: { ...layer.style, fill: newFill }
            };
        } else {
            updates = { style: { ...layer.style, fill: newFill } };
            if (layer.content.type === 'background') {
                updates.content = { ...layer.content, fill: newFill };
            }
        }
        store.updateLayer(layer.id, updates);
    }));

    toolbar.appendChild(group);
}

// --- HELPERS ---

function createIconButton(iconClass, tooltip, onClick, isDanger = false) {
    const btn = document.createElement('button');
    // Reduced padding and text size
    btn.className = `p-1 rounded-md text-base transition-colors flex items-center justify-center ${isDanger ? 'text-gray-400 hover:text-red-500 hover:bg-red-50' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-black/5 dark:hover:bg-white/10'}`;
    btn.innerHTML = `<i class="ph ${iconClass}"></i>`;
    showTooltip(btn, tooltip);
    btn.onclick = (e) => {
        e.stopPropagation();
        onClick();
    };
    return btn;
}

function createToggleInfo(icon, active, onClick, tooltip) {
    const btn = document.createElement('button');
    // Reduced size w-6 h-6
    btn.className = `w-6 h-6 flex items-center justify-center rounded-md text-base transition-all ${active ? 'bg-blue-50 text-blue-500 dark:bg-blue-500/10 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10'}`;
    btn.innerHTML = `<i class="ph ${icon}"></i>`;
    showTooltip(btn, tooltip);
    btn.onclick = (e) => {
        e.stopPropagation();
        onClick();
    };
    return btn;
}

function createColorPickerButton(color, onChange) {
    const wrapper = document.createElement('div');
    // Change rounded-full to rounded-md (or just 'rounded')
    wrapper.className = 'w-6 h-6 rounded-md border border-gray-200 dark:border-white/10 cursor-pointer shadow-sm relative overflow-hidden transition-transform active:scale-95';
    wrapper.style.backgroundColor = color;
    showTooltip(wrapper, 'Color');

    wrapper.onclick = (e) => {
        e.stopPropagation();
        openColorPicker(wrapper, color, (newColor) => {
            wrapper.style.backgroundColor = newColor;
            onChange(newColor);
        });
    };

    return wrapper;
}


// --- Font Popover Logic ---
// We'll create a single singleton popover for fonts to avoid DOM spam, or recreate.
// Recreating is fine for this scale.

let activePopover = null;

function toggleFontPopover(triggerBtn, layer) {
    // Existing popover?
    const existing = document.getElementById('font-popover');
    if (existing) {
        existing.remove();
        if (activePopover === triggerBtn) {
            activePopover = null;
            return; // Toggle off
        }
    }

    activePopover = triggerBtn;

    // Create Popover
    const popover = document.createElement('div');
    popover.id = 'font-popover';
    popover.className = 'fixed bg-white dark:bg-[#2C2C2E] rounded-xl shadow-2xl border border-gray-100 dark:border-white/10 z-[100] flex flex-col w-64 max-h-[300px] animate-in fade-in zoom-in-95 duration-100';

    // Position
    const rect = triggerBtn.getBoundingClientRect();
    popover.style.top = `${rect.bottom + 8}px`;
    popover.style.left = `${Math.max(10, rect.left)}px`; // Keep somewhat on screen

    // Prevent scrolling canvas when scrolling popover
    popover.addEventListener('wheel', (e) => e.stopPropagation(), { passive: false });

    // Click outside to close (setup early but safer in timeout)
    const cleanup = (e) => {
        if (!popover.contains(e.target) && !triggerBtn.contains(e.target)) {
            popover.remove();
            activePopover = null;
            document.removeEventListener('click', cleanup);
        }
    };
    setTimeout(() => document.addEventListener('click', cleanup), 10);

    // State
    let activeCategory = 'All';
    const categories = ['All', 'Sans Serif', 'Serif', 'Display', 'Handwriting', 'Monospace'];

    // Content (copied/adapted from sidebar logic)
    // Search
    const searchContainer = document.createElement('div');
    searchContainer.className = 'p-2 border-b border-gray-100 dark:border-white/10 bg-white/95 dark:bg-[#1E1E1E]/95 backdrop-blur-sm rounded-t-xl sticky top-0 z-20 flex flex-col gap-2';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'w-full bg-gray-100 dark:bg-[#3A3A3C] rounded-lg px-2 py-1.5 text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500';
    searchInput.placeholder = 'Search fonts...';
    searchContainer.appendChild(searchInput);

    // Tabs
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'flex items-center gap-1 overflow-x-auto no-scrollbar pb-1';

    function renderTabs() {
        tabsContainer.innerHTML = '';
        categories.forEach(cat => {
            const btn = document.createElement('button');
            const isActive = activeCategory === cat;
            btn.className = `px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors flex-shrink-0 border ${isActive ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 border-transparent hover:bg-gray-200 dark:hover:bg-white/20'}`;
            btn.textContent = cat;
            btn.onclick = (e) => {
                e.stopPropagation();
                activeCategory = cat;
                renderTabs();
                renderList(searchInput.value);
            };
            tabsContainer.appendChild(btn);
        });
    }
    renderTabs();
    searchContainer.appendChild(tabsContainer);

    popover.appendChild(searchContainer);

    // List
    const listContainer = document.createElement('div');
    listContainer.className = 'flex-1 overflow-y-auto p-1 custom-scrollbar';

    // Stop scroll propagation on list container specifically too
    listContainer.addEventListener('wheel', (e) => e.stopPropagation(), { passive: false });

    const renderList = (term) => {
        listContainer.innerHTML = '';
        const lowerTerm = term.toLowerCase();

        const filtered = FONT_LIBRARY.filter(f => {
            const matchesSearch = f.name.toLowerCase().includes(lowerTerm);
            const matchesCat = activeCategory === 'All' || f.category === activeCategory;
            return matchesSearch && matchesCat;
        });

        if (filtered.length === 0) {
            listContainer.innerHTML = '<div class="p-3 text-center text-xs text-gray-400 dark:text-gray-500">No fonts found.</div>';
            return;
        }

        // Render Flat List (no headers)
        filtered.slice(0, 100).forEach(font => {
            const item = document.createElement('div');
            const isSelected = layer.content.lines[0].font === font.name;
            item.className = `flex items-center justify-between px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg cursor-pointer transition-colors mb-0.5 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`;

            const span = document.createElement('span');
            span.textContent = font.name;
            // Preview Font
            span.style.fontFamily = `"${font.name}", sans-serif`;
            span.className = `text-sm ${isSelected ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-gray-700 dark:text-gray-200'}`;

            item.appendChild(span);
            item.onclick = (e) => {
                e.stopPropagation();
                // Update Layer
                const content = layer.content;
                const newLines = content.lines.map(l => ({ ...l, font: font.name }));
                store.updateLayer(layer.id, { content: { ...content, lines: newLines } });

                // Update Trigger Label
                triggerBtn.querySelector('span').textContent = font.name;
                triggerBtn.querySelector('span').style.fontFamily = `"${font.name}", sans-serif`;

                popover.remove();
                activePopover = null;
                document.removeEventListener('click', cleanup);
            };
            listContainer.appendChild(item);
        });
    };

    renderList('');
    searchInput.oninput = (e) => renderList(e.target.value);

    popover.appendChild(listContainer);
    document.body.appendChild(popover);

    // Click outside to close
    // (Duplicate cleanup removed)
}


// --- Actions ---
// Imported from layerActions.js

function renderStrokeControls(layer) {
    const group = document.createElement('div');
    group.className = 'flex items-center gap-2 pr-2 border-r border-gray-200 dark:border-white/10';

    // Get current stroke state or default
    const stroke = (layer.style && layer.style.stroke) ? layer.style.stroke : { enabled: false, color: '#000000', width: 2 };

    // Create Trigger Button (replacing old controls)
    const triggerBtn = document.createElement('button');
    // Compact trigger, removed border classes
    triggerBtn.className = `flex items-center gap-1.5 px-2 py-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md text-xs font-medium transition-colors ${stroke.enabled ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200'}`;

    // Add tooltip
    showTooltip(triggerBtn, 'Stroke');

    // Icon and Label
    let innerHTML = `<i class="ph ph-circle text-sm"></i>`;

    // Add color indicator if enabled
    if (stroke.enabled) {
        innerHTML += `<div class="w-2 h-2 rounded-full border border-black/10" style="background-color: ${stroke.color}"></div>`;
        innerHTML += `<span>${stroke.width}px</span>`;
    }
    // Removed "Stroke" label for disabled state as requested by user

    // Removed caret icon as requested

    triggerBtn.innerHTML = innerHTML;

    triggerBtn.onclick = (e) => {
        e.stopPropagation();
        toggleStrokePopover(triggerBtn, layer);
    };

    group.appendChild(triggerBtn);
    toolbar.appendChild(group);
}

function toggleStrokePopover(triggerBtn, layer) {
    // 1. Close existing if any
    const existing = document.getElementById('stroke-popover');
    if (existing) {
        existing.remove();
        if (activePopover === triggerBtn) {
            activePopover = null;
            return; // Toggle off
        }
    }

    // Close other popovers (font, etc)
    if (activePopover && activePopover !== triggerBtn) {
        const fontPop = document.getElementById('font-popover');
        if (fontPop) fontPop.remove();
        // remove any other generic popovers
    }

    activePopover = triggerBtn;

    // 2. Create Popover
    const popover = document.createElement('div');
    popover.id = 'stroke-popover';
    popover.className = 'fixed bg-white dark:bg-[#2C2C2E] rounded-xl shadow-2xl border border-gray-100 dark:border-white/10 z-[100] flex flex-col w-56 p-3 animate-in fade-in zoom-in-95 duration-100 gap-3';

    // 3. Position
    const rect = triggerBtn.getBoundingClientRect();
    popover.style.top = `${rect.bottom + 8}px`;
    popover.style.left = `${Math.max(10, rect.left)}px`;

    // 4. Content
    const stroke = (layer.style && layer.style.stroke) ? layer.style.stroke : { enabled: false, color: '#000000', width: 2 };

    // Header: Toggle
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between pb-2 border-b border-gray-100 dark:border-white/10';

    const label = document.createElement('span');
    label.className = 'text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider';
    label.textContent = 'Stroke';
    header.appendChild(label);

    const toggleWrapper = document.createElement('div');
    toggleWrapper.className = 'flex items-center gap-2';

    // Toggle Switch (styled checkbox)
    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'relative inline-flex items-center cursor-pointer';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = stroke.enabled;
    checkbox.className = 'sr-only peer';
    checkbox.onchange = (e) => {
        const enabled = e.target.checked;
        const newStroke = { ...stroke, enabled };
        const style = layer.style || {};
        store.updateLayer(layer.id, { style: { ...style, stroke: newStroke } });
        // Rerender popover content? Or just keep it open?
        // Ideally we update the controls below.
        updateControlsState(enabled);
        updateTrigger();
    };

    const slider = document.createElement('div');
    slider.className = 'w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-[#3A3A3C] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[""] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500';

    toggleLabel.appendChild(checkbox);
    toggleLabel.appendChild(slider);
    toggleWrapper.appendChild(toggleLabel);
    header.appendChild(toggleWrapper);

    popover.appendChild(header);

    // Controls Container
    const controls = document.createElement('div');
    controls.className = 'flex flex-col gap-3 pt-1 transition-opacity duration-200';

    // Helper to update disabled state
    const updateControlsState = (enabled) => {
        if (enabled) {
            controls.classList.remove('opacity-50', 'pointer-events-none');
        } else {
            controls.classList.add('opacity-50', 'pointer-events-none');
        }
    };

    // Color Row
    const colorRow = document.createElement('div');
    colorRow.className = 'flex items-center justify-between';

    const colorLabel = document.createElement('span');
    colorLabel.className = 'text-xs text-gray-500 dark:text-gray-400 font-medium';
    colorLabel.textContent = 'Color';

    // We need a specific color picker trigger that works inside popover
    // createColorPickerButton creates a wrapper. existing code:
    // We need a color picker trigger that works inside popover
    // We reuse createColorPickerButton logic directly or via helper
    // We can reuse it, but need to make sure openColorPicker works fine on top of this popover.
    // openColorPicker usually creates another fixed element. It should be fine z-index wise (usually high).

    const colorBtn = createColorPickerButton(stroke.color, (val) => {
        const newStroke = { ...stroke, color: val, enabled: true }; // Enable if changing color?
        const style = layer.style || {};
        store.updateLayer(layer.id, { style: { ...style, stroke: newStroke } });
        updateTrigger();
    });

    colorRow.appendChild(colorLabel);
    colorRow.appendChild(colorBtn);
    controls.appendChild(colorRow);

    // Width Row
    const widthRow = document.createElement('div');
    widthRow.className = 'flex items-center justify-between';

    const widthLabel = document.createElement('span');
    widthLabel.className = 'text-xs text-gray-500 dark:text-gray-400 font-medium';
    widthLabel.textContent = 'Width';

    // Reuse createScrubInput?
    // It creates a row with label and input. We might want just the input part or slightly diff layout.
    // Let's create a custom small input for this context box.

    const widthInputContainer = document.createElement('div');
    widthInputContainer.className = 'flex items-center gap-2 bg-gray-100 dark:bg-[#3A3A3C] rounded-md px-2 py-1 w-20';

    const widthInput = document.createElement('input');
    widthInput.type = 'number';
    widthInput.min = '1';
    widthInput.value = stroke.width;
    widthInput.className = 'w-full bg-transparent text-xs font-mono text-right text-gray-900 dark:text-white border-none p-0 focus:outline-none appearance-none';

    const updateWidth = (val) => {
        const w = Math.max(1, parseInt(val) || 1);
        const newStroke = { ...stroke, width: w, enabled: true };
        const style = layer.style || {};
        store.updateLayer(layer.id, { style: { ...style, stroke: newStroke } });
        updateTrigger();
    };

    widthInput.onchange = (e) => updateWidth(e.target.value);

    // Label for unit
    const unitLabel = document.createElement('span');
    unitLabel.className = 'text-[10px] text-gray-400 font-medium';
    unitLabel.textContent = 'px';

    widthInputContainer.appendChild(widthInput);
    widthInputContainer.appendChild(unitLabel);

    widthRow.appendChild(widthLabel);
    widthRow.appendChild(widthInputContainer);
    controls.appendChild(widthRow);

    popover.appendChild(controls);

    // Initialize state
    updateControlsState(stroke.enabled);

    document.body.appendChild(popover);

    // Helpers
    function updateTrigger() {
        // Redraw toolbar content to reflect changes in trigger button (e.g. show color/width)
        // Since toolbar.js re-renders on requestAnimationFrame loop if state changes,
        // we just need to make sure state is updated (which we did).
        // However, standard re-render MIGHT remove our popover if it clears toolbar.innerHTML?
        // Wait, renderToolbarContent clears toolbar.innerHTML = ''.
        // If state updates, store.subscribe triggers updateToolbar().
        // If updateToolbar runs, it wipes toolbar.
        // So popover anchor (triggerBtn) disappears from DOM.
        // But popover itself is appended to document.body, so it stays.
        // However, activePopover logic references triggerBtn.

        // ISSUE: If toolbar re-renders, the `triggerBtn` element is destroyed and replaced by a new one.
        // `activePopover` still points to the OLD detached button.
        // Interaction might break or "Active" state visualization on styling might be lost.
        // But the popover is separate.

        // We probably don't need to manually update trigger text here because the main loop handles it.
    }

    // Click outside to close
    const cleanup = (e) => {
        if (!popover.contains(e.target) && !triggerBtn.contains(e.target)) {
            // Check if the new trigger button (after re-render) is clicked?
            // Since trigger re-renders, e.target will be the NEW trigger button if clicked.
            // But `triggerBtn` is the OLD one.
            // So this check `!triggerBtn.contains(e.target)` will be true (since target is new button).
            // Thus it will close.
            // But the new button's onclick will fire?
            // If onclick fires, it toggles.
            // If we close here, we might conflict.

            // To handle re-renders: relies on the fact that if we click OUTSIDE, we close.
            // If we click the toolbar (handled by stopPropagation usually), we might be fine.

            // Actually, if we click the *new* trigger button, this cleanup runs first?

            popover.remove();
            activePopover = null;
            document.removeEventListener('click', cleanup);
        }
    };
    // Delay to avoid immediate trigger
    setTimeout(() => document.addEventListener('click', cleanup), 10);
}

