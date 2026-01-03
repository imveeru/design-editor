import store, { LAYER_TYPES } from './state.js';
import { toRadians } from './utils.js';

const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvas-container');

// Device Pixel Ratio for sharp text
const dpr = window.devicePixelRatio || 1;

// Image cache to prevent flickering
const imageCache = new Map();

/**
 * Main Render Loop
 */
export function renderCanvas() {
    const state = store.get();
    const { width, height } = state.canvas;

    // 1. Set internal resolution to Design resolution
    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }

    // Set display size (style)
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;

    // 2. Clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // 3. Render Layers
    state.layers.forEach(layer => {
        if (!layer.visible) return;
        renderLayer(ctx, layer, width, height);
    });
}


function renderLayer(ctx, layer, canvasW, canvasH) {
    const { position, size, rotation } = layer.transform;

    // Convert normalized coords to pixels
    const x = position.x * canvasW;
    const y = position.y * canvasH;
    const w = size.width * canvasW;
    const h = size.height * canvasH;

    ctx.save();

    // Transform
    ctx.translate(x, y);
    ctx.rotate(toRadians(rotation));
    ctx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1;

    // Offset for center origin
    const drawX = -w / 2;
    const drawY = -h / 2;

    // Render Content based on Type Key
    if (layer.type === LAYER_TYPES.BACKGROUND || layer.content.type === 'background') {
        renderBackground(ctx, layer, drawX, drawY, w, h);
    } else if (layer.type === LAYER_TYPES.TEXT) {
        renderText(ctx, layer, drawX, drawY, w, h);
    } else if (layer.type === LAYER_TYPES.IMAGE) {
        renderImage(ctx, layer, drawX, drawY, w, h);
    } else if (layer.type === LAYER_TYPES.SVG) {
        renderSvg(ctx, layer, drawX, drawY, w, h);
    }

    ctx.restore();
}

function renderBackground(ctx, layer, x, y, w, h) {
    const { fill } = layer.style || layer.content; // Fallback to either
    if (!fill) return;

    if (fill.type === 'solid' || (fill.colors && fill.colors.length > 0)) {
        ctx.fillStyle = fill.colors[0];
        ctx.fillRect(x, y, w, h);
    }
    // Gradients removed per request
}

function renderText(ctx, layer, x, y, w, h) {
    const content = layer.content;
    if (!content || !content.lines) return;

    // Default values
    const align = content.align || 'left';
    ctx.textAlign = align;

    // Determine X offset based on alignment within the width `w`
    let xOffset = 0;
    if (align === 'center') xOffset = w / 2;
    if (align === 'right') xOffset = w;

    // Calculate total height implies we need to measure all lines first
    let totalHeight = 0;
    const lineInfos = content.lines.map(line => {
        const fontSize = line.fontSize;
        const lineHeight = line.lineHeight || 1.2;
        const actualHeight = fontSize * lineHeight;
        totalHeight += actualHeight;
        return { ...line, actualHeight, fontSize };
    });

    // Vertical Center Logic
    // Start Y such that the block of text is centered in the Box height `h`
    // const startY = y + (h - totalHeight) / 2; 

    // Actually, usually text starts at top, but if we want it centered like Canva:
    // Canva usually aligns text top/middle/bottom based on specific setting.
    // If we assume "middle" alignment for the text block within the transform box:
    let currentY = y + (h - totalHeight) / 2;

    // If we want top alignment:
    // let currentY = y;

    lineInfos.forEach(line => {
        const style = line.italic ? 'italic' : 'normal';
        const weight = line.bold ? 'bold' : 'normal';
        const family = line.font || 'Inter, sans-serif';

        ctx.font = `${style} ${weight} ${line.fontSize}px "${family}"`;
        ctx.fillStyle = line.color || '#000000';
        ctx.textBaseline = 'top';

        // Letter Spacing (Modern Browsers)
        if (ctx.letterSpacing !== undefined) {
            ctx.letterSpacing = `${line.letterSpacing || 0}px`;
        } else {
            // Fallback: Manually spacing characters (Complex, skip for MVP)
            // Or set canvas style if supported via CSS filtering? No.
        }

        let textStr = line.text;
        if (content.capitalize) {
            textStr = textStr.toUpperCase();
        }

        // Draw
        // Adjust for lineHeight. 'top' baseline draws at currentY.
        // We want the text to be vertically centered in its line-height strip?
        // Usually: Draw at top of strip.
        ctx.fillText(textStr, x + xOffset, currentY);

        currentY += line.actualHeight;
    });

    // Reset letter spacing
    if (ctx.letterSpacing) ctx.letterSpacing = '0px';
}

function renderImage(ctx, layer, x, y, w, h) {
    // Check if image is loaded in AssetRegistry (store.state.assets.images)
    // Since we don't have async loading connected yet, we'll try to get it from DOM or cache.
    // For now, let's look for a specialized image cache or create one.

    // Simplification: We need an Image object.
    // We'll use a globally accessible cache for now or attach to store.
    const src = layer.content.src;
    if (!src) return;

    const img = window.imageCache ? window.imageCache[src] : null;

    if (img && img.complete) {
        // Handle Crop if present
        // layer.content.crop {x,y,w,h} normalized 0-1 relative to natural size
        if (layer.content.crop) {
            const c = layer.content.crop;
            const sx = c.x * img.naturalWidth;
            const sy = c.y * img.naturalHeight;
            const sWidth = c.width * img.naturalWidth;
            const sHeight = c.height * img.naturalHeight;

            ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);
        } else {
            ctx.drawImage(img, x, y, w, h);
        }
    } else {
        // Image not ready, trigger load if not started? 
        // This should be handled by an Asset Manager.
        // Draw placeholder.
        ctx.fillStyle = '#ccc';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#666';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Loading...', x + w / 2, y + h / 2);

        if (!window.imageCache) window.imageCache = {};
        if (!window.imageCache[src]) {
            const newImg = new Image();
            newImg.src = src;
            newImg.onload = () => {
                store.notify(); // Re-render when loaded
            };
            window.imageCache[src] = newImg;
        }
    }
}

function renderSvg(ctx, layer, x, y, w, h) {
    if (!layer.content.xml) return;

    // Cache Key: ID + Color + XML Content Hash (approx length for speed)
    const color = layer.content.color || '#000000';
    // Simple hash to detect XML changes without full verify
    const xmlSnippet = layer.content.xml.substring(0, 50) + layer.content.xml.length;
    const cacheKey = `svg_${layer.id}_${color}_${xmlSnippet}`;

    if (!window.imageCache) window.imageCache = {};

    if (!window.imageCache[cacheKey]) {
        // Inject Color: Replace fill/stroke or add style
        // Simplest resilient method for mono-color icons:
        // Add a style block to override fills? Or regex replace.
        // Regex is risky but effective for simple "fill='...'" attributes.
        // Let's force fill on the SVG root style if possible, but inner paths might override.
        // Best for icons: Regex replace all hex codes with new color?
        // Or standard: replace fill="#..." with fill="NEW".

        let svgContent = layer.content.xml;
        // Naive replace of fills. 
        // Note: Check if fill="none" needs to be preserved? Usually yes.
        // We only want to replace actual colors.
        // If the SVG has no fill attributes, it defaults to black.
        // We can inject `fill="${color}"` into the <svg> tag.

        if (svgContent.includes('<svg')) {
            // Inject fill attribute into root svg tag if not present, 
            // BUT CSS/Attributes on paths take precedence.
            // Let's try to replace existing fills first.
            svgContent = svgContent.replace(/fill="[^"]*"/g, `fill="${color}"`);
            // Also replace strokes?
            svgContent = svgContent.replace(/stroke="[^"]*"/g, `stroke="${color}"`);

            // If no fill in root, maybe add it? 
            // Only if we replaced nothing?
        }

        const encoded = encodeURIComponent(svgContent);
        const dataUri = `data:image/svg+xml;charset=utf-8,${encoded}`;

        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            img.isLoaded = true;
            // Find old cache entries for this layer and remove them to save memory?
            // Simplistic GC:
            Object.keys(window.imageCache).forEach(k => {
                if (k.startsWith(`svg_${layer.id}_`) && k !== cacheKey) {
                    delete window.imageCache[k];
                }
            });
            store.notify();
        };
        img.src = dataUri;
        window.imageCache[cacheKey] = img;
    }

    const cachedImg = window.imageCache[cacheKey];
    if (cachedImg && cachedImg.isLoaded) {
        ctx.drawImage(cachedImg, x, y, w, h);
    } else {
        // Placeholder or loading state
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(x, y, w, h);
        ctx.restore();
    }
}

// Subscribe to state changes to trigger render
// Subscribe to state changes to trigger render
store.subscribe(() => {
    requestAnimationFrame(renderCanvas);
});

// Initial Render
// window.addEventListener('load', render);
