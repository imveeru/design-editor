import store, { LAYER_TYPES } from './state.js';
import { generateId, deepClone } from './utils.js';

/**
 * Group selected layers
 */
export function groupLayers() {
    const state = store.get();
    const selectedIds = state.editor.selectedLayerIds;

    if (selectedIds.length < 2) return;

    // Filter out background or locked layers if necessary? 
    // Usually we allow grouping anything except maybe background.
    const layers = state.layers.filter(l => selectedIds.includes(l.id) && l.type !== LAYER_TYPES.BACKGROUND);

    if (layers.length < 2) return;

    // 1. Calculate Bounding Box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    layers.forEach(l => {
        const t = l.transform;
        // Simple bounding box approximation (ignoring rotation for group container for now)
        // If we want tight bounds with rotation, it's complex. 
        // Standard behavior: Group Axis Aligned Bounding Box (AABB) of the selection.

        // Center to Top-Left
        const w = t.size.width;
        const h = t.size.height;
        const x = t.position.x - w / 2;
        const y = t.position.y - h / 2;

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);
    });

    const groupW = maxX - minX;
    const groupH = maxY - minY;
    const groupX = minX + groupW / 2;
    const groupY = minY + groupH / 2;

    // 2. Create Group Layer
    const groupLayer = {
        id: generateId('group'),
        name: 'Group',
        type: LAYER_TYPES.GROUP,
        visible: true,
        locked: false,
        opacity: 1,
        // Group transform is the AABB
        transform: {
            position: { x: groupX, y: groupY },
            size: { width: groupW, height: groupH },
            rotation: 0
        },
        content: {}, // No content
        children: layers.map(l => l.id) // Store Child IDs
    };

    // 3. Update Layers
    const allLayers = deepClone(state.layers);

    // Update children to have parentId
    allLayers.forEach(l => {
        if (selectedIds.includes(l.id)) {
            l.parentId = groupLayer.id;
        }
    });

    // Add Group Layer (Place it at the top of the stack of the topmost selected item? Or top of all?)
    // Usually groups sit where the topmost child was.
    // Find index of topmost selected layer
    let insertIndex = -1;
    allLayers.forEach((l, idx) => {
        if (selectedIds.includes(l.id)) insertIndex = idx;
    });

    if (insertIndex !== -1) {
        allLayers.splice(insertIndex + 1, 0, groupLayer);
    } else {
        allLayers.push(groupLayer);
    }

    store.setState({
        layers: allLayers,
        editor: { ...state.editor, selectedLayerIds: [groupLayer.id] }
    });
}

/**
 * Ungroup selected group
 */
export function ungroupLayers() {
    const state = store.get();
    const selectedId = state.editor.selectedLayerIds[0];
    if (!selectedId) return;

    const groupLayer = state.layers.find(l => l.id === selectedId);
    if (!groupLayer || groupLayer.type !== LAYER_TYPES.GROUP) return;

    const childIds = groupLayer.children || [];

    const allLayers = deepClone(state.layers);

    // Remove parentId from children
    allLayers.forEach(l => {
        if (childIds.includes(l.id)) {
            delete l.parentId;
        }
    });

    // Remove Group Layer
    const newLayers = allLayers.filter(l => l.id !== selectedId);

    store.setState({
        layers: newLayers,
        editor: { ...state.editor, selectedLayerIds: childIds }
    });
}

/**
 * Align Selected Layers
 * @param {string} type - 'left', 'center', 'right', 'top', 'middle', 'bottom'
 */
export function alignLayers(type) {
    const state = store.get();
    const selectedIds = state.editor.selectedLayerIds;
    if (selectedIds.length < 2) return;

    const layers = state.layers.filter(l => selectedIds.includes(l.id));

    // Calculate reference value
    let targetVal = 0;

    if (type === 'left') {
        // Min (X - W/2)
        targetVal = Math.min(...layers.map(l => l.transform.position.x - l.transform.size.width / 2));
    } else if (type === 'right') {
        // Max (X + W/2)
        targetVal = Math.max(...layers.map(l => l.transform.position.x + l.transform.size.width / 2));
    } else if (type === 'top') {
        // Min (Y - H/2)
        targetVal = Math.min(...layers.map(l => l.transform.position.y - l.transform.size.height / 2));
    } else if (type === 'bottom') {
        // Max (Y + H/2)
        targetVal = Math.max(...layers.map(l => l.transform.position.y + l.transform.size.height / 2));
    } else if (type === 'center') {
        // Average X
        // Actually usually Center of Selection Bounds
        const minX = Math.min(...layers.map(l => l.transform.position.x - l.transform.size.width / 2));
        const maxX = Math.max(...layers.map(l => l.transform.position.x + l.transform.size.width / 2));
        targetVal = minX + (maxX - minX) / 2;
    } else if (type === 'middle') {
        // Average Y
        const minY = Math.min(...layers.map(l => l.transform.position.y - l.transform.size.height / 2));
        const maxY = Math.max(...layers.map(l => l.transform.position.y + l.transform.size.height / 2));
        targetVal = minY + (maxY - minY) / 2;
    }

    const newLayers = deepClone(state.layers);
    const updates = {};

    layers.forEach(l => {
        let newX = l.transform.position.x;
        let newY = l.transform.position.y;
        const w = l.transform.size.width;
        const h = l.transform.size.height;

        if (type === 'left') newX = targetVal + w / 2;
        else if (type === 'right') newX = targetVal - w / 2;
        else if (type === 'center') newX = targetVal;
        else if (type === 'top') newY = targetVal + h / 2;
        else if (type === 'bottom') newY = targetVal - h / 2;
        else if (type === 'middle') newY = targetVal;

        updates[l.id] = {
            transform: {
                ...l.transform,
                position: { x: newX, y: newY }
            }
        };
    });

    // Apply updates
    const finalLayers = newLayers.map(l => {
        if (updates[l.id]) {
            return { ...l, ...updates[l.id] };
        }
        return l;
    });

    store.setState({ layers: finalLayers });
}

/**
 * Distribute Selected Layers
 * @param {string} type - 'horizontal', 'vertical', 'horizontal-spacing', 'vertical-spacing'
 */
export function distributeLayers(type) {
    const state = store.get();
    const selectedIds = state.editor.selectedLayerIds;
    if (selectedIds.length < 3) return; // Need 3 to distribute

    // Sort layers by position
    const layers = state.layers.filter(l => selectedIds.includes(l.id));

    // Helper: Sort by center coordinate
    const getCenter = (l, axis) => l.transform.position[axis]; // Already center

    // Sort logic
    if (type.startsWith('horizontal')) {
        layers.sort((a, b) => a.transform.position.x - b.transform.position.x);
    } else {
        layers.sort((a, b) => a.transform.position.y - b.transform.position.y);
    }

    const newLayers = deepClone(state.layers); // Clone full state layers to modify

    if (type === 'horizontal') {
        // Distribute Centers
        const min = layers[0].transform.position.x;
        const max = layers[layers.length - 1].transform.position.x;
        const span = max - min;
        const step = span / (layers.length - 1);

        layers.forEach((l, i) => {
            if (i === 0 || i === layers.length - 1) return;
            const target = min + step * i;
            // Update in newLayers
            const idx = newLayers.findIndex(nl => nl.id === l.id);
            if (idx !== -1) newLayers[idx].transform.position.x = target;
        });

    } else if (type === 'vertical') {
        // Distribute Centers
        const min = layers[0].transform.position.y;
        const max = layers[layers.length - 1].transform.position.y;
        const span = max - min;
        const step = span / (layers.length - 1);

        layers.forEach((l, i) => {
            if (i === 0 || i === layers.length - 1) return;
            const target = min + step * i;
            const idx = newLayers.findIndex(nl => nl.id === l.id);
            if (idx !== -1) newLayers[idx].transform.position.y = target;
        });

    } else if (type === 'horizontal-spacing') {
        // Distribute Gaps
        // Space = (TotalRange - SumOfWidths) / (N-1) implies we keep First Left and Last Right fixed?
        // Or we keep First Left and Last Right edges fixed.

        // Let's use edges.
        // First Layer Left Edge
        const first = layers[0];
        const last = layers[layers.length - 1];

        const firstLeft = first.transform.position.x - first.transform.size.width / 2;
        const lastRight = last.transform.position.x + last.transform.size.width / 2;

        const totalSpace = lastRight - firstLeft;
        const sumWidths = layers.reduce((acc, l) => acc + l.transform.size.width, 0);

        const gap = (totalSpace - sumWidths) / (layers.length - 1);

        let currentLeft = firstLeft;

        layers.forEach((l, i) => {
            // New Center = currentLeft + w/2
            const w = l.transform.size.width;
            const newCenter = currentLeft + w / 2;

            const idx = newLayers.findIndex(nl => nl.id === l.id);
            if (idx !== -1) newLayers[idx].transform.position.x = newCenter;

            currentLeft += w + gap;
        });

    } else if (type === 'vertical-spacing') {
        // Distribute Gaps
        const first = layers[0];
        const last = layers[layers.length - 1];

        const firstTop = first.transform.position.y - first.transform.size.height / 2;
        const lastBottom = last.transform.position.y + last.transform.size.height / 2;

        const totalSpace = lastBottom - firstTop;
        const sumHeights = layers.reduce((acc, l) => acc + l.transform.size.height, 0);

        const gap = (totalSpace - sumHeights) / (layers.length - 1);

        let currentTop = firstTop;

        layers.forEach((l, i) => {
            const h = l.transform.size.height;
            const newCenter = currentTop + h / 2;

            const idx = newLayers.findIndex(nl => nl.id === l.id);
            if (idx !== -1) newLayers[idx].transform.position.y = newCenter;

            currentTop += h + gap;
        });
    }

    store.setState({ layers: newLayers });
}

/**
 * Move Layer (Z-Index)
 * @param {string} id 
 * @param {number} delta (+1 or -1)
 */
export function moveLayer(id, delta) {
    const state = store.get();
    const layers = [...state.layers];
    const index = layers.findIndex(l => l.id === id);
    if (index === -1) return;

    // Background Safety Check
    // If we are moving something, we must ensure we don't swap with background (index 0 usually).
    // Or if Layer 0 is Background, nothing should go to index 0.

    const newIndex = index + delta;
    if (newIndex < 0 || newIndex >= layers.length) return;

    // Check target slot
    const targetLayer = layers[newIndex];
    if (targetLayer.type === LAYER_TYPES.BACKGROUND) return; // Cannot swap with background

    // Swap
    [layers[index], layers[newIndex]] = [layers[newIndex], layers[index]];
    store.setState({ layers });
}

/**
 * Move Layer to Extreme (Front/Back)
 * @param {string} id 
 * @param {string} direction 'front' | 'back'
 */
export function moveToExtreme(id, direction) {
    const state = store.get();
    let layers = [...state.layers];
    const index = layers.findIndex(l => l.id === id);
    if (index === -1) return;

    const [item] = layers.splice(index, 1);

    if (direction === 'front') {
        layers.push(item);
    } else {
        // Back
        // Find index of Background
        const bgIndex = layers.findIndex(l => l.type === LAYER_TYPES.BACKGROUND);
        if (bgIndex !== -1) {
            // Insert AFTER background
            layers.splice(bgIndex + 1, 0, item);
        } else {
            // No background? Just 0.
            layers.unshift(item);
        }
    }

    store.setState({ layers });
}

/**
 * Duplicate Layer
 * @param {object} layer 
 */
export function duplicateLayer(layer) {
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

/**
 * Delete Layer
 * @param {string} id 
 */
export function deleteLayer(id) {
    const layers = store.get().layers.filter(l => l.id !== id);
    store.setState({
        layers,
        editor: { ...store.get().editor, selectedLayerIds: [] }
    });
}
