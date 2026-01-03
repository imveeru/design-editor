const container = document.getElementById('toast-container');

export function showToast(message, type = 'info', duration = 3000) {
    if (!container) return;

    const toast = document.createElement('div');

    // Tailwind classes for Toast
    // Base
    let classes = 'flex items-center w-auto max-w-xs p-2 mb-2 text-xs text-gray-500 bg-white rounded shadow-md dark:text-gray-400 dark:bg-gray-800 transition-opacity duration-300 opacity-0 transform -translate-y-2';

    // Type indicators (could add icons)
    if (type === 'error') {
        classes += ' border-l-4 border-red-500';
    } else if (type === 'success') {
        classes += ' border-l-4 border-green-500';
    } else {
        classes += ' border-l-4 border-blue-500';
    }

    toast.className = classes;

    toast.innerHTML = `
        <div class="ml-3 text-sm font-normal">${message}</div>
        <button type="button" class="ml-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex h-8 w-8 dark:text-gray-500 dark:hover:text-white dark:bg-gray-800 dark:hover:bg-gray-700 items-center justify-center" onclick="this.parentElement.remove()">
            <span class="sr-only">Close</span>
            <i class="ph ph-x text-lg"></i>
        </button>
    `;

    container.appendChild(toast);

    // Animate In
    requestAnimationFrame(() => {
        toast.classList.remove('opacity-0', 'translate-y-2');
    });

    // Auto Dismiss
    setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}
