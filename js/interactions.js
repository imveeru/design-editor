import store from './state.js';
import { toDegrees, toRadians, debounce } from './utils.js';

const canvas = document.getElementById('main-canvas');
const overlay = document.getElementById('selection-overlay');
const container = document.getElementById('canvas-container');

let isDragging = false;
let isResizing = false;
let isRotating = false;
let dragStartParams = null;
let activeHandle = null;

/**
 * Initialize Interaction Listeners
 */
export function initInteractions() {
    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
}

// Coordinate conversion helpers
function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
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
    const coords = getCanvasCoords(e);

    // 1. Check if clicking on an existing selection handle (Resize/Rotate)
    if (e.target.classList.contains('selection-handle')) {
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
        if (!layer.visible || layer.locked) continue;

        if (isPointInLayer(coords.x, coords.y, layer, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1))) {
            hitLayerId = layer.id;
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
        });

        // Start Dragging
        isDragging = true;
        document.body.style.cursor = 'grabbing';

        const layer = state.layers.find(l => l.id === hitLayerId);
        dragStartParams = {
            startX: coords.x,
            startY: coords.y,
            initialObjs: newSelection.map(id => {
                const l = state.layers.find(ly => ly.id === id);
                return {
                    id: id,
                    x: l.transform.position.x,
                    y: l.transform.position.y
                };
            })
        };

        renderSelectionOverlay();

    } else {
        // Deselect
        store.setState({
            editor: { ...state.editor, selectedLayerIds: [] }
        });
        renderSelectionOverlay();
    }
}

function handleMouseMove(e) {
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
                });
            }
        });
    }

    if (isResizing) {
        const selectedId = state.editor.selectedLayerIds[0]; // Simplification: Resize primary only
        if (!selectedId) return;

        const layer = state.layers.find(l => l.id === selectedId);

        const dx = coords.x - dragStartParams.startX;
        const dy = coords.y - dragStartParams.startY;

        // Simple resize logic (does not account for rotation yet for stability)
        // This is complex for rotated objects. 
        // Start with axis-aligned logic.

        // Initial params
        let newW = dragStartParams.startWidth;
        let newH = dragStartParams.startHeight;
        let newX = dragStartParams.startLeft;
        let newY = dragStartParams.startTop;

        // Aspect Ratio
        const ar = dragStartParams.startWidth / dragStartParams.startHeight;

        // Deltas
        let dW = 0;
        let dH = 0;

        // Calculate potential new dimensions based on handles
        if (activeHandle.includes('e')) dW = dx;
        if (activeHandle.includes('w')) dW = -dx;
        if (activeHandle.includes('s')) dH = dy;
        if (activeHandle.includes('n')) dH = -dy;

        let finalW = newW + dW;
        let finalH = newH + dH;

        // Constrain Aspect Ratio if Shift is held
        if (e.shiftKey) {
            // Logic: Which dimension is "driving"?
            // If dragging corner, usually the larger relative movement drives.
            // Or just stick to width driving height?

            // If dragging N/S only (height handles), height drives.
            // If dragging E/W only (width handles), width drives.
            // If corner, pick one? Let's say Width drives for simplicity or dominance.

            if (activeHandle === 'n' || activeHandle === 's') {
                // Height drives
                finalW = finalH * ar;
            } else {
                // Width drives (E, W, or Corners - default to width-dominant for smooth UX)
                // Actually for corners, snapping to whichever is larger delta is better touch, 
                // but fixed driver is more consistent.
                finalH = finalW / ar;
            }
        }

        // Apply back to Position (Centering or Corner Anchoring)
        // We need to re-calculate X/Y based on the generic "anchor point" opposite to handles.
        // It's easier to compute DeltaW and DeltaH from the Final dimensions.

        const deltaW = finalW - dragStartParams.startWidth;
        const deltaH = finalH - dragStartParams.startHeight;

        // Apply Deltas to Position
        if (activeHandle.includes('w')) newX = dragStartParams.startLeft - deltaW / 2;
        else if (activeHandle.includes('e')) newX = dragStartParams.startLeft + deltaW / 2;

        // Vertical
        if (activeHandle.includes('n')) newY = dragStartParams.startTop - deltaH / 2;
        else if (activeHandle.includes('s')) newY = dragStartParams.startTop + deltaH / 2;

        // Note: The logic above assumes "center anchor" behavior for generic resize in the app 
        // (implied by previous code `newX += dx / 2`).
        // If the app uses corner-anchor (standard), then:
        // E: x stays, w changes. W: x moves by -deltaW, w changes.
        // But earlier code used `newX += dx / 2`, which suggests center-based resize or center-registration?
        // Checking `handleMouseMove` previous logic: 
        // `if (activeHandle.includes('w')) { newW -= dx; newX += dx / 2; }`
        // Wait, if I subtract dx from width, and move x by dx/2...
        // If I pull Left by -10px (dx=-10). W increases by 10. X moves by -5.
        // Center of Object is X.
        // Left Edge = X - W/2. Right Edge = X + W/2.
        // New Left = (X - 5) - (W + 10)/2 = X - 5 - W/2 - 5 = X - W/2 - 10. Correct.
        // So the Position is indeed the Center.

        store.updateLayer(selectedId, {
            transform: {
                ...layer.transform,
                size: { width: Math.max(0.01, finalW), height: Math.max(0.01, finalH) },
                position: { x: newX, y: newY }
            }
        });
    }

    if (isRotating) {
        document.body.style.cursor = 'grabbing'; // Or a rotate cursor

        const selectedId = state.editor.selectedLayerIds[0];
        if (!selectedId) return;
        const layer = state.layers.find(l => l.id === selectedId);

        // Calculate angle between center of object and mouse
        const centerX = layer.transform.position.x;
        const centerY = layer.transform.position.y;

        // Convert back to pixels for angle calc.
        const pxCX = centerX * canvas.offsetWidth;
        const pxCY = centerY * canvas.offsetHeight;
        const pxMX = coords.absX;
        const pxMY = coords.absY;

        const currentAngleRad = Math.atan2(pxMY - pxCY, pxMX - pxCX);
        const currentAngleDeg = toDegrees(currentAngleRad); // -180 to 180

        // Use Offset calculated at Start
        const initialAngleOffset = dragStartParams.angleOffset || 0;

        // We want the object's rotation to follow the mouse delta relative to start
        // Or simpler: Just set rotation to MouseAngle - InitialMouseAngle + InitialObjectAngle
        // But dragStartParams.startRotation is the Object's rotation at start.
        // dragStartParams.angleOffset was calculated as: MouseAngle - ObjectRotation.
        // So NewObjectRotation = MouseAngle - Offset.

        let newRotation = currentAngleDeg - initialAngleOffset;

        store.updateLayer(selectedId, {
            transform: {
                ...layer.transform,
                rotation: newRotation
            }
        });
    }
}

function handleMouseUp(e) {
    isDragging = false;
    isResizing = false;
    isRotating = false;
    dragStartParams = null;
    activeHandle = null;
    document.body.style.cursor = 'default';
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
        if (!layer) return;

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

        // Create Handles (Only if single selection for now)
        if (ids.length === 1 && !layer.locked) {
            ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se', 'rot'].forEach(dir => {
                const handle = document.createElement('div');
                handle.className = `selection-handle ${dir}`;
                box.appendChild(handle);
            });
        }

        overlay.appendChild(box);
    });
}

// Re-render overlay when state changes
store.subscribe(() => {
    requestAnimationFrame(renderSelectionOverlay);
});
