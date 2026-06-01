/** @type {import('tailwindcss').Config} */
export default {
  content: ['./popup.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        pc: {
          bg: '#f8fafc',
          surface: '#ffffff',
          border: '#e2e8f0',
          muted: '#64748b',
          text: '#0f172a',
          primary: '#4f46e5',
          'primary-hover': '#4338ca',
          success: '#059669',
          'success-bg': '#ecfdf5',
          danger: '#dc2626',
          'danger-bg': '#fef2f2',
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
        pop: '0 4px 14px rgba(79, 70, 229, 0.25)',
      },
      fontFamily: {
        sans: ['Vazirmatn', 'Segoe UI', 'Tahoma', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
