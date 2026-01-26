import store from './state.js';
import { deepClone, generateId } from './utils.js';
import { showToast } from './toasts.js';


let clipboard = []; // Internal clipboard

export function initShortcuts() {
    window.addEventListener('keydown', handleKeyDown);
}

function handleKeyDown(e) {
    // Ignore if input/textarea is focused
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
    }

    const state = store.get();
    const selectedIds = state.editor.selectedLayerIds;

    if (selectedIds.length === 0 && ![' ', 'Escape'].includes(e.key)) return;

    switch (e.key) {
        case 'Delete':
        case 'Backspace':
            deleteSelectedLayers();
            break;

        case 'ArrowUp':
            e.preventDefault();
            nudgeLayers(0, -1, e.shiftKey ? 10 : 1);
            break;
        case 'ArrowDown':
            e.preventDefault();
            nudgeLayers(0, 1, e.shiftKey ? 10 : 1);
            break;
        case 'ArrowLeft':
            e.preventDefault();
            nudgeLayers(-1, 0, e.shiftKey ? 10 : 1);
            break;
        case 'ArrowRight':
            e.preventDefault();
            nudgeLayers(1, 0, e.shiftKey ? 10 : 1);
            break;

            if (e.metaKey || e.ctrlKey) {
                e.preventDefault();
                duplicateSelectedLayers();
            }
            break;

        case 'c':
            if (e.metaKey || e.ctrlKey) {
                e.preventDefault();
                copySelectedLayers();
            }
            break;

        case 'v':
            if (e.metaKey || e.ctrlKey) {
                e.preventDefault();
                pasteLayers();
            }
            break;

        case 'x':
            if (e.metaKey || e.ctrlKey) {
                e.preventDefault();
                cutSelectedLayers();
            }
            break;

        case 'z':
            if (e.metaKey || e.ctrlKey) {
                e.preventDefault();
                if (e.shiftKey) {
                    store.redo();
                } else {
                    store.undo();
                }
            }
            break;

        case 'y':
            if (e.metaKey || e.ctrlKey) {
                e.preventDefault();
                store.redo();
            }
            break;

        case 'Escape':
            // Deselect all
            store.setState({ editor: { ...state.editor, selectedLayerIds: [] } }, true, false);
            break;

        case ' ': // Spacebar for panning
            // Handled separately or here?
            // If here, we probably just set a 'panning' mode state.
            // But main panning logic often usually involves mouse drag.
            // We'll let the interactions module or main handle 'keydown' for space if complex.
            // For now, let's just use it to toggle cursor style maybe?
            break;
    }
}

function deleteSelectedLayers() {
    const state = store.get();
    const ids = state.editor.selectedLayerIds;
    if (ids.length === 0) return;

    // Check locked
    const layersToDelete = state.layers.filter(l => ids.includes(l.id) && !l.locked);

    if (layersToDelete.length === 0) return;

    const newLayers = state.layers.filter(l => !ids.includes(l.id)); // Actually remove all selected ignoring lock? No, respect lock.
    const keepLayers = state.layers.filter(l => !ids.includes(l.id) || l.locked);

    store.setState({
        layers: keepLayers,
        editor: { ...state.editor, selectedLayerIds: [] }
    });

    showToast(`Deleted ${ids.length - keepLayers.length + newLayers.length} layer(s)`);
    // Wait logic above is weird.
    // Correct:
    // keepLayers = layers that are NOT (In IDs AND Unlocked).
}

function nudgeLayers(dx, dy, multiplier) {
    const state = store.get();
    const ids = state.editor.selectedLayerIds;

    // Convert pixels (multiplier) to normalized?
    // We need canvas dimensions.
    const cw = state.canvas.width;
    const ch = state.canvas.height;

    const ndx = (dx * multiplier) / cw;
    const ndy = (dy * multiplier) / ch;

    ids.forEach(id => {
        const layer = state.layers.find(l => l.id === id);
        if (layer && !layer.locked) {
            store.updateLayer(id, {
                transform: {
                    ...layer.transform,
                    position: {
                        x: layer.transform.position.x + ndx,
                        y: layer.transform.position.y + ndy
                    }
                }
            });
        }
    });
}

function duplicateSelectedLayers() {
    const state = store.get();
    const ids = state.editor.selectedLayerIds;
    const newLayers = [];
    const newIds = [];

    ids.forEach(id => {
        const layer = state.layers.find(l => l.id === id);
        if (layer) {
            const copy = deepClone(layer);
            copy.id = generateId('layer');
            copy.name = `${layer.name} (Copy)`;
            copy.transform.position.x += 0.02; // slight offset
            copy.transform.position.y += 0.02;
            newLayers.push(copy);
            newIds.push(copy.id);
        }
    });

    store.setState({
        layers: [...state.layers, ...newLayers],
        editor: { ...state.editor, selectedLayerIds: [...newIds] }
    });

    showToast(`Duplicated ${newLayers.length} layer(s)`);
}

function copySelectedLayers() {
    const state = store.get();
    const ids = state.editor.selectedLayerIds;
    if (ids.length === 0) return;

    clipboard = []; // Clear
    ids.forEach(id => {
        const layer = state.layers.find(l => l.id === id);
        if (layer) {
            clipboard.push(deepClone(layer));
        }
    });

    showToast(`Copied ${clipboard.length} layer(s)`);
}

function pasteLayers() {
    if (clipboard.length === 0) return;

    const state = store.get();
    const newLayers = [];
    const newIds = [];

    // Calculate center offset for paste behavior? 
    // Or just simple offset +10, +10px (normalized)
    // 2% of canvas size is reasonable
    const offsetX = 0.02;
    const offsetY = 0.02;

    clipboard.forEach(template => {
        const copy = deepClone(template);
        copy.id = generateId('layer');
        copy.name = `${template.name} (Copy)`;

        // Offset
        copy.transform.position.x += offsetX;
        copy.transform.position.y += offsetY;

        // Ensure inside bounds? (Not strictly required, canvas allows overflow)

        newLayers.push(copy);
        newIds.push(copy.id);
    });

    store.setState({
        layers: [...state.layers, ...newLayers],
        editor: { ...state.editor, selectedLayerIds: newIds }
    });

    showToast(`Pasted ${newLayers.length} layer(s)`);
}

function cutSelectedLayers() {
    const state = store.get();
    const ids = state.editor.selectedLayerIds;
    if (ids.length === 0) return;

    // Copy first
    copySelectedLayers();

    // Then Delete
    deleteSelectedLayers();

    showToast(`Cut ${ids.length} layer(s)`);
}
