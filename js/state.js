import { deepClone, generateId, measureContent } from './utils.js';

/**
 * Global State Management
 * Adheres strictly to the user-provided JSON schema.
 */

// Layer Type Mapping (Key -> Class Name / Description)
export const LAYER_TYPES = {
    SVG: '0',
    TEXT: '1',
    IMAGE: '2',
    BACKGROUND: '3',
    MASK: '4',
    GROUP: '5'
};


// Initial Default State matching the Schema
const INITIAL_STATE = {
    meta: {
        id: generateId('doc'),
        version: "1.0.0",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sourceGroup: "SM" // Example default
    },
    canvas: {
        width: 1080,
        height: 1080,
        dpi: 72,
        zoom: 0.5,
        pan: { x: 0, y: 0 },
        unit: 'px' // New default unit
    },
    document: {
        title: "Untitled Design",
        format: "social-media-square",
        category: "marketing",
        industries: [],
        keywords: [],
        suitability: []
    },
    layers: [
        {
            id: generateId('layer'),
            name: "Background",
            type: LAYER_TYPES.BACKGROUND,
            visible: true,
            locked: true,
            opacity: 1,
            transform: {
                position: { x: 0.5, y: 0.5 },
                size: { width: 1, height: 1 },
                rotation: 0
            },
            content: {
                type: "background",
                fill: {
                    type: "solid",
                    colors: ["#F3F4F6"], // Light gray default
                    angle: 0
                }
            }
        },
        {
            id: generateId('layer'),
            name: "Main Title",
            type: LAYER_TYPES.TEXT,
            visible: true,
            locked: false,
            opacity: 1,
            transform: {
                position: { x: 0.5, y: 0.3 },
                size: { width: 0.8, height: 0.2 },
                rotation: 0
            },
            content: {
                type: "text",
                align: "center",
                capitalize: true,
                lines: [
                    {
                        text: "Design Editor",
                        font: "Inter",
                        fontSize: 80,
                        bold: true,
                        italic: false,
                        color: "#111827",
                        lineHeight: 1.1,
                        letterSpacing: -2
                    }
                ]
            }
        },
        {
            id: generateId('layer'),
            name: "Subtitle",
            type: LAYER_TYPES.TEXT,
            visible: true,
            locked: false,
            opacity: 1,
            transform: {
                position: { x: 0.5, y: 0.45 },
                size: { width: 0.6, height: 0.1 },
                rotation: 0
            },
            content: {
                type: "text",
                align: "center",
                capitalize: false,
                lines: [
                    {
                        text: "Create stunning visuals in seconds",
                        font: "Inter",
                        fontSize: 32,
                        bold: false,
                        italic: false,
                        color: "#4B5563",
                        lineHeight: 1.4,
                        letterSpacing: 0
                    }
                ]
            }
        },
        {
            id: generateId('layer'),
            name: "Demo Image",
            type: LAYER_TYPES.IMAGE,
            visible: true,
            locked: false,
            opacity: 1,
            transform: {
                position: { x: 0.5, y: 0.7 },
                size: { width: 0.4, height: 0.3 }, // Aspect ratio might rely on actual image
                rotation: 0
            },
            content: {
                type: "image",
                src: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop" // Abstract nice image
            }
        },
        {
            id: generateId('layer'),
            name: "Badge Icon",
            type: LAYER_TYPES.SVG,
            visible: true,
            locked: false,
            opacity: 1,
            transform: {
                position: { x: 0.85, y: 0.15 }, // Top right corner
                size: { width: 0.1, height: 0.1 },
                rotation: 15
            },
            content: {
                type: "svg",
                xml: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3B82F6"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" /></svg>`,
                color: "#3B82F6"
            }
        },
        {
            id: generateId('layer'),
            name: "Star Icon",
            type: LAYER_TYPES.SVG,
            visible: true,
            locked: false,
            opacity: 1,
            transform: {
                position: { x: 0.1, y: 0.15 },
                size: { width: 0.15, height: 0.15 },
                rotation: -10
            },
            content: {
                type: "svg",
                xml: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F59E0B"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" /></svg>`,
                color: "#F59E0B"
            }
        }
    ],
    assets: {
        images: {},
        fonts: {
            "Inter": { source: "google", loaded: true }
        }
    },
    editor: {
        selectedLayerIds: [],
        hoveredLayerId: null,
        ui: {
            theme: "light"
        }
    }
};

class EditorState {
    constructor() {
        // Load from localStorage or use default
        try {
            const saved = localStorage.getItem('design_editor_state');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Merge with defaults to ensure new keys (like canvas.pan) exist
                // Simple 1-level deep merge for known structures
                this.state = {
                    ...INITIAL_STATE,
                    ...parsed,
                    canvas: { ...INITIAL_STATE.canvas, ...parsed.canvas },
                    meta: { ...INITIAL_STATE.meta, ...parsed.meta }
                };
            } else {
                this.state = deepClone(INITIAL_STATE);
            }
        } catch (e) {
            console.error("Failed to load state", e);
            this.state = deepClone(INITIAL_STATE);
        }

        this.listeners = [];

        // Ensure defaults if loaded state is old/broken (basic check)
        if (!this.state.layers) this.state = deepClone(INITIAL_STATE);

        // History Management
        // We initialize history with the current state so we can undo back to it if needed
        // or simply start fresh. Standard is start with [initial].
        this.history = [deepClone(this.state)];
        this.historyIndex = 0;
        this.maxHistory = 50; // Limit history size
    }

    /**
     * Get the current state
     */
    get() {
        return this.state;
    }

    /**
     * Get a specific layer by ID
     */
    getLayer(id) {
        return this.state.layers.find(l => l.id === id);
    }

    /**
     * Update the state based on a partial update or function
     * @param {Object|Function} update - Partial state object or function(prevState) => newState
     * @param {Boolean} save - Whether to persist to localStorage (default true)
     * @param {Boolean} addToHistory - Whether to record this state in history (default true)
     */
    setState(update, save = true, addToHistory = true) {
        const prevState = deepClone(this.state);
        let nextState;

        if (typeof update === 'function') {
            const partial = update(prevState);
            nextState = { ...prevState, ...partial };
        } else {
            nextState = { ...prevState, ...update };
        }

        // Always update metadata
        nextState.meta.updatedAt = new Date().toISOString();

        // 1. Update Current State
        this.state = nextState;

        // 2. Add to History (if requested)
        if (addToHistory) {
            // Remove any future history if we were in the middle of the stack
            if (this.historyIndex < this.history.length - 1) {
                this.history = this.history.slice(0, this.historyIndex + 1);
            }

            // Push new state
            this.history.push(deepClone(this.state));
            this.historyIndex++;

            // Limit
            if (this.history.length > this.maxHistory) {
                this.history.shift();
                this.historyIndex--;
            }
        }

        if (save) {
            this.persist();
        }

        this.notify();
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            // Restore state from history
            this.state = deepClone(this.history[this.historyIndex]);
            this.persist();
            this.notify();
            console.log("Undo", this.historyIndex);
        } else {
            console.log("Nothing to undo");
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            // Restore state from history
            this.state = deepClone(this.history[this.historyIndex]);
            this.persist();
            this.notify();
            console.log("Redo", this.historyIndex);
        } else {
            console.log("Nothing to redo");
        }
    }

    /**
     * Specialized method to update a specific layer
     */
    updateLayer(layerId, changes, addToHistory = true) {
        const layers = deepClone(this.state.layers);
        const index = layers.findIndex(l => l.id === layerId);

        if (index !== -1) {
            // Merge changes into the layer
            // Handle nested updates carefully if needed, e.g. transform
            // For now, we do a shallow merge of properties, but if 'transform' is passed, 
            // it replaces the old transform object unless merged manually.

            // To be safe with deep structures like transform.position, we can do a deep merge helper
            // or just expect the caller to pass the full object for that property.
            // Let's implement a simple recursive merge for critical props if needed,
            // or rely on caller to spread.

            // Merge changes first to get the potential new state
            const oldLayer = deepClone(layers[index]);
            // Apply changes to the layer in the list
            Object.keys(changes).forEach(key => {
                layers[index][key] = changes[key];
            });

            const newLayer = layers[index];

            // Check if we need to recalculate dimensions
            // Trigger if content changed, or if it's text and style props changed.
            // Simplified: If 'content' key is in changes, check dimensions.
            if (changes.content) {
                const measured = measureContent(newLayer);

                if (measured) {
                    const canvasW = this.state.canvas.width;
                    const canvasH = this.state.canvas.height;

                    if (newLayer.type === LAYER_TYPES.TEXT) {
                        // Enforce exact fit for text
                        // Convert pixel measures back to normalized 0-1
                        newLayer.transform.size.width = measured.width / canvasW;
                        newLayer.transform.size.height = measured.height / canvasH;
                    }
                    else if ((newLayer.type === LAYER_TYPES.IMAGE || newLayer.type === LAYER_TYPES.SVG) && measured.ratio) {
                        // For Image/SVG, enforce aspect ratio.
                        // We usually want to keep the current width and adjust height, 
                        // unless it's a fresh insert (which this might be if it's a full content replacement).

                        // If src/xml changed significantly, we might want to reset ratio.
                        // Current logic: Maintain Width, adjust Height to match Aspect Ratio.
                        const currentW = newLayer.transform.size.width; // Normalized
                        // targetH = currentW / ratio
                        // But wait, ratio = w / h. so h = w / ratio.
                        // Correct.
                        // However, since we work in normalized space, we must account for canvas non-squareness.
                        // Real Ratio = (W_norm * CanvasW) / (H_norm * CanvasH)
                        // measurements are in pixels (or ratio of pixels).

                        // Pixel dimensions:
                        const pxW = currentW * canvasW;
                        const pxH = pxW / measured.ratio;

                        newLayer.transform.size.height = pxH / canvasH;
                    }
                }
            }

            this.setState({ layers }, true, addToHistory);
        }
    }

    addLayer(layer) {
        // Helper to push a new layer with history
        const layers = [...this.state.layers, layer];
        this.setState({ layers });
    }

    /**
     * Subscribe to state changes
     * @param {Function} callback 
     * @returns {Function} unsubscribe
     */
    subscribe(callback) {
        this.listeners.push(callback);
        // Unsubscribe function
        return () => {
            this.listeners = this.listeners.filter(listener => listener !== callback);
        };
    }

    notify() {
        this.listeners.forEach(cb => cb(this.state));
    }

    persist() {
        try {
            localStorage.setItem('design_editor_state', JSON.stringify(this.state));
        } catch (e) {
            console.warn("Quota exceeded or storage disabled", e);
        }
    }

    reset() {
        this.state = deepClone(INITIAL_STATE);
        this.history = [deepClone(this.state)];
        this.historyIndex = 0;
        this.persist();
        this.notify();
    }
}

export const store = new EditorState();
export default store;
