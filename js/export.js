import store, { LAYER_TYPES } from './state.js';


export async function exportToImage(format = 'png') {
    const state = store.get();
    const { width, height, dpi } = state.canvas;

    // create off-screen canvas (at full resolution?)
    // If output is for web verify, maybe screen res is fine.
    // If for print, use dpi. 
    // Let's use internal dpi (state.canvas.dpi).

    // Create a temporary canvas
    const canvas = document.createElement('canvas');
    // For high-res export, we might want scale factor.
    // Default to 1 (screen px) or usage of dpi?
    // standard web dpi 72. If dpi=300, scale = 300/72 ~ 4.16

    const scale = dpi / 72; // basic logical assumption
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    // Draw background (white default if no bg layer)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Filter invisible layers
    const layers = state.layers.filter(l => l.visible);

    // Sort layers (back to front) - state.layers is normally back-to-front? 
    // Yes. Array order: 0 is bottom, N is top.

    // Load all images first?
    // renderLayer is synchronous but ImageElement relies on cached images.
    // They should be loaded if we are viewing them.
    // Ideally we should wait for promises.

    // We need to refactor renderLayer to be usable here easily.
    // Assuming renderLayer takes (ctx, layer) and draws.

    for (const layer of layers) {
        // We need to pass a context that behaves like the screen context?
        // renderLayer in canvas.js assumes normalized coords * canvas.width.
        // If we scaled the context, canvas.width is huge.
        // Wait, renderLayer logic: 
        // const px = pos.x * canvas.width;
        // If we passed the high-res canvas, px will be huge.
        // BUT we also scaled the ctx by `scale`. 
        // So drawing at "huge" coordinates with a scaled context = double scaling??

        // Correct approach:
        // Reset scale. 
        // Or pass the intended abstract dimensions (logical).

        // Let's rely on standard render logic.
        // If I use the same renderLayer:
        // It uses canvas.width.
        // If I pass this large canvas, canvas.width is scaled.
        // So layer.x * 3000 = 1500.
        // Drawing text at 1500. 
        // If I did ctx.scale(4,4), it draws at 6000. Double scale.

        // So: DO NOT scale ctx if renderLayer uses canvas.width/height directly.
        ctx.save();
        // However, text font size needs scaling?
        // layer.fontSize: 24. 
        // If renderLayer sets font = "24px Inter".
        // On a 3000px wide canvas, 24px is tiny.
        // So we DO need to scale render operations.

        // Actually best way: renderLayer should ideally take a "viewport" metadata 
        // OR we just use a trick:
        // Render at 1x scale (logical size), then ctx.scale handles resolution.
        // BUT canvas.js utilizes `canvas.width` to calculate positions.
        // If I pass the large canvas, it calculates large positions.
        // The text size is the issue. "24px" is literal pixels.

        // Let's modify renderLayer to optionally accept `scaleFactor`?
        // Or simpler:
        // Set canvas to logical size. Export. Resize? No, blurry.

        // Proper way:
        // Pass a "mock" canvas object that provides logical Width/Height but is backed by high-res?
        // Or just let canvas.js handle a 'dpiScale' param.

        // Since I can't easily change canvas.js signature right now without breaking `main` loop,
        // I will duplicate a simple render loop here or create a specialized one.

        // Actually canvas.js uses `canvas.width`...
        // If I define `ctx`... canvas.js calls `ctx.fillText`.

        // FIX: In `canvas.js`, `renderText` uses `layer.content.lines[x].fontSize`.
        // It does `ctx.font = ... ${fontSize}px ...`.
        // This is always screen pixels.

        // So if I want high res:
        // 1. canvas.width = width * scale
        // 2. layer.x * canvas.width -> scaled position (Correct).
        // 3. fontSize -> needs to be multiplied by scale manually.

        renderLayerForExport(ctx, layer, canvas.width, canvas.height, scale);

        ctx.restore();
    }

    // Download
    const dataUrl = canvas.toDataURL(`image/${format}`, 0.9);
    const link = document.createElement('a');
    link.download = `design-${state.meta.id}.${format}`;
    link.href = dataUrl;
    link.click();
}


/* --- Export Renderer (Simplified version of canvas.js, adapted for scaling) --- */
import { toRadians } from './utils.js';

function renderLayerForExport(ctx, layer, canvasW, canvasH, scale) {
    const { position, size, rotation } = layer.transform;

    const x = position.x * canvasW;
    const y = position.y * canvasH;
    const w = size.width * canvasW;
    const h = size.height * canvasH;

    ctx.save();

    // Transform
    ctx.translate(x, y);
    ctx.rotate(toRadians(rotation));
    ctx.globalAlpha = layer.opacity;

    // Render Content
    if (layer.type === LAYER_TYPES.BACKGROUND || layer.content.type === 'background') {
        renderBackground(ctx, layer, w, h);
    } else if (layer.type === LAYER_TYPES.TEXT) {
        renderText(ctx, layer, w, h, scale);
    } else if (layer.type === LAYER_TYPES.IMAGE) {
        // Need to load image synchronously or handle async?
        // This export function is async.
        // But we can't await inside sync render loop easily unless we preload.
        // Assuming images are browser-cached if already viewed.
        renderImage(ctx, layer, w, h);
    }

    ctx.restore();
}

function renderBackground(ctx, layer, w, h) {
    const fill = layer.style?.fill || layer.content.fill;
    if (fill && fill.colors && fill.colors.length > 0) {
        ctx.fillStyle = fill.colors[0];
        ctx.fillRect(-w / 2, -h / 2, w, h);
    }
}

function renderText(ctx, layer, w, h, scale) {
    const content = layer.content;
    const lines = content.lines;

    let totalHeight = 0;
    // Pre-calc total height for vertical centering?
    // Canvas text baseline is tricky. 
    // Let's assume implied simple stacking.

    // Calculate line heights
    const lineMetrics = lines.map(line => ({
        text: line.text,
        size: line.fontSize * scale, // SCALE FONT SIZE!
        lh: (line.lineHeight || 1.2) * (line.fontSize * scale),
        font: line.font || 'Inter',
        color: line.color || '#000000',
        align: content.align || 'left',
        bold: line.bold,
        italic: line.italic,
        spacing: (line.letterSpacing || 0) * scale,
        capitalize: content.capitalize
    }));

    totalHeight = lineMetrics.reduce((sum, l) => sum + l.lh, 0);
    let currentY = -totalHeight / 2 + (lineMetrics[0].lh / 2); // Start centered? Approx.

    lineMetrics.forEach(line => {
        let fontString = '';
        if (line.italic) fontString += 'italic ';
        if (line.bold) fontString += 'bold ';
        fontString += `${line.size}px "${line.font}", sans-serif`;

        ctx.font = fontString;
        ctx.fillStyle = line.color;
        ctx.textAlign = line.align;
        ctx.textBaseline = 'middle';

        // Spacing? ctx.letterSpacing is new API, support varies.
        if (ctx.letterSpacing !== undefined) {
            ctx.letterSpacing = `${line.spacing}px`;
        }

        let textStr = line.text;
        if (line.capitalize) textStr = textStr.toUpperCase();

        let posX = 0;
        if (line.align === 'left') posX = -w / 2;
        if (line.align === 'right') posX = w / 2;

        ctx.fillText(textStr, posX, currentY);

        currentY += line.lh;
    });
}

function renderImage(ctx, layer, w, h) {
    const src = layer.content.src;
    if (!src) return;

    // Retrieve image from cache or create new
    // We can't easily access the cachemap from canvas.js since it's not exported.
    // Create new image.
    const img = new Image();
    img.src = src;

    // If it's not loaded instantly, this will fail to draw.
    // In a real export, we must preload all images.
    // For this MVP, we hope it's cached.
    if (img.complete) {
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
    }
}

/**
 * Convert a URL/Blob to Base64
 * @param {string} url 
 * @returns {Promise<string>}
 */
async function urlToBase64(url) {
    if (url.startsWith('data:')) return url; // Already base64

    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn('Failed to convert image to base64, keeping URL:', url, e);
        return url;
    }
}

/**
 * Export Project State to JSON (with Base64 Images)
 */
export async function exportProject() {
    const state = store.get();

    // Deep clone to modify without affecting current state
    const exportState = JSON.parse(JSON.stringify(state));

    // Traverse layers and convert images
    const processLayer = async (layer) => {
        // Image Layer
        if (layer.type === LAYER_TYPES.IMAGE && layer.content.src) {
            try {
                const base64 = await urlToBase64(layer.content.src);
                layer.content.src = base64;
            } catch (err) {
                console.error(`Failed to export image layer ${layer.id}`, err);
            }
        }

        // Background Layer
        if (layer.type === LAYER_TYPES.BACKGROUND && layer.content.fill?.type === 'image' && layer.content.fill.image) {
            try {
                const base64 = await urlToBase64(layer.content.fill.image);
                layer.content.fill.image = base64;
            } catch (err) {
                console.error(`Failed to export background image`, err);
            }
        }

        // Deep traversal if groups existed (not yet), but future proofing logic would go here
    };

    // Parallel processing
    await Promise.all(exportState.layers.map(processLayer));

    // Also process assets if we were storing them in assets.images
    // Currently layers hold the src directly.

    // Generate File
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportState, null, 2));
    const link = document.createElement('a');
    link.href = dataStr;
    link.download = `project-${state.meta.id}.json`;
    link.click();
}
