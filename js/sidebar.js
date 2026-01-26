import store, { LAYER_TYPES } from './state.js';

const inspectorPanel = document.getElementById('inspector-panel');

/**
 * Initialize Sidebar
 */
export function initSidebar() {
    // Render Loop
    store.subscribe(() => {
        requestAnimationFrame(() => {
            renderInspector();
            renderLayers();
        });
    });

    setupRailNavigation();
    setupSidebarToggle();

    // Initial Render
    renderLayers();
    renderInspector();
}

/**
 * Rail Navigation & Panel Switching
 */
function setupRailNavigation() {
    const railButtons = document.querySelectorAll('.rail-item[data-panel]');
    const panels = document.querySelectorAll('.sidebar-panel');
    const titleDir = document.getElementById('sidebar-title');
    const leftSidebar = document.getElementById('left-sidebar');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const toggleIcon = document.getElementById('sidebar-toggle-icon');

    // State
    const toggleSidebar = (show) => {
        const isCurrentlyOpen = !leftSidebar.classList.contains('w-0');
        if (show === isCurrentlyOpen) return;

        if (show) {
            // Open
            leftSidebar.classList.remove('w-0', 'border-none', 'opacity-0');
            leftSidebar.classList.add('w-[240px]', 'border-r');
            // Update Toggle Button Position (Rail 64px + Panel 240px = 304px)
            if (sidebarToggleBtn) {
                sidebarToggleBtn.style.left = '304px';
                sidebarToggleBtn.classList.add('-translate-x-1/2');
                if (toggleIcon) {
                    toggleIcon.classList.remove('ph-caret-right');
                    toggleIcon.classList.add('ph-caret-left');
                }
            }
        } else {
            // Close
            leftSidebar.classList.remove('w-[240px]', 'border-r');
            leftSidebar.classList.add('w-0', 'border-none', 'opacity-0');

            // Update Toggle Button Position (Rail 64px)
            if (sidebarToggleBtn) {
                sidebarToggleBtn.style.left = '64px';
                sidebarToggleBtn.classList.remove('-translate-x-1/2');
                if (toggleIcon) {
                    toggleIcon.classList.remove('ph-caret-left');
                    toggleIcon.classList.add('ph-caret-right');
                }
            }

            // Clear active state on rail
            railButtons.forEach(b => b.classList.remove('active-rail-item'));
        }
    };

    const activatePanel = (panelName) => {
        // Update Title
        if (titleDir) titleDir.textContent = panelName;

        // Hide all panels
        panels.forEach(p => p.classList.add('hidden'));
        panels.forEach(p => p.classList.remove('flex'));

        // Show target
        const target = document.getElementById(`${panelName}-panel`);
        if (target) {
            target.classList.remove('hidden');
            target.classList.add('flex');
        }

        // Update Rail Buttons
        railButtons.forEach(btn => {
            if (btn.dataset.panel === panelName) {
                btn.classList.add('active-rail-item');
            } else {
                btn.classList.remove('active-rail-item');
            }
        });

        // Ensure Sidebar Open
        toggleSidebar(true);
    };

    // Attach Listeners
    railButtons.forEach(btn => {
        const panelName = btn.dataset.panel;

        // Click Handler
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            activatePanel(panelName);
        });

        // Hover Handler (Only if sidebar is closed)
        btn.addEventListener('mouseenter', () => {
            const isClosed = leftSidebar.classList.contains('w-0');
            if (isClosed) {
                activatePanel(panelName);
            }
        });
    });

    // Toggle Button Logic (Manual Close/Open)
    if (sidebarToggleBtn) {
        sidebarToggleBtn.onclick = () => {
            const isClosed = leftSidebar.classList.contains('w-0');
            if (isClosed) {
                // Determine which panel to open? Default to inspector or first active
                const activeBtn = document.querySelector('.rail-item.active-rail-item');
                const panelToOpen = activeBtn ? activeBtn.dataset.panel : 'inspector';
                activatePanel(panelToOpen);
            } else {
                toggleSidebar(false);
            }
        };
    }
}

/**
 * Toggle Logic (Legacy support wrapped in setupRailNavigation now, but kept empty function if imported elsewhere)
 */
function setupSidebarToggle() {
    // Handled in setupRailNavigation
    // But we need to ensure initial position of toggle button is correct
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    if (sidebarToggleBtn) {
        // Assuming start open (Rail 64 + Pane 240)
        sidebarToggleBtn.style.left = '304px';
    }
}


// Map layer types to friendly names
const TYPE_NAMES = {
    [LAYER_TYPES.SVG]: 'Vector',
    [LAYER_TYPES.TEXT]: 'Text',
    [LAYER_TYPES.IMAGE]: 'Image',
    [LAYER_TYPES.BACKGROUND]: 'Background',
    [LAYER_TYPES.MASK]: 'Mask',
    [LAYER_TYPES.GROUP]: 'Group'
};

const TYPE_ICONS = {
    [LAYER_TYPES.SVG]: 'ph-vector-three',
    [LAYER_TYPES.TEXT]: 'ph-text-t',
    [LAYER_TYPES.IMAGE]: 'ph-image',
    [LAYER_TYPES.BACKGROUND]: 'ph-selection-background',
    [LAYER_TYPES.MASK]: 'ph-circle-half',
    [LAYER_TYPES.GROUP]: 'ph-selection-plus'
};

/* --- INSPECTOR --- */

function renderInspector() {
    const state = store.get();
    const selectedIds = state.editor.selectedLayerIds;

    inspectorPanel.innerHTML = '';

    if (selectedIds.length === 0) {
        inspectorPanel.innerHTML = '<p class="text-sm text-gray-400 text-center mt-20 select-none">No Selection</p>';
        return;
    }

    if (selectedIds.length > 1) {
        inspectorPanel.innerHTML = `<p class="text-sm text-gray-500 text-center mt-10">${selectedIds.length} items selected</p>`;
        return;
    }

    // Property editing is now handled in the Floating Toolbar
    inspectorPanel.innerHTML = `<div class="p-4 text-center">
        <p class="text-xs text-gray-400">Edit properties in the toolbar above the canvas.</p>
    </div>`;
}

/* --- LAYERS --- */

// Drag and Drop State
let dragSrcEl = null;

function handleDragStart(e) {
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.getAttribute('data-id'));
    this.classList.add('opacity-50');
}

function handleDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    this.classList.add('bg-gray-200', 'dark:bg-gray-600');
}

function handleDragLeave(e) {
    this.classList.remove('bg-gray-200', 'dark:bg-gray-600');
}

function handleDrop(e) {
    if (e.stopPropagation) e.stopPropagation();

    const srcId = e.dataTransfer.getData('text/plain');
    const destId = this.getAttribute('data-id');

    if (srcId !== destId) {
        // Reorder
        moveLayerBefore(srcId, destId);
    }
    return false;
}

function handleDragEnd(e) {
    this.classList.remove('opacity-50');
    // Cleanup classes
    const list = document.getElementById('layers-list');
    if (list) {
        [].forEach.call(list.querySelectorAll('div[draggable]'), function (col) {
            col.classList.remove('bg-gray-200', 'dark:bg-gray-600');
        });
    }
}

function moveLayerBefore(srcId, destId) {
    const state = store.get();
    let layers = [...state.layers];

    // Note: layers array is 0=back, N=front.
    // The UI list is reversed (Top=Front).

    const srcIndex = layers.findIndex(l => l.id === srcId);
    if (srcIndex === -1) return;
    const [srcItem] = layers.splice(srcIndex, 1);

    const destIndex = layers.findIndex(l => l.id === destId);
    // If dropping ON an item, we insert at its index
    if (destIndex === -1) {
        layers.push(srcItem);
    } else {
        layers.splice(destIndex, 0, srcItem);
    }

    store.setState({ layers });
}

function renderLayers() {
    const state = store.get();
    const headersList = document.getElementById('layers-list');
    if (!headersList) return;

    const layers = [...state.layers].reverse(); // Show top layer at top of list
    const selectedIds = state.editor.selectedLayerIds;

    // Helper to create the name span with double-click logic
    const createNameSpan = (layer) => {
        const span = document.createElement('span');
        span.className = "truncate font-medium flex-1";
        span.textContent = layer.name || TYPE_NAMES[layer.type] || 'Layer';

        span.ondblclick = (e) => {
            e.stopPropagation();
            e.preventDefault();

            const input = document.createElement('input');
            input.type = 'text';
            input.value = layer.name || TYPE_NAMES[layer.type] || 'Layer';
            input.className = "flex-1 bg-white dark:bg-gray-800 text-xs px-1 py-0.5 rounded border border-blue-500 focus:outline-none min-w-0";

            const parent = span.parentNode;
            if (parent) {
                parent.replaceChild(input, span);
                input.focus();
                input.select();
            }

            let isCancelling = false;

            const save = () => {
                if (isCancelling) return;

                const newName = input.value.trim();
                if (newName && newName !== layer.name) {
                    store.updateLayer(layer.id, { name: newName });
                } else {
                    renderLayers(); // Force re-render if no change or empty
                }
            };

            input.onblur = save;
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    input.blur(); // Triggers save
                }
                if (e.key === 'Escape') {
                    isCancelling = true;
                    renderLayers(); // Revert
                }
                e.stopPropagation(); // Prevent shortcuts
            };

            input.onclick = (e) => e.stopPropagation();
            input.ondblclick = (e) => e.stopPropagation();
        };

        return span;
    };

    // Reconciliation
    const existingNodes = Array.from(headersList.children);
    const canUpdate = existingNodes.length === layers.length && existingNodes.every((node, i) => {
        return node.getAttribute('data-id') === layers[i].id;
    });

    if (canUpdate) {
        layers.forEach((layer, index) => {
            const div = existingNodes[index];
            const isSelected = selectedIds.includes(layer.id);

            // Update Wrapper Classes (Selection)
            const baseClass = "flex items-center justify-between p-1 rounded-md text-xs mb-0.5 cursor-pointer select-none group border border-transparent transition-colors";
            const stateClass = isSelected
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300';

            const newClassName = `${baseClass} ${stateClass}`;
            if (div.className.replace(/\s+/g, ' ').trim() !== newClassName.replace(/\s+/g, ' ').trim()) {
                div.className = newClassName;
            }

            // Update Left Content
            const leftContent = div.firstElementChild;
            if (leftContent) {
                const opacityClass = `flex items-center gap-2 overflow-hidden w-full ${!layer.visible ? 'opacity-40 grayscale' : (layer.locked ? 'opacity-70' : '')}`;
                if (leftContent.className !== opacityClass) {
                    leftContent.className = opacityClass;
                }

                // Update Icon Color (Child 1 after grab handle)
                // Child 0 = grab span, Child 1 = icon, Child 2 = name
                const icon = leftContent.children[1];
                if (icon) {
                    const typeIcon = TYPE_ICONS[layer.type] || 'ph-bounding-box';
                    const iconClass = `ph ${typeIcon} text-gray-500 text-xs ${layer.locked ? 'text-amber-500' : ''}`;
                    if (icon.className !== iconClass) {
                        icon.className = iconClass;
                    }
                }

                // Update Name (Child 2)
                const nameNode = leftContent.children[2];
                const isEditing = nameNode && nameNode.tagName === 'INPUT' && document.activeElement === nameNode;

                if (!isEditing) {
                    const newName = layer.name || TYPE_NAMES[layer.type] || 'Layer';
                    if (nameNode && nameNode.tagName === 'INPUT') {
                        const newSpan = createNameSpan(layer);
                        leftContent.replaceChild(newSpan, nameNode);
                    } else if (nameNode) {
                        if (nameNode.textContent !== newName) {
                            nameNode.textContent = newName;
                        }
                    } else {
                        leftContent.appendChild(createNameSpan(layer));
                    }
                }
            }

            // Update Actions
            const actions = div.lastElementChild;
            if (actions) {
                const actionsClass = `flex items-center gap-1 opacity-0 group-hover:opacity-100 ${isSelected || !layer.visible || layer.locked ? 'opacity-100' : ''} transition-opacity`;
                if (actions.className !== actionsClass) actions.className = actionsClass;

                const lockBtn = actions.children[0];
                const visBtn = actions.children[1];
                const lockIconClass = layer.locked ? 'ph-lock-key' : 'ph-lock-key-open';
                const visIconClass = layer.visible ? 'ph-eye' : 'ph-eye-closed';

                if (lockBtn) {
                    const lockBtnClass = `w-5 h-5 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/20 transition-colors ${layer.locked ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-gray-400'}`;
                    if (lockBtn.className !== lockBtnClass) lockBtn.className = lockBtnClass;
                    lockBtn.title = layer.locked ? 'Unlock' : 'Lock';
                    const icon = lockBtn.firstElementChild;
                    if (icon && !icon.classList.contains(lockIconClass)) lockBtn.innerHTML = `<i class="ph ${lockIconClass}"></i>`;
                }
                if (visBtn) {
                    const visBtnClass = `w-5 h-5 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/20 transition-colors ${!layer.visible ? 'text-gray-400' : 'text-gray-400'}`;
                    if (visBtn.className !== visBtnClass) visBtn.className = visBtnClass;
                    visBtn.title = layer.visible ? 'Hide' : 'Show';
                    const icon = visBtn.firstElementChild;
                    if (icon && !icon.classList.contains(visIconClass)) visBtn.innerHTML = `<i class="ph ${visIconClass}"></i>`;
                }
            }
        });
        return;
    }

    // Full Re-render
    headersList.innerHTML = '';

    if (layers.length === 0) {
        headersList.innerHTML = '<p class="text-xs text-gray-400 text-center mt-4">No layers.</p>';
        return;
    }

    layers.forEach((layer, index) => {
        const div = document.createElement('div');
        const isSelected = selectedIds.includes(layer.id);

        div.setAttribute('draggable', 'true');
        div.setAttribute('data-id', layer.id);

        // Add DnD
        div.addEventListener('dragstart', handleDragStart, false);
        div.addEventListener('dragenter', handleDragEnter, false);
        div.addEventListener('dragover', handleDragOver, false);
        div.addEventListener('dragleave', handleDragLeave, false);
        div.addEventListener('drop', handleDrop, false);
        div.addEventListener('dragend', handleDragEnd, false);

        div.onclick = (e) => {
            store.setState({ editor: { ...state.editor, selectedLayerIds: [layer.id] } });
        };

        div.className = `flex items-center justify-between p-1 rounded-md text-xs mb-0.5 cursor-pointer select-none group border border-transparent transition-colors
            ${isSelected ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'}`;

        const leftContent = document.createElement('div');
        leftContent.className = `flex items-center gap-2 overflow-hidden w-full ${!layer.visible ? 'opacity-40 grayscale' : (layer.locked ? 'opacity-70' : '')}`;

        const grab = document.createElement('span');
        grab.className = "cursor-grab text-gray-400 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity text-[10px]";
        grab.textContent = "⋮⋮";
        leftContent.appendChild(grab);

        const typeIcon = TYPE_ICONS[layer.type] || 'ph-bounding-box';
        const icon = document.createElement('i');
        icon.className = `ph ${typeIcon} text-gray-500 text-xs ${layer.locked ? 'text-amber-500' : ''}`;
        leftContent.appendChild(icon);

        // Name Span
        leftContent.appendChild(createNameSpan(layer));

        div.appendChild(leftContent);

        const actions = document.createElement('div');
        actions.className = `flex items-center gap-1 opacity-0 group-hover:opacity-100 ${isSelected || !layer.visible || layer.locked ? 'opacity-100' : ''} transition-opacity`;

        const lockBtn = document.createElement('button');
        const lockIcon = layer.locked ? 'ph-lock-key' : 'ph-lock-key-open';
        lockBtn.className = `w-5 h-5 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/20 transition-colors ${layer.locked ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-gray-400'}`;
        lockBtn.title = layer.locked ? 'Unlock' : 'Lock';
        lockBtn.innerHTML = `<i class="ph ${lockIcon}"></i>`;
        lockBtn.onclick = (e) => {
            e.stopPropagation();
            store.updateLayer(layer.id, { locked: !layer.locked });
        };
        actions.appendChild(lockBtn);

        const visBtn = document.createElement('button');
        const visIcon = layer.visible ? 'ph-eye' : 'ph-eye-closed';
        visBtn.className = `w-5 h-5 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/20 transition-colors ${!layer.visible ? 'text-gray-400' : 'text-gray-400'}`;
        visBtn.title = layer.visible ? 'Hide' : 'Show';
        visBtn.innerHTML = `<i class="ph ${visIcon}"></i>`;
        visBtn.onclick = (e) => {
            e.stopPropagation();
            store.updateLayer(layer.id, { visible: !layer.visible });
        };
        actions.appendChild(visBtn);

        div.appendChild(actions);
        headersList.appendChild(div);
    });
}


window.moveLayer = (id, direction) => {
    // direction -1 = Up (Visual) => To Front => Higher Index
    // direction 1 = Down (Visual) => To Back => Lower Index

    const state = store.get();
    const layers = [...state.layers];
    const index = layers.findIndex(l => l.id === id);
    if (index === -1) return;

    const newIndex = index - direction; // because -1 was passed for Up. index - (-1) = +1. Correct.

    if (newIndex >= 0 && newIndex < layers.length) {
        // Swap
        [layers[index], layers[newIndex]] = [layers[newIndex], layers[index]];
        store.setState({ layers });
    }
};
