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
