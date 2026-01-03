
import store, { LAYER_TYPES } from './state.js';
import { debounce, deepClone, generateId } from './utils.js';

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

    if (selectedIds.length !== 1) {
        toolbar.classList.add('opacity-0', 'translate-y-2', 'pointer-events-none');
        toolbar.classList.remove('translate-y-0');
        return;
    }

    const layer = state.layers.find(l => l.id === selectedIds[0]);
    if (!layer || layer.locked) {
        toolbar.classList.add('opacity-0', 'translate-y-2', 'pointer-events-none');
        toolbar.classList.remove('translate-y-0');
        return;
    }

    // Render content based on type
    renderToolbarContent(layer);

    // Show
    // Show
    toolbar.classList.remove('opacity-0', 'translate-y-2', 'pointer-events-none');
    toolbar.classList.add('translate-y-0');
    // Ensure display is not none
    toolbar.style.display = 'flex';

    // Static Position: The toolbar is now in a flex container above the canvas.
    // We do NOT need to calculate top/left.
}

function renderToolbarContent(layer) {
    toolbar.innerHTML = '';

    // Common Actions
    const actions = [];

    // Type specific
    // Text Type Specific
    if (layer.type === LAYER_TYPES.TEXT) {
        const isBold = layer.content.lines[0]?.bold;
        actions.push({
            icon: '<i class="ph ph-text-b"></i>',
            title: 'Bold',
            active: isBold,
            action: () => toggleTextProp(layer, 'bold')
        });

        const isItalic = layer.content.lines[0]?.italic;
        actions.push({
            icon: '<i class="ph ph-text-italic"></i>',
            title: 'Italic',
            active: isItalic,
            action: () => toggleTextProp(layer, 'italic')
        });

        const isCaps = layer.content.capitalize;
        actions.push({
            icon: '<i class="ph ph-text-aa"></i>',
            title: 'Uppercase',
            active: isCaps,
            action: () => toggleTextProp(layer, 'capitalize')
        });
    }

    // Background/Shape Specific (Mock for now)
    if (layer.type === LAYER_TYPES.BACKGROUND) {
        // Maybe color picker trigger?
        // For now just allow Delete/Duplicate
    }

    // Image Specific
    if (layer.type === LAYER_TYPES.IMAGE) {
        // Replace image action?
    }

    // Layer Ordering
    actions.push({
        icon: '<i class="ph ph-arrow-fat-up"></i>',
        title: 'Bring Forward',
        action: () => moveLayer(layer.id, 1)
    });

    actions.push({
        icon: '<i class="ph ph-arrow-fat-down"></i>',
        title: 'Send Backward',
        action: () => moveLayer(layer.id, -1)
    });

    // Duplicate
    actions.push({
        icon: '<i class="ph ph-copy"></i>',
        title: 'Duplicate',
        action: () => duplicateLayer(layer)
    });

    // Delete
    actions.push({
        icon: '<i class="ph ph-trash"></i>',
        title: 'Delete',
        danger: true,
        action: () => deleteLayer(layer.id)
    });

    // Render Buttons
    actions.forEach(item => {
        const btn = document.createElement('button');
        btn.innerHTML = item.icon;

        // Minimal Ghost Button Style
        // Base: p-2 rounded-lg text-lg (for icon size) transition-colors
        // Inactive: text-gray-500 hover:text-gray-900 hover:bg-black/5
        // Active: bg-blue-500 text-white (or subtle blue tint)
        // Danger: text-red-500

        let classes = 'p-1.5 rounded-lg text-lg transition-colors flex items-center justify-center';

        if (item.active) {
            classes += ' bg-blue-500 text-white shadow-sm';
        } else if (item.danger) {
            classes += ' text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30';
        } else {
            classes += ' text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10';
        }

        btn.className = classes;

        // Global Tooltip
        if (window.showTooltip) {
            window.showTooltip(btn, item.title);
        } else {
            btn.title = item.title; // Fallback
        }

        btn.onclick = (e) => {
            e.stopPropagation(); // prevent interacting with canvas
            item.action();
        };
        toolbar.appendChild(btn);
    });
}

// Actions

function toggleTextProp(layer, prop) {
    const lines = layer.content.lines.map(l => ({ ...l, [prop]: !l[prop] }));
    store.updateLayer(layer.id, { content: { ...layer.content, lines } });
}

function moveLayer(id, delta) {
    const state = store.get();
    const layers = [...state.layers];
    const index = layers.findIndex(l => l.id === id);

    if (index === -1) return;

    const newIndex = index + delta;
    if (newIndex < 0 || newIndex >= layers.length) return;

    // Swap
    const temp = layers[newIndex];
    layers[newIndex] = layers[index];
    layers[index] = temp;

    store.setState({ layers });
}

function duplicateLayer(layer) {
    const newLayer = deepClone(layer);
    newLayer.id = generateId('layer');
    newLayer.name = `${layer.name} (Copy)`;

    // Offset slightly
    newLayer.transform.position.x += 0.05;
    newLayer.transform.position.y += 0.05;

    const startLayers = store.get().layers;
    store.setState({
        layers: [...startLayers, newLayer],
        editor: { ...store.get().editor, selectedLayerIds: [newLayer.id] }
    });
}

function deleteLayer(id) {
    const layers = store.get().layers.filter(l => l.id !== id);
    store.setState({
        layers,
        editor: { ...store.get().editor, selectedLayerIds: [] }
    });
}
