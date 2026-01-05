/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'brand-primary': 'var(--color-brand-primary)',
                'brand-secondary': 'var(--color-brand-secondary)',
                'bg-dark': 'var(--color-bg-dark)',
                'card-bg': 'var(--color-card-bg)',
                'glass-border': 'var(--color-glass-border)',
            }
        },
    },
    plugins: [],
}
