import store from './state.js';
import { toDegrees } from './utils.js';

let activeOverlay = null;
let activeLayerId = null;

/**
 * Enters text edit mode for a specific layer.
 * Creates a textarea overlay over the canvas text.
 */
export function enterTextEditMode(layer, canvasRect) {
    if (activeOverlay) return; // Already editing

    const state = store.get();
    const { width: canvasW, height: canvasH, zoom } = state.canvas;

    // Calculate pixel position and size
    // The layer transform is normalized (0-1)
    const t = layer.transform;
    const lW = t.size.width * (canvasW * zoom);
    const lH = t.size.height * (canvasH * zoom);
    const lX = t.position.x * (canvasW * zoom);
    const lY = t.position.y * (canvasH * zoom);

    // Create Textarea
    const textarea = document.createElement('textarea');
    activeOverlay = textarea;
    activeLayerId = layer.id;

    // Styling to match Canvas Text
    textarea.style.position = 'absolute';
    // Center alignment requires offsetting left/top by half width/height
    textarea.style.left = `${lX - lW / 2}px`;
    textarea.style.top = `${lY - lH / 2}px`;
    textarea.style.width = `${lW}px`;
    textarea.style.height = `${lH}px`;

    // Rotation
    textarea.style.transform = `rotate(${t.rotation}deg)`;
    textarea.style.transformOrigin = 'center center';

    // Font Styles
    // Assumes uniform style from first line for MVP
    const firstLine = layer.content.lines[0];
    textarea.style.fontFamily = firstLine.font || 'Inter, sans-serif';
    // Scale font size by zoom since container is now physically sized
    textarea.style.fontSize = (firstLine.fontSize * zoom) + 'px';
    // Wait, canvas rendering uses `fontSize` directly.  
    // If the canvas is scaled via CSS transform (zoom), the overlay needs to be inside the scaled container?
    // OR we need to adjust for zoom.

    // Check Zoom/Scale
    // The `canvasRect` passed in should be the onscreen size? 
    // `interactions.js` usually works with internal canvas structure.
    // Let's assume we append to the `canvas-container` which handles the zoom transform itself?
    // If `canvas-container` has `transform: scale(zoom)`, then appending to it means 
    // we use "Design Pixels".
    // Let's verify where we append.

    textarea.style.fontWeight = firstLine.bold ? 'bold' : 'normal';
    textarea.style.fontStyle = firstLine.italic ? 'italic' : 'normal';
    textarea.style.color = firstLine.color || '#000000';
    textarea.style.textAlign = layer.content.align || 'left';
    // LineHeight is usually a multiplier (1.2), but if it was px, we'd scale it.
    // If it's unitless in CSS, it uses the scaled font-size, so 1.2 is fine!
    // But if we calculated it as pixels in canvas, we need to match?
    // Canvas: totalHeight += fontSize * lineHeight. 
    // CSS: line-height: 1.2. (Multiplies by font-size).
    // So if font-size is scaled, line-height scales auto. Perfect.
    textarea.style.lineHeight = firstLine.lineHeight || 1.2;
    textarea.style.letterSpacing = ((firstLine.letterSpacing || 0) * zoom) + 'px';

    // Essential Overrides
    textarea.style.background = 'transparent';
    textarea.style.border = '1px dashed #3effff'; // Visual cue
    textarea.style.outline = 'none';
    textarea.style.padding = '0';
    textarea.style.margin = '0';
    textarea.style.resize = 'none';
    textarea.style.overflow = 'hidden';
    textarea.style.whiteSpace = 'pre-wrap'; // Preserve newlines

    if (layer.content.capitalize) {
        textarea.style.textTransform = 'uppercase';
    }

    // Content
    textarea.value = layer.content.lines.map(l => l.text).join('\n');

    // Append to Container (Zoom context)
    const container = document.getElementById('canvas-container');
    container.appendChild(textarea);

    // Auto-resize handler
    const resize = () => {
        textarea.style.height = 'auto'; // Reset to calculate scrollHeight
        const newHeight = textarea.scrollHeight;
        textarea.style.height = `${newHeight}px`;

        // Re-center vertically to match canvas rendering which centers text in the box
        // original center Y = lY. New top = lY - newHeight / 2
        textarea.style.top = `${lY - newHeight / 2}px`;
    };

    textarea.addEventListener('input', resize);

    // Initial resize to fit content (if it differs from box size, though normally it should match)
    // resize(); 
    // Actually, don't run resize immediately, rely on passed size to avoid jump, 
    // but the passed size might clip if text was already larger than box? 
    // For now, trust the layer size is correct for existing content.

    textarea.focus();

    // Event Listeners
    textarea.addEventListener('blur', saveAndExit);
    textarea.addEventListener('keydown', (e) => {
        // Stop propagation to prevent deleting layer with Backspace or other shortcuts
        e.stopPropagation();

        if (e.key === 'Escape') {
            cancelEdit();
        }
        // Cmd+Enter to Save
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            saveAndExit();
            e.preventDefault();
        }
    });

    // Hide original text
    store.updateLayer(activeLayerId, {
        content: {
            ...layer.content,
            _isEditing: true
        }
    });
}

function saveAndExit() {
    if (!activeOverlay || !activeLayerId) return;

    const newText = activeOverlay.value;
    const lines = newText.split('\n');

    // Calculate new height based on the final textarea height
    // We can't trust activeOverlay.clientHeight if it was 'auto' or had padding issues, 
    // but with our resize logic it should be explicit pixels.
    // However, safest is to re-measure or just use the scrollHeight from the element.
    const finalPixelHeight = activeOverlay.scrollHeight;

    const state = store.get();
    const { height: canvasH, zoom } = state.canvas;
    const layer = state.layers.find(l => l.id === activeLayerId);

    if (layer) {
        const baseStyle = layer.content.lines[0];

        const newLines = lines.map((textLine, index) => {
            // Try to keep style of corresponding existing line, else base style
            const existing = layer.content.lines[index];
            return {
                ...(existing || baseStyle),
                text: textLine
            };
        });

        // Update Height using normalized units
        // canvasH * zoom is the visible canvas height in pixels
        // But t.size.height is normalized to canvasH (logical).
        // scale = (canvasH * zoom)
        // so Normalized = Pixels / (canvasH * zoom)

        let newNormalizedHeight = finalPixelHeight / (canvasH * zoom);

        // Minimum height check?
        if (newNormalizedHeight < 0.01) newNormalizedHeight = 0.01;

        store.updateLayer(activeLayerId, {
            transform: {
                ...layer.transform,
                size: {
                    ...layer.transform.size,
                    height: newNormalizedHeight
                }
            },
            content: {
                ...layer.content,
                lines: newLines,
                _isEditing: false
            }
        });
    }

    cleanup();
}

function cancelEdit() {
    cleanup();
}

function cleanup() {
    if (activeOverlay) {
        activeOverlay.remove();
        activeOverlay = null;
    }
    if (activeLayerId) {
        // Ensure we unhide if cancelling/cleaning up
        const state = store.get();
        const layer = state.layers.find(l => l.id === activeLayerId);
        if (layer) {
            store.updateLayer(activeLayerId, {
                content: {
                    ...layer.content,
                    _isEditing: false
                }
            });
        }
    }
    activeLayerId = null;
}
