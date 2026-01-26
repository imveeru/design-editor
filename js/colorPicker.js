
/**
 * Custom Color Picker Module
 * 
 * Features:
 * - Saturation/Brightness Box (HSV)
 * - Hue Slider
 * - Opacity Slider
 * - Hex Input
 */

// --- Color Utils ---

function hexToRgb(hex) {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{0,2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
        a: result[4] ? (parseInt(result[4], 16) / 255) : 1
    } : { r: 0, g: 0, b: 0, a: 1 };
}

function rgbToHex(r, g, b, a = 1) {
    const toHex = (c) => {
        const hex = Math.round(c).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };

    let hex = "#" + toHex(r) + toHex(g) + toHex(b);
    if (a < 1) {
        hex += toHex(a * 255);
    }
    return hex;
}

function rgbToHsv(r, g, b) {
    r /= 255, g /= 255, b /= 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, v = max;

    const d = max - min;
    s = max === 0 ? 0 : d / max;

    if (max === min) {
        h = 0; // achromatic
    } else {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return { h: h * 360, s, v };
}

function hsvToRgb(h, s, v) {
    let r, g, b;
    const i = Math.floor(h / 60);
    const f = h / 60 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }

    return { r: r * 255, g: g * 255, b: b * 255 };
}


// --- Picker Logic ---

let activePicker = null;

export function openColorPicker(triggerEl, initialColor, onChange) {
    // Close existing
    if (activePicker) {
        activePicker.remove();
        activePicker = null;
    }

    // Initialize State
    let rgba = hexToRgb(initialColor || '#000000');
    let hsv = rgbToHsv(rgba.r, rgba.g, rgba.b);
    let alpha = rgba.a;

    // Create Container
    const container = document.createElement('div');
    container.className = 'fixed bg-white dark:bg-[#1E1E1E] rounded-xl shadow-2xl border border-gray-200 dark:border-[#333] z-[100] w-64 p-3 animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-3';

    // Positioning logic
    const rect = triggerEl.getBoundingClientRect();
    const top = rect.bottom + 8;
    const left = Math.min(window.innerWidth - 270, Math.max(10, rect.left - 100)); // Center-ish but keep onscreen
    container.style.top = `${top}px`;
    container.style.left = `${left}px`;

    // Stops wheel prop from affecting canvas
    container.addEventListener('wheel', (e) => e.stopPropagation(), { passive: false });


    // --- 1. Saturation/Value Area ---
    const svArea = document.createElement('div');
    svArea.className = 'w-full h-32 rounded-lg relative cursor-crosshair overflow-hidden shadow-inner';
    svArea.style.backgroundColor = `hsl(${hsv.h}, 100%, 50%)`; // Base Hue

    // Gradients
    const whiteGrad = document.createElement('div');
    whiteGrad.className = 'absolute inset-0';
    whiteGrad.style.background = 'linear-gradient(to right, #fff, transparent)';
    svArea.appendChild(whiteGrad);

    const blackGrad = document.createElement('div');
    blackGrad.className = 'absolute inset-0';
    blackGrad.style.background = 'linear-gradient(to top, #000, transparent)';
    svArea.appendChild(blackGrad);

    // Thumb
    const svThumb = document.createElement('div');
    svThumb.className = 'absolute w-3 h-3 border-2 border-white rounded-full shadow-md transform -translate-x-1/2 -translate-y-1/2 pointer-events-none box-content';
    // Initial Pos
    const setSvThumbPos = () => {
        const x = hsv.s * 100;
        const y = (1 - hsv.v) * 100;
        svThumb.style.left = `${x}%`;
        svThumb.style.top = `${y}%`;
    };
    setSvThumbPos();
    svArea.appendChild(svThumb);

    // Interaction
    const handleSvMove = (e) => {
        const rect = svArea.getBoundingClientRect();
        let x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        let y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

        hsv.s = x;
        hsv.v = 1 - y;

        setSvThumbPos();
        updateColor();
    };

    svArea.addEventListener('mousedown', (e) => {
        e.preventDefault();
        handleSvMove(e);
        const up = () => {
            document.removeEventListener('mousemove', handleSvMove);
            document.removeEventListener('mouseup', up);
        }
        document.addEventListener('mousemove', handleSvMove);
        document.addEventListener('mouseup', up);
    });

    container.appendChild(svArea);


    // --- 2. Sliders Row ---
    const slidersRow = document.createElement('div');
    slidersRow.className = 'flex gap-3 items-center';

    const colorPreview = document.createElement('div');
    colorPreview.className = 'w-8 h-8 rounded-full shadow-sm border border-gray-200 dark:border-white/10 shrink-0';
    colorPreview.style.backgroundColor = initialColor;
    slidersRow.appendChild(colorPreview);

    const slidersCol = document.createElement('div');
    slidersCol.className = 'flex flex-col gap-2 flex-1';

    // Hue Slider
    const hueSlider = document.createElement('div');
    hueSlider.className = 'h-3 w-full rounded-full relative cursor-pointer';
    hueSlider.style.background = 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)';

    const hueThumb = document.createElement('div');
    hueThumb.className = 'absolute top-0 h-3 w-3 bg-white border border-gray-300 rounded-full shadow-sm transform -translate-x-1/2 pointer-events-none';
    hueThumb.style.left = `${(hsv.h / 360) * 100}%`;
    hueSlider.appendChild(hueThumb);

    const handleHueMove = (e) => {
        const rect = hueSlider.getBoundingClientRect();
        let x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        hsv.h = x * 360;
        hueThumb.style.left = `${x * 100}%`;

        // Update SV Area Base Color
        svArea.style.backgroundColor = `hsl(${hsv.h}, 100%, 50%)`;
        updateColor();
    };

    hueSlider.addEventListener('mousedown', (e) => {
        e.preventDefault();
        handleHueMove(e);
        const up = () => {
            document.removeEventListener('mousemove', handleHueMove);
            document.removeEventListener('mouseup', up);
        }
        document.addEventListener('mousemove', handleHueMove);
        document.addEventListener('mouseup', up);
    });
    slidersCol.appendChild(hueSlider);

    // Opacity Slider (Checkerboard bg)
    const alphaSlider = document.createElement('div');
    alphaSlider.className = 'h-3 w-full rounded-full relative cursor-pointer bg-dots';
    // We need a gradient on top of dots that goes from transparent to current color
    const alphaGrad = document.createElement('div');
    alphaGrad.className = 'absolute inset-0 rounded-full';
    alphaSlider.appendChild(alphaGrad);

    const alphaThumb = document.createElement('div');
    alphaThumb.className = 'absolute top-0 h-3 w-3 bg-white border border-gray-300 rounded-full shadow-sm transform -translate-x-1/2 pointer-events-none';
    alphaThumb.style.left = `${alpha * 100}%`;
    alphaSlider.appendChild(alphaThumb);

    const handleAlphaMove = (e) => {
        const rect = alphaSlider.getBoundingClientRect();
        let x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        alpha = x;
        alphaThumb.style.left = `${x * 100}%`;
        updateColor();
    };

    alphaSlider.addEventListener('mousedown', (e) => {
        e.preventDefault();
        handleAlphaMove(e);
        const up = () => {
            document.removeEventListener('mousemove', handleAlphaMove);
            document.removeEventListener('mouseup', up);
        }
        document.addEventListener('mousemove', handleAlphaMove);
        document.addEventListener('mouseup', up);
    });
    slidersCol.appendChild(alphaSlider);

    slidersRow.appendChild(slidersCol);
    container.appendChild(slidersRow);


    // --- 3. Inputs Row ---
    const inputsRow = document.createElement('div');
    inputsRow.className = 'flex items-center justify-between gap-2 pt-1';

    // Hex Input
    const hexContainer = document.createElement('div');
    hexContainer.className = 'flex items-center gap-1 bg-gray-100 dark:bg-[#2C2C2E] rounded px-2 py-1 flex-1';

    const hexLabel = document.createElement('span');
    hexLabel.textContent = '#';
    hexLabel.className = 'text-gray-400 text-xs font-mono';
    hexContainer.appendChild(hexLabel);

    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.value = rgbToHex(rgba.r, rgba.g, rgba.b, rgba.a).replace('#', ''); // init value
    hexInput.className = 'w-full bg-transparent border-none text-xs font-mono text-gray-700 dark:text-gray-200 focus:outline-none uppercase';
    hexInput.spellcheck = false;

    hexInput.onchange = (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith('#')) val = '#' + val;
        // Validate
        if (/^#([0-9A-F]{3}){1,2}([0-9A-F]{2})?$/i.test(val)) {
            const newRgba = hexToRgb(val);
            const newHsv = rgbToHsv(newRgba.r, newRgba.g, newRgba.b);
            hsv = newHsv;
            alpha = newRgba.a;
            updateUI(false); // Don't update this input
            flushColor();
        }
    };
    hexInput.onkeydown = (e) => { if (e.key === 'Enter') hexInput.blur(); };

    hexContainer.appendChild(hexInput);
    inputsRow.appendChild(hexContainer);

    // Percentage Input (Opacity)
    const opacityContainer = document.createElement('div');
    opacityContainer.className = 'flex items-center gap-0.5 bg-gray-100 dark:bg-[#2C2C2E] rounded px-2 py-1 w-16';

    const opacityInput = document.createElement('input');
    opacityInput.type = 'number';
    opacityInput.min = 0;
    opacityInput.max = 100;
    opacityInput.value = Math.round(alpha * 100);
    opacityInput.className = 'w-full bg-transparent border-none text-xs font-mono text-gray-700 dark:text-gray-200 focus:outline-none text-right';

    const opacityLabel = document.createElement('span');
    opacityLabel.textContent = '%';
    opacityLabel.className = 'text-gray-400 text-xs font-mono';

    opacityInput.onchange = (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val)) val = 100;
        val = Math.max(0, Math.min(100, val));
        alpha = val / 100;
        updateUI();
        flushColor();
    };

    opacityContainer.appendChild(opacityInput);
    opacityContainer.appendChild(opacityLabel);
    inputsRow.appendChild(opacityContainer);

    container.appendChild(inputsRow);


    // Update Logic
    const updateUI = (updateHex = true) => {
        // Update Thumbs included in interactions above, 
        // but if changed via input, we need these:

        // SV Thumb
        setSvThumbPos();
        svArea.style.backgroundColor = `hsl(${hsv.h}, 100%, 50%)`;

        // Hue Thumb
        hueThumb.style.left = `${(hsv.h / 360) * 100}%`;

        // Alpha Thumb
        alphaThumb.style.left = `${alpha * 100}%`;

        // Alpha Gradient
        const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
        alphaGrad.style.background = `linear-gradient(to right, transparent, rgb(${rgb.r},${rgb.g},${rgb.b}))`;

        // Color Preview
        const hex = rgbToHex(rgb.r, rgb.g, rgb.b, alpha);
        colorPreview.style.backgroundColor = hex;

        if (updateHex) {
            hexInput.value = hex.replace('#', '').toUpperCase();
        }
        opacityInput.value = Math.round(alpha * 100);
    };

    // Optimization: Throttle updates using requestAnimationFrame
    let rafId = null;
    const flushColor = () => {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
            const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
            const hex = rgbToHex(rgb.r, rgb.g, rgb.b, alpha);
            onChange(hex);
            rafId = null;
        });
    };

    const updateColor = () => {
        updateUI();
        flushColor();
    };

    // Initial Update
    updateUI();


    document.body.appendChild(container);
    activePicker = container;

    // Click outside to close
    const cleanup = (e) => {
        if (!container.contains(e.target) && !triggerEl.contains(e.target)) {
            container.remove();
            activePicker = null;
            document.removeEventListener('click', cleanup);
        }
    };
    setTimeout(() => document.addEventListener('click', cleanup), 10);

    return container;
}
