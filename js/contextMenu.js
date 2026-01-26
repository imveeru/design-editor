import store, { LAYER_TYPES } from './state.js';
import { deepClone, generateId } from './utils.js';
import { groupLayers, ungroupLayers, alignLayers, distributeLayers, moveToExtreme, duplicateLayer, deleteLayer } from './layerActions.js';

const contextMenu = document.getElementById('context-menu');
const container = document.getElementById('canvas-container');

export function initContextMenu() {
    container.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', hideContextMenus);

    // Bind actions
    contextMenu.addEventListener('click', handleMenuAction);
}

function handleContextMenu(e) {
    e.preventDefault();

    // Check if we clicked on an object?
    const { clientX, clientY } = e;

    // Convert to Canvas Coords (Normalized)
    // Reuse logic from interactions or duplicate? 
    // Ideally import, but simple enough to replicate for robust loose coupling.
    const canvas = document.getElementById('main-canvas');
    const rect = canvas.getBoundingClientRect();

    // Check if click is inside canvas bounds
    if (clientX >= rect.left && clientX <= rect.right &&
        clientY >= rect.top && clientY <= rect.bottom) {

        const x = (clientX - rect.left) / rect.width;
        const y = (clientY - rect.top) / rect.height;

        // Find top-most layer at this point
        // Reuse isPointInLayer logic? It's inside interactions.js and not exported.
        // We really should export `isPointInLayer` from utils or interactions.
        // For now, let's just select if we are hovering a layer? 
        // Or access store's hoveredLayer check if we had one?
        // Let's rely on visual hit test or simple logic.

        // Let's implement a simple point check here or make one in utils.
        // Actually, importing `isPointInLayer` from interactions.js (if exported) is best.
        // If not exported, we face duplication.
        // Let's check if we can export it or move it to utils.
        // Since I cannot change multiple files in one go easily without complexity, 
        // I will duplicate the simple hit test logic here for reliability.

        const state = store.get();
        const layers = [...state.layers].reverse();
        let hitId = null;

        // Simple Hit Test (Duplicate from interactions.js)
        for (let layer of layers) {
            if (!layer.visible || layer.locked) continue; // Skip locked/hidden for selection? 
            // Actually Right Click on Locked should allow Unlock.
            if (!layer.visible) continue;

            // Transform Logic
            const cx = layer.transform.position.x;
            const cy = layer.transform.position.y;
            const w = layer.transform.size.width;
            const h = layer.transform.size.height;
            const rotation = layer.transform.rotation;

            // Point in rotated rect?
            // Convert X/Y back to pixels for aspect ratio correctness relative to canvas?
            // Nah, normalized space is fine if we scale properly.
            // Actually, the math in interactions.js uses pixels.
            const cw = canvas.width;
            const ch = canvas.height;

            const px = x * cw;
            const py = y * ch;
            const pcx = cx * cw;
            const pcy = cy * ch;
            const pw = w * cw;
            const ph = h * ch;

            const rad = -rotation * (Math.PI / 180);
            const runs = px - pcx;
            const rise = py - pcy;
            const rotX = runs * Math.cos(rad) - rise * Math.sin(rad);
            const rotY = runs * Math.sin(rad) + rise * Math.cos(rad);

            if (Math.abs(rotX) <= pw / 2 && Math.abs(rotY) <= ph / 2) {
                hitId = layer.id;
                break;
            }
        }

        if (hitId) {
            // If not already selected, select it
            if (!state.editor.selectedLayerIds.includes(hitId)) {
                store.setState({
                    editor: { ...state.editor, selectedLayerIds: [hitId] }
                });
            }
        } else {
            // Clicked on background/canvas empty space
            // Deselect?
            // Usually yes, or context menu for "Paste"?
            // Let's deselect to show global menu if we have one, or just clear.
            // store.setState({ editor: { ...state.editor, selectedLayerIds: [] } });
        }
    }

    // Refresh State after potential selection change
    const currentState = store.get();
    if (currentState.editor.selectedLayerIds.length === 0) return; // Only show if something selected

    // Dynamic Render to add icons
    const selectedIds = currentState.editor.selectedLayerIds;

    // Multi-Select Menu
    if (selectedIds.length > 1) {
        contextMenu.innerHTML = `
            <button data-action="group" class="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                <i class="ph ph-selection-plus"></i> Group Selection
            </button>
            <div class="border-t border-gray-200 dark:border-gray-600 my-1"></div>
            
            <div class="px-4 py-1 text-[10px] text-gray-400 font-bold uppercase tracking-wider">Align</div>
            <div class="flex px-3 pb-2 gap-1 justify-between text-gray-600 dark:text-gray-300">
                <button data-action="align-left" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors" title="Align Left"><i class="ph ph-align-left text-lg"></i></button>
                <button data-action="align-center" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors" title="Align Center"><i class="ph ph-align-center-horizontal text-lg"></i></button>
                <button data-action="align-right" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors" title="Align Right"><i class="ph ph-align-right text-lg"></i></button>
                <button data-action="align-top" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors" title="Align Top"><i class="ph ph-align-top text-lg"></i></button>
                <button data-action="align-middle" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors" title="Align Middle"><i class="ph ph-align-center-vertical text-lg"></i></button>
                <button data-action="align-bottom" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors" title="Align Bottom"><i class="ph ph-align-bottom text-lg"></i></button>
            </div>

            <div class="border-t border-gray-200 dark:border-gray-600 my-1"></div>
            <div class="px-4 py-1 text-[10px] text-gray-400 font-bold uppercase tracking-wider">Distribute</div>
            <div class="flex px-3 pb-2 gap-1 text-gray-600 dark:text-gray-300 ${selectedIds.length < 3 ? 'opacity-40 pointer-events-none' : ''}">
                <button data-action="distribute-h" class="flex-1 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex justify-center" title="Distribute Centers (H)">
                    <i class="ph ph-distribute-horizontal text-lg"></i>
                </button>
                <button data-action="distribute-v" class="flex-1 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex justify-center" title="Distribute Centers (V)">
                    <i class="ph ph-distribute-vertical text-lg"></i>
                </button>
                <button data-action="distribute-h-spacing" class="flex-1 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex justify-center" title="Distribute Spacing (H)">
                    <i class="ph ph-arrows-left-right text-lg"></i>
                </button>
                <button data-action="distribute-v-spacing" class="flex-1 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex justify-center" title="Distribute Spacing (V)">
                    <i class="ph ph-arrows-vertical text-lg"></i>
                </button>
            </div>

            <div class="border-t border-gray-200 dark:border-gray-600 my-1"></div>
            <button data-action="delete" class="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500 hover:text-red-600 flex items-center gap-2">
                <i class="ph ph-trash"></i> Delete
            </button>
        `;
    }
    else {
        // Single Selection
        const selectedId = selectedIds[0];
        const layer = currentState.layers.find(l => l.id === selectedId);

        if (layer && layer.locked) {
            contextMenu.innerHTML = `
                <button data-action="unlock" class="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-amber-500">
                    <i class="ph ph-lock-key-open"></i> Unlock
                </button>
            `;
        } else {
            let extraOptions = '';
            if (layer.type === LAYER_TYPES.GROUP) {
                extraOptions = `
                    <button data-action="ungroup" class="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                        <i class="ph ph-exclude"></i> Ungroup
                    </button>
                    <div class="border-t border-gray-200 dark:border-gray-600 my-1"></div>
                `;
            }

            contextMenu.innerHTML = `
                <button data-action="bring-front" class="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                    <i class="ph ph-arrow-fat-line-up"></i> Bring to Front
                </button>
                <button data-action="send-back" class="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                    <i class="ph ph-arrow-fat-line-down"></i> Send to Back
                </button>
                <div class="border-t border-gray-200 dark:border-gray-600 my-1"></div>
                ${extraOptions}
                <button data-action="duplicate" class="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                    <i class="ph ph-copy"></i> Duplicate
                </button>
                <button data-action="delete" class="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500 hover:text-red-600 flex items-center gap-2">
                    <i class="ph ph-trash"></i> Delete
                </button>
            `;
        }
    }

    // Now position and show
    // We use visibility to measure first
    contextMenu.style.visibility = 'hidden';
    contextMenu.classList.remove('hidden');

    const menuWidth = contextMenu.offsetWidth;
    const menuHeight = contextMenu.offsetHeight;
    const windowW = window.innerWidth;
    const windowH = window.innerHeight;

    let left = clientX;
    let top = clientY;

    // Constrain to Viewport
    if (left + menuWidth > windowW) {
        left = windowW - menuWidth - 10;
    }
    if (top + menuHeight > windowH) {
        top = windowH - menuHeight - 10;
    }

    contextMenu.style.left = `${left}px`;
    contextMenu.style.top = `${top}px`;
    contextMenu.style.visibility = '';
}

function hideContextMenus() {
    contextMenu.classList.add('hidden');
}

function handleMenuAction(e) {
    const action = e.target.getAttribute('data-action');
    if (!action) return;

    const state = store.get();
    const selectedId = state.editor.selectedLayerIds[0];
    if (!selectedId) return;

    const layer = state.layers.find(l => l.id === selectedId);

    switch (action) {
        case 'bring-front':
            moveToExtreme(selectedId, 'front');
            break;
        case 'send-back':
            moveToExtreme(selectedId, 'back');
            break;
        case 'duplicate':
            duplicateLayer(layer);
            break;
        case 'delete':
            deleteLayer(selectedId);
            break;
        case 'unlock':
            store.updateLayer(selectedId, { locked: false });
            break;
        case 'group':
            groupLayers();
            break;
        case 'ungroup':
            ungroupLayers();
            break;
        case 'align-left': alignLayers('left'); break;
        case 'align-center': alignLayers('center'); break;
        case 'align-right': alignLayers('right'); break;
        case 'align-top': alignLayers('top'); break;
        case 'align-middle': alignLayers('middle'); break;
        case 'align-bottom': alignLayers('bottom'); break;
        case 'distribute-h': distributeLayers('horizontal'); break;
        case 'distribute-v': distributeLayers('vertical'); break;
        case 'distribute-h-spacing': distributeLayers('horizontal-spacing'); break;
        case 'distribute-v-spacing': distributeLayers('vertical-spacing'); break;
    }

    if (action === 'delete') {
        // Handle multi-delete if present
        const ids = store.get().editor.selectedLayerIds;
        ids.forEach(id => deleteLayer(id));
    }

    hideContextMenus();
}


// --- Logic helpers ---
// Imported from layerActions.js

