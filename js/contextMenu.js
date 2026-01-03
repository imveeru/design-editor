import store from './state.js';
import { deepClone, generateId } from './utils.js';

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
    // The selection logic usually runs on mousedown, so if we right click an object, 
    // we should ideally select it if not selected.
    // For now, assume user right-clicks the currently selected object or we just show menu for global actions if none.

    const state = store.get();
    if (state.editor.selectedLayerIds.length === 0) return; // Only show if something selected

    const { clientX, clientY } = e;

    contextMenu.style.left = `${clientX}px`;
    contextMenu.style.top = `${clientY}px`;

    // Dynamic Render to add icons
    contextMenu.innerHTML = `
        <button data-action="bring-front" class="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
            <i class="ph ph-arrow-fat-line-up"></i> Bring to Front
        </button>
        <button data-action="send-back" class="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
            <i class="ph ph-arrow-fat-line-down"></i> Send to Back
        </button>
        <div class="border-t border-gray-200 dark:border-gray-600 my-1"></div>
        <button data-action="duplicate" class="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
            <i class="ph ph-copy"></i> Duplicate
        </button>
        <button data-action="delete" class="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500 hover:text-red-600 flex items-center gap-2">
            <i class="ph ph-trash"></i> Delete
        </button>
    `;

    contextMenu.classList.remove('hidden');
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
    }

    hideContextMenus();
}


// --- Logic helpers (Duplicate of toolbar somewhat, should be shared but separate for now) ---

function moveToExtreme(id, direction) {
    let layers = [...store.get().layers];
    const index = layers.findIndex(l => l.id === id);
    if (index === -1) return;

    const [item] = layers.splice(index, 1);

    if (direction === 'front') {
        layers.push(item);
    } else {
        layers.unshift(item);
    }

    store.setState({ layers });
}

function duplicateLayer(layer) {
    const newLayer = deepClone(layer);
    newLayer.id = generateId('layer');
    newLayer.name = `${layer.name} (Copy)`;
    newLayer.transform.position.x += 0.05;
    newLayer.transform.position.y += 0.05;

    const currentLayers = store.get().layers;
    store.setState({
        layers: [...currentLayers, newLayer],
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
