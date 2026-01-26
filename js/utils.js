/**
 * Utility functions for the Design Editor
 */

/**
 * Generates a unique ID
 */
export function generateId(prefix = 'el') {
    return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Debounce function to limit execution rate
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Clamps a number between min and max
 */
export function clamp(num, min, max) {
    return Math.min(Math.max(num, min), max);
}

/**
 * Deep clone an object
 */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Convert degrees to radians
 */
export function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
export function toDegrees(radians) {
    return radians * (180 / Math.PI);
}

/**
 * Parse a font string (e.g. "bold 12px Arial")
 * Returns object with properties
 */
export function parseFontString(font) {
    // Basic parser, might need enhancement
    // Assumes standard canvas font string format
    return font;
}

// Internal measurement canvas
let _measureCtx = null;
function getMeasureCtx() {
    if (!_measureCtx) {
        const canvas = document.createElement('canvas');
        _measureCtx = canvas.getContext('2d');
    }
    return _measureCtx;
}

/**
 * Measure Content Dimensions
 * @param {Object} layer - The layer object
 * @returns {Object|null} - { width, height } in design pixels, or null if not measurable yet
 */
export function measureContent(layer) {
    if (!layer || !layer.content) return null;

    if (layer.type === '1') { // TEXT (Using string key from state.js logic)
        return measureText(layer);
    } else if (layer.type === '2') { // IMAGE
        return measureImage(layer);
    } else if (layer.type === '0') { // SVG
        return measureSvg(layer);
    }

    return null;
}

function measureText(layer) {
    const ctx = getMeasureCtx();
    const content = layer.content;
    if (!content.lines) return null;

    let maxWidth = 0;
    let totalHeight = 0;

    content.lines.forEach(line => {
        const style = line.italic ? 'italic' : 'normal';
        const weight = line.bold ? 'bold' : 'normal';
        const family = line.font || 'Inter, sans-serif';
        const fontSize = line.fontSize || 16;
        const lineHeight = line.lineHeight || 1.2;

        ctx.font = `${style} ${weight} ${fontSize}px "${family}"`;

        let textStr = line.text;
        if (content.capitalize) {
            textStr = textStr.toUpperCase();
        }

        const metrics = ctx.measureText(textStr);
        // Use actual bounding box if available for more precision, but width is standard
        const w = metrics.width;

        if (w > maxWidth) maxWidth = w;

        // Height is purely based on line-height logic in renderer
        totalHeight += fontSize * lineHeight;
    });

    // Add a tiny buffer to width to prevent wrapping issues due to sub-pixel rendering differences
    return { width: maxWidth + 2, height: totalHeight };
}

function measureImage(layer) {
    const src = layer.content.src;
    if (!src) return null;

    // Check if image is in global cache (populated by canvas.js)
    if (window.imageCache && window.imageCache[src] && window.imageCache[src].complete) {
        const img = window.imageCache[src];
        return {
            width: img.naturalWidth,
            height: img.naturalHeight,
            ratio: img.naturalWidth / img.naturalHeight
        };
    }

    // If not loaded, we can't synchronously measure. 
    // Return null, handled by async loader elsewhere or ignored until load.
    return null;
}

function measureSvg(layer) {
    const xml = layer.content.xml;
    if (!xml) return null;

    // simplistic regex parse for viewBox
    const vbMatch = xml.match(/viewBox=["']([^"']*)["']/);
    if (vbMatch && vbMatch[1]) {
        const parts = vbMatch[1].split(/[\s,]+/).map(parseFloat);
        if (parts.length === 4) {
            // [x, y, w, h]
            return { width: parts[2], height: parts[3], ratio: parts[2] / parts[3] };
        }
    }

    // Fallback: try width/height attributes
    const wMatch = xml.match(/width=["']([^"']*)["']/);
    const hMatch = xml.match(/height=["']([^"']*)["']/);

    if (wMatch && hMatch) {
        const w = parseFloat(wMatch[1]);
        const h = parseFloat(hMatch[1]);
        if (!isNaN(w) && !isNaN(h)) {
            return { width: w, height: h, ratio: w / h };
        }
    }

    return null;
}

/**
 * Global Tooltip Helper
 */
export function showTooltip(el, text) {
    el.setAttribute('data-tooltip', text);
    el.addEventListener('mouseenter', handleTooltipEnter);
    el.addEventListener('mouseleave', handleTooltipLeave);
}

let tooltipEl = null;

function handleTooltipEnter(e) {
    if (tooltipEl) {
        tooltipEl.remove();
        tooltipEl = null;
    }

    // Check if we are hovering a child of a hovered element?
    // Actually, mouseenter doesn't bubble, but if we have nested elements with tooltips,
    // the inner one triggers, outer might have triggered?
    // We just ensure we clear any global tooltip.

    tooltipEl = document.createElement('div');
    tooltipEl.className = 'fixed bg-white/90 dark:bg-[#3A3A3C]/90 backdrop-blur-md text-[#1D1D1F] dark:text-[#F5F5F7] text-[11px] font-semibold px-2.5 py-1 rounded-lg shadow-xl border border-black/5 dark:border-white/10 z-[9999] pointer-events-none opacity-0 transition-opacity whitespace-nowrap transform scale-95 transition-transform duration-150';
    document.body.appendChild(tooltipEl);

    tooltipEl.textContent = e.target.getAttribute('data-tooltip');

    // Position
    const rect = e.target.getBoundingClientRect();
    const top = rect.top - 30;
    const left = rect.left + (rect.width / 2) - (tooltipEl.offsetWidth / 2); // This might be 0 initially if not rendered?

    // We need to append first to get width? yes done above.

    // Recalc position after append
    tooltipEl.style.top = `${rect.top - 34}px`; // slightly higher
    tooltipEl.style.left = `${rect.left + (rect.width / 2) - (tooltipEl.offsetWidth / 2)}px`;

    requestAnimationFrame(() => {
        if (tooltipEl) {
            tooltipEl.classList.remove('opacity-0', 'scale-95');
            tooltipEl.classList.add('scale-100');
        }
    });
}

function handleTooltipLeave() {
    if (tooltipEl) {
        const el = tooltipEl; // Capture ref
        el.classList.add('opacity-0', 'scale-95');
        el.classList.remove('scale-100');

        // Remove after transition
        setTimeout(() => {
            if (el && el.parentNode) {
                el.remove();
            }
        }, 150);

        // Clear global ref immediately so new ones can take over
        if (tooltipEl === el) {
            tooltipEl = null;
        }
    }
}

/**
 * Scrub Input Helper
 */
export function createScrubInput(iconClass, tooltip, value, step, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'group/input relative flex flex-col pt-0.5';

    // Label container (Icon Only & Compact)
    const labelContainer = document.createElement('div');
    // Transparent by default, subtle bg on hover. No border.
    // Reduced size to w-6 h-6
    labelContainer.className = 'w-6 h-6 flex items-center justify-center text-gray-500 dark:text-gray-400 cursor-ew-resize select-none hover:text-blue-500 dark:hover:text-blue-400 transition-colors rounded-md hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transform duration-75';

    // Add Tooltip back
    showTooltip(labelContainer, tooltip);

    // If label starts with 'ph-', it's an icon. Otherwise, text.
    if (iconClass.startsWith('ph-')) {
        labelContainer.innerHTML = `<i class="ph ${iconClass} text-sm"></i>`; // Reduced icon size
    } else {
        // Text Label (W, H)
        labelContainer.innerHTML = `<span class="text-[10px] font-bold font-mono">${iconClass}</span>`; // Reduced font size
    }

    // Virtual Slider Logic
    let startX, startVal;

    labelContainer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        startX = e.clientX;
        startVal = parseFloat(value);
        document.body.style.cursor = 'ew-resize';
        labelContainer.classList.add('text-blue-500', 'bg-blue-50', 'dark:bg-blue-900/30');

        const input = wrapper.querySelector('input'); // Find input in scope

        const onMove = (me) => {
            const dx = me.clientX - startX;
            // Sensitivity
            const delta = dx * step;
            const newVal = startVal + delta;
            input.value = newVal.toFixed(step < 1 ? 2 : 0);
            onChange(parseFloat(input.value));
        };

        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.body.style.cursor = 'default';
            labelContainer.classList.remove('text-blue-500', 'bg-blue-50', 'dark:bg-blue-900/30');
            input.blur(); // Blur input if focused
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    // Layout: Row (Icon | Input)
    const row = document.createElement('div');
    row.className = 'flex items-center gap-0'; // Reduced gap to 0
    row.appendChild(labelContainer);



    // Input (Borderless, Hover Effect)
    const input = document.createElement('input');
    input.type = 'number';
    input.step = step;
    input.value = parseFloat(value).toFixed(step < 1 ? 2 : 0);
    // Base: Transparent. Hover: Subtle Gray. Focus: Light Gray + Ring? No, specific "Pro" look usually just text highlighter.
    // Let's go with: Transparent default. Hover: bg-gray-100. Focus: bg-white + ring.
    // Reduced width to w-10
    input.className = 'w-10 bg-transparent hover:bg-gray-100 dark:hover:bg-white/5 focus:bg-gray-100 dark:focus:bg-white/10 rounded-md transition-colors px-0.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 focus:outline-none text-right tabular-nums tracking-tight placeholder-transparent border border-transparent focus:border-transparent';

    // Select all on focus for easy editing
    input.onfocus = () => input.select();

    input.onchange = (e) => onChange(parseFloat(e.target.value));
    // Support Enter key
    input.onkeydown = (e) => {
        if (e.key === 'Enter') input.blur();
    };

    row.appendChild(input);
    wrapper.appendChild(row);
    return wrapper;
}
