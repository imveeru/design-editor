import store, { LAYER_TYPES } from './state.js';
import { toDegrees, toRadians, debounce, deepClone, generateId } from './utils.js';

import { enterTextEditMode } from './textEditor.js';
import { groupLayers, ungroupLayers } from './layerActions.js';

const canvas = document.getElementById('main-canvas');
const overlay = document.getElementById('selection-overlay');
const container = document.getElementById('canvas-container');

let isDragging = false;
let isResizing = false;
let isRotating = false;
let isDragSelecting = false; // New
let dragSelectionStart = { x: 0, y: 0 }; // New
let dragSelectionRect = null; // New
let dragStartParams = null;
let activeHandle = null;

// Panning State
let isPanning = false;
let isSpacePressed = false;
let panStart = { x: 0, y: 0 };

/**
 * Initialize Interaction Listeners
 */
export function initInteractions() {
    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Spacebar Panning (check logic to allow space if not focused in inputs)
    window.addEventListener('keydown', (e) => {
        if (e.key === ' ' && !isSpacePressed && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            isSpacePressed = true;
            document.body.style.cursor = 'grab';
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === ' ') {
            isSpacePressed = false;
            // Only reset cursor if not currently dragging a pan
            if (!isPanning) {
                document.body.style.cursor = 'default';
            }
        }
    });

    // Click on workspace background (outside canvas) deselects
    const workspace = document.getElementById('workspace-area');
    if (workspace) {
        workspace.addEventListener('mousedown', (e) => {
            // Handle Panning Start on Workspace
            if (isSpacePressed) {
                // Let handleMouseDown handle it regardless of target? 
                // We'll let the global mousedown handler catch interactions.
                return;
            }

            // Check if exactly the workspace (background) was clicked
            if (e.target === workspace) {
                store.setState({
                    editor: { ...store.get().editor, selectedLayerIds: [] }
                }, true, false); // Don't add deselect to history
            }
        });
    }

    // Double Click for Text Editing
    container.addEventListener('dblclick', handleDoubleClick);

    // Pinch to Zoom (Ctrl + Wheel)
    window.addEventListener('wheel', (e) => {
        // If Ctrl pressed -> Zoom
        if (e.ctrlKey) {
            e.preventDefault();
            const delta = -e.deltaY * 0.01; // Sensitivity
            const currentZoom = store.get().canvas.zoom;
            if (window.setZoom) {
                window.setZoom(currentZoom + delta);
            }
        } else {
            // Normal Wheel -> Pan
            e.preventDefault();
            const currentPan = store.get().canvas.pan || { x: 0, y: 0 };
            window.setPan(currentPan.x - e.deltaX, currentPan.y - e.deltaY);
        }
    }, { passive: false });
}

// Coordinate conversion helpers
function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    // ... rest of function
    const state = store.get();
    const dpr = window.devicePixelRatio || 1;
    // Mouse relative to canvas element
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);

    // Normalize to 0-1
    return {
        x: x / rect.width,
        y: y / rect.height,
        absX: x,
        absY: y
    };
}

function handleMouseDown(e) {
    const state = store.get();

    // 0. Handle Panning (Spacebar OR Middle Mouse)
    if (isSpacePressed || e.button === 1) {
        if (e.button === 1) e.preventDefault(); // Prevent scroll cursor
        isPanning = true;
        panStart = { x: e.clientX, y: e.clientY };
        document.body.style.cursor = 'grabbing';
        return; // Stop other interactions
    }

    const coords = getCanvasCoords(e);

    // 1. Check if clicking on an existing selection handle (Resize/Rotate)
    if (e.target.classList.contains('selection-handle')) {
        // ... existing handle logic ...
        e.preventDefault();
        e.stopPropagation();

        if (e.target.classList.contains('rot')) {
            isRotating = true;
        } else {
            isResizing = true;
            // Determine handle direction based on class (n, s, e, w, ne, etc.)
            const classes = e.target.className.split(' ');
            activeHandle = classes.find(c => ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].includes(c));
        }

        dragStartParams = {
            startX: coords.x,
            startY: coords.y,
            startWidth: 0, // Fill later
            startHeight: 0, // Fill later
            startLeft: 0,
            startTop: 0,
            startRotation: 0
        };

        // Populate start params from selected layer
        const selectedId = state.editor.selectedLayerIds[0];
        if (selectedId) {
            const layer = state.layers.find(l => l.id === selectedId);
            if (layer) {
                dragStartParams.startWidth = layer.transform.size.width;
                dragStartParams.startHeight = layer.transform.size.height;
                dragStartParams.startLeft = layer.transform.position.x;
                dragStartParams.startTop = layer.transform.position.y;
                dragStartParams.startRotation = layer.transform.rotation;

                // Calculate initial mouse angle relative to object center
                const pxCX = layer.transform.position.x * canvas.offsetWidth;
                const pxCY = layer.transform.position.y * canvas.offsetHeight;
                const pxMX = coords.absX;
                const pxMY = coords.absY;
                const startAngleRad = Math.atan2(pxMY - pxCY, pxMX - pxCX);
                const startAngleDeg = toDegrees(startAngleRad); // This is where the mouse IS

                // We want: MouseAngle - Offset = ObjectAngle
                // So: Offset = MouseAngle - ObjectAngle
                dragStartParams.angleOffset = startAngleDeg - layer.transform.rotation;
            }
        }
        return;
    }

    // 2. Hit Test for selecting a layer
    // Iterate reverse to find top-most
    let hitLayerId = null;

    // We need to check intersection. 
    // Basic checking: Axis aligned check if rotation is 0, else complex.
    // For MVP, enable selection on top-most approximate bounding box.
    const layers = [...state.layers].reverse();
    for (let layer of layers) {
        if (!layer.visible) continue;

        if (isPointInLayer(coords.x, coords.y, layer, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1))) {
            hitLayerId = layer.id;
            // GROUP LOGIC: Check Transparency / Hit Logic
            // If we hit a child of a group, we should select the Group, unless the Group is already selected and we double clicked (handled elsewhere).
            const hitLayer = state.layers.find(l => l.id === hitLayerId);
            if (hitLayer && hitLayer.parentId) {
                hitLayerId = hitLayer.parentId;
            }
            break;
        }
    }

    if (hitLayerId) {
        // Handle Multi-select (Shift)
        let newSelection = [hitLayerId];
        if (e.shiftKey) {
            const currentSelected = state.editor.selectedLayerIds;
            if (currentSelected.includes(hitLayerId)) {
                newSelection = currentSelected.filter(id => id !== hitLayerId);
            } else {
                newSelection = [...currentSelected, hitLayerId];
            }
        }

        store.setState({
            editor: { ...state.editor, selectedLayerIds: newSelection }
        }, true, false); // Don't add simple selection to history

        // Start Dragging
        const layer = state.layers.find(l => l.id === hitLayerId);

        // Only enable dragging if NOT background and NOT locked
        // (Locked non-background layers are skipped in hit test)
        if (layer.type !== LAYER_TYPES.BACKGROUND && !layer.locked) {

            // Check for Alt-Drag Duplication
            if (e.altKey) {
                const clones = [];
                const newIds = [];

                newSelection.forEach(id => {
                    const original = state.layers.find(l => l.id === id);
                    if (original) {
                        const clone = deepClone(original);
                        clone.id = generateId('layer');
                        clone.name = `${original.name} (Copy)`;
                        // No offset for Alt-Drag (mouse movement handles it)
                        clones.push(clone);
                        newIds.push(clone.id);
                    }
                });

                // Add clones to state
                store.setState({
                    layers: [...state.layers, ...clones], // Add to top? Or above originals? Appends to end (top)
                    editor: { ...state.editor, selectedLayerIds: newIds }
                });

                // Update variable for subsequent logic
                newSelection = newIds;
            }

            isDragging = true;
            document.body.style.cursor = 'move';

            dragStartParams = {
                startX: coords.x,
                startY: coords.y,
                initialObjs: []
            };

            // Recursively add children to move list
            const addLayerToMove = (id) => {
                const l = store.get().layers.find(ly => ly.id === id);
                if (!l) return;

                // Add this layer
                dragStartParams.initialObjs.push({
                    id: id,
                    x: l.transform.position.x,
                    y: l.transform.position.y
                });

                // If group, add children
                if (l.type === LAYER_TYPES.GROUP && l.children) {
                    l.children.forEach(childId => addLayerToMove(childId));
                }
            };

            newSelection.forEach(id => addLayerToMove(id));
        }

        renderSelectionOverlay();

    } else {
        // 3. Drag Selection Start
        // If we clicked on empty space (background or workspace), start drag selection
        // Ensure we are not panning
        if (!isPanning) {
            isDragSelecting = true;
            dragSelectionStart = { x: e.clientX, y: e.clientY };

            // Create/Reset Selection Rect Element
            if (!dragSelectionRect) {
                dragSelectionRect = document.createElement('div');
                dragSelectionRect.className = 'drag-selection-rect';
                // Append to container (parent of overlay) to avoid being cleared by renderSelectionOverlay
                container.appendChild(dragSelectionRect);
            }
            dragSelectionRect.style.display = 'block';
            dragSelectionRect.style.left = `${e.clientX}px`;
            dragSelectionRect.style.top = `${e.clientY}px`;
            dragSelectionRect.style.width = '0px';
            dragSelectionRect.style.height = '0px';

            // Deselect logic:
            // If dragging starts, we might want to keep selection if Shift is held?
            // Standard behavior: Click on empty space deselects immediately unless dragging starts?
            // If we just CLICK, we deselect. If we DRAG, we start selection.
            // Usually, mousedown on empty space deselects.
            if (!e.shiftKey) {
                store.setState({
                    editor: { ...state.editor, selectedLayerIds: [] }
                }, true, false); // Don't add deselect to history
                renderSelectionOverlay();
            }
        }
    }
}

function handleMouseMove(e) {
    if (isPanning) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;

        const currentPan = store.get().canvas.pan || { x: 0, y: 0 };
        window.setPan(currentPan.x + dx, currentPan.y + dy);

        panStart = { x: e.clientX, y: e.clientY };
        return;
    }

    if (isDragSelecting) {
        const currentX = e.clientX;
        const currentY = e.clientY;

        // Calculate Rect
        const rect = overlay.getBoundingClientRect();
        const startRelX = dragSelectionStart.x - rect.left;
        const startRelY = dragSelectionStart.y - rect.top;
        const curRelX = currentX - rect.left;
        const curRelY = currentY - rect.top;

        const left = Math.min(startRelX, curRelX);
        const top = Math.min(startRelY, curRelY);
        const width = Math.abs(curRelX - startRelX);
        const height = Math.abs(curRelY - startRelY);

        dragSelectionRect.style.left = `${left}px`;
        dragSelectionRect.style.top = `${top}px`;
        dragSelectionRect.style.width = `${width}px`;
        dragSelectionRect.style.height = `${height}px`;

        const normRect = {
            x: left / rect.width,
            y: top / rect.height,
            w: width / rect.width,
            h: height / rect.height
        };

        const state = store.get();
        const newSelected = [];

        // Iterate Layers
        state.layers.forEach(layer => {
            if (!layer.visible || layer.locked || layer.type === LAYER_TYPES.BACKGROUND) return;
            const layerAABB = getLayerAABB(layer); // Normalized
            if (checkAABBIntersection(normRect, layerAABB)) {
                newSelected.push(layer.id);
            }
        });

        if (e.shiftKey) {
            const current = state.editor.selectedLayerIds;
            const union = [...new Set([...current, ...newSelected])];
            store.setState({ editor: { ...state.editor, selectedLayerIds: union } }, false, false);
        } else {
            store.setState({ editor: { ...state.editor, selectedLayerIds: newSelected } }, false, false);
        }

        return;
    }

    if (!isDragging && !isResizing && !isRotating) return;

    // Prevent default to avoid selection text etc
    e.preventDefault();

    const coords = getCanvasCoords(e);
    const state = store.get();

    if (isDragging) {
        const dx = coords.x - dragStartParams.startX;
        const dy = coords.y - dragStartParams.startY;

        // Update all selected items
        dragStartParams.initialObjs.forEach(obj => {
            const layer = store.get().layers.find(l => l.id === obj.id);
            if (layer && !layer.locked) {
                store.updateLayer(obj.id, {
                    transform: {
                        ...layer.transform,
                        position: {
                            x: obj.x + dx,
                            y: obj.y + dy
                        }
                    }
                }, false); // No history during drag
            }
        });
    }

    if (isResizing) {
        const selectedId = state.editor.selectedLayerIds[0];
        if (!selectedId) return;

        const layer = state.layers.find(l => l.id === selectedId);

        const dx = coords.x - dragStartParams.startX;
        const dy = coords.y - dragStartParams.startY;

        let newW = dragStartParams.startWidth;
        let newH = dragStartParams.startHeight;
        let newX = dragStartParams.startLeft;
        let newY = dragStartParams.startTop;

        const ar = dragStartParams.startWidth / dragStartParams.startHeight;
        let dW = 0;
        let dH = 0;

        if (activeHandle.includes('e')) dW = dx;
        if (activeHandle.includes('w')) dW = -dx;
        if (activeHandle.includes('s')) dH = dy;
        if (activeHandle.includes('n')) dH = -dy;

        let finalW = newW + dW;
        let finalH = newH + dH;

        if (e.shiftKey) {
            if (activeHandle === 'n' || activeHandle === 's') {
                finalW = finalH * ar;
            } else {
                finalH = finalW / ar;
            }
        }

        const deltaW = finalW - dragStartParams.startWidth;
        const deltaH = finalH - dragStartParams.startHeight;

        if (activeHandle.includes('w')) newX = dragStartParams.startLeft - deltaW / 2;
        else if (activeHandle.includes('e')) newX = dragStartParams.startLeft + deltaW / 2;

        if (activeHandle.includes('n')) newY = dragStartParams.startTop - deltaH / 2;
        else if (activeHandle.includes('s')) newY = dragStartParams.startTop + deltaH / 2;

        store.updateLayer(selectedId, {
            transform: {
                ...layer.transform,
                size: { width: Math.max(0.01, finalW), height: Math.max(0.01, finalH) },
                position: { x: newX, y: newY }
            }
        }, false); // No history during resize
    }

    if (isRotating) {
        document.body.classList.add('cursor-rotate');

        const selectedId = state.editor.selectedLayerIds[0];
        if (!selectedId) return;
        const layer = state.layers.find(l => l.id === selectedId);
        const currentAngleRad = Math.atan2(coords.absY - (layer.transform.position.y * canvas.offsetHeight), coords.absX - (layer.transform.position.x * canvas.offsetWidth));
        const currentAngleDeg = toDegrees(currentAngleRad);
        const initialAngleOffset = dragStartParams.angleOffset || 0;
        let newRotation = currentAngleDeg - initialAngleOffset;

        store.updateLayer(selectedId, {
            transform: {
                ...layer.transform,
                rotation: newRotation
            }
        }, false); // No history during rotate
    }
}

function handleMouseUp(e) {
    if (isPanning) {
        isPanning = false;
        if (!isSpacePressed) {
            document.body.style.cursor = 'default';
        } else {
            document.body.style.cursor = 'grab';
        }
        return;
    }

    // Check if we need to commit history
    const needsHistory = isDragging || isResizing || isRotating;

    isDragging = false;
    isResizing = false;
    isRotating = false;

    if (isDragSelecting) {
        isDragSelecting = false;
        if (dragSelectionRect) {
            dragSelectionRect.style.display = 'none';
        }
        // Commit selection state (persist but NO history)
        store.setState({}, true, false);
    } else if (needsHistory) {
        // Commit transformation state to history
        store.setState({}, true, true);
    }

    dragStartParams = null;
    activeHandle = null;
    document.body.style.cursor = 'default';
    document.body.classList.remove('cursor-rotate');
}

function handleDoubleClick(e) {
    const coords = getCanvasCoords(e);
    const state = store.get();

    // Find top-most layer at this point
    const layers = [...state.layers].reverse();
    for (let layer of layers) {
        if (!layer.visible || layer.locked) continue;

        if (isPointInLayer(coords.x, coords.y, layer, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1))) {
            if (layer.type === '1') { // LAYER_TYPES.TEXT is '1'
                if (layer.locked) return;
                enterTextEditMode(layer, { width: state.canvas.width, height: state.canvas.height });
                return;
            }
        }
    }
}


// Helpers

function isPointInLayer(x, y, layer, canvasW, canvasH) {
    // 1. Transform point to layer's local space
    // Center of layer
    const cx = layer.transform.position.x;
    const cy = layer.transform.position.y;
    const w = layer.transform.size.width;
    const h = layer.transform.size.height;

    // Convert normalized point to relative to center (scale aspect ratio)
    // Actually easiest is: Rotate point around center by -rotation, then check bounds.

    // Go to pixel space for easier math
    const px = x * canvasW;
    const py = y * canvasH;
    const pcx = cx * canvasW;
    const pcy = cy * canvasH;
    const pw = w * canvasW;
    const ph = h * canvasH;

    // Rotate point around center
    const angleRad = -toRadians(layer.transform.rotation);
    const runs = px - pcx;
    const rise = py - pcy;

    const rotX = runs * Math.cos(angleRad) - rise * Math.sin(angleRad);
    const rotY = runs * Math.sin(angleRad) + rise * Math.cos(angleRad);

    // Check against half-width/height
    return (Math.abs(rotX) <= pw / 2) && (Math.abs(rotY) <= ph / 2);
}

/**
 * Get Axis-Aligned Bounding Box of a layer in Normalized Coordinates (0-1)
 */
function getLayerAABB(layer) {
    const t = layer.transform;
    const cx = t.position.x;
    const cy = t.position.y;
    const w = t.size.width;
    const h = t.size.height;
    const rot = t.rotation;

    if (rot === 0) {
        return {
            minX: cx - w / 2,
            maxX: cx + w / 2,
            minY: cy - h / 2,
            maxY: cy + h / 2
        };
    }

    // Rotated
    // Calculate 4 corners relative to center, rotate, then add center back
    const rad = toRadians(rot);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const hw = w / 2;
    const hh = h / 2;

    // Corners relative to center
    // TL: -hw, -hh
    // TR: hw, -hh
    // BR: hw, hh
    // BL: -hw, hh

    const corners = [
        { x: -hw, y: -hh },
        { x: hw, y: -hh },
        { x: hw, y: hh },
        { x: -hw, y: hh }
    ];

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    corners.forEach(p => {
        // Rotate
        const rx = p.x * cos - p.y * sin;
        const ry = p.x * sin + p.y * cos;

        // Translate back
        const finalX = cx + rx;
        const finalY = cy + ry;

        if (finalX < minX) minX = finalX;
        if (finalX > maxX) maxX = finalX;
        if (finalY < minY) minY = finalY;
        if (finalY > maxY) maxY = finalY;
    });

    return { minX, maxX, minY, maxY };
}

/**
 * Check Intersection between two AABBs
 * Rect format: {x, y, w, h} (Top-Left based)
 * AABB format: {minX, maxX, minY, maxY}
 */
function checkAABBIntersection(rect, aabb) {
    const rMinX = rect.x;
    const rMaxX = rect.x + rect.w;
    const rMinY = rect.y;
    const rMaxY = rect.y + rect.h;

    // Intersection if ranges overlap in both axes
    return (rMinX < aabb.maxX && rMaxX > aabb.minX &&
        rMinY < aabb.maxY && rMaxY > aabb.minY);
}

/**
 * Renders the selection overlay (handles, bounding box)
 */
export function renderSelectionOverlay() {
    // Clear overlay
    overlay.innerHTML = '';

    const state = store.get();
    const ids = state.editor.selectedLayerIds;
    if (ids.length === 0) return;

    const canvasW = overlay.clientWidth;
    const canvasH = overlay.clientHeight;

    ids.forEach(id => {
        const layer = state.layers.find(l => l.id === id);
        if (!layer || !layer.visible) return;

        const t = layer.transform;

        // Create Box
        const box = document.createElement('div');
        box.className = 'selection-box';

        const w = t.size.width * canvasW;
        const h = t.size.height * canvasH;
        const l = t.position.x * canvasW - w / 2;
        const top = t.position.y * canvasH - h / 2;

        box.style.width = `${w}px`;
        box.style.height = `${h}px`;
        box.style.left = `${l}px`;
        box.style.top = `${top}px`;
        box.style.transform = `rotate(${t.rotation}deg)`;

        // Create Handles (Only if single selection)
        if (ids.length === 1) {
            if (!layer.locked) {
                ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se', 'rot'].forEach(dir => {
                    const handle = document.createElement('div');
                    handle.className = `selection-handle ${dir}`;
                    box.appendChild(handle);
                });
            } else {
                // Show Lock Indicator
                const lockIndicator = document.createElement('div');
                lockIndicator.className = 'absolute -top-3 -right-3 w-6 h-6 bg-white dark:bg-zinc-800 rounded-full shadow-md flex items-center justify-center border border-gray-200 dark:border-zinc-700 z-50';
                lockIndicator.innerHTML = '<i class="ph ph-lock-key text-xs text-amber-500"></i>';
                box.appendChild(lockIndicator);

                // Add border style for locked state
                box.style.borderColor = '#f59e0b'; // Amber
                box.style.borderStyle = 'dashed';
            }
        }

        overlay.appendChild(box);
    });
}

// Re-render overlay when state changes
store.subscribe(() => {
    requestAnimationFrame(renderSelectionOverlay);
});


