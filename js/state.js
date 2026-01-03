import { deepClone, generateId } from './utils.js';

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
    MASK: '4'
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
            this.state = saved ? JSON.parse(saved) : deepClone(INITIAL_STATE);
        } catch (e) {
            console.error("Failed to load state", e);
            this.state = deepClone(INITIAL_STATE);
        }

        this.listeners = [];

        // Ensure defaults if loaded state is old/broken (basic check)
        if (!this.state.layers) this.state = deepClone(INITIAL_STATE);
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
     */
    setState(update, save = true) {
        const prevState = deepClone(this.state);

        if (typeof update === 'function') {
            const newState = update(prevState);
            this.state = { ...prevState, ...newState }; // Shallow merge at root
        } else {
            // For deep merging, we might need lodash.merge, but strictly 
            // relying on specific 'reducers' or direct assignment is safer in vanilla.
            // Here we assume 'update' contains top-level keys like 'canvas', 'layers'.
            this.state = { ...prevState, ...update };
        }

        // Always update metadata
        this.state.meta.updatedAt = new Date().toISOString();

        if (save) {
            this.persist();
        }

        this.notify();
    }

    /**
     * Specialized method to update a specific layer
     */
    updateLayer(layerId, changes) {
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

            // Simpler: Caller provides full objects for sub-properties.
            Object.keys(changes).forEach(key => {
                layers[index][key] = changes[key];
            });

            this.setState({ layers });
        }
    }

    /**
     * Subscribe to state changes
     * @param {Function} callback 
     * @returns {Function} unsubscribe
     */
    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
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
        this.persist();
        this.notify();
    }
}

export const store = new EditorState();
export default store;
