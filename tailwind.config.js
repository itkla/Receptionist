// tailwind.config.js (or .ts)
/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"], // Essential for next-themes + shadcn
    content: [
        './pages/**/*.{ts,tsx}',
        './components/**/*.{ts,tsx}',
        './app/**/*.{ts,tsx}',
        './src/**/*.{ts,tsx}',
    ],
    prefix: "", // Keep empty if using shadcn defaults
    theme: {
        container: { // Default container settings from shadcn
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            colors: {
                // --- Your Custom Colors ---
                'my-light-gray': '#F3F4F6', // Example: Replace with your desired light gray hex
                'my-orange': '#F97316',     // Example: Replace with your desired orange hex
                // --- shadcn default overrides (if needed, usually based on components.json) ---
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))", // Main background (often white/black)
                foreground: "hsl(var(--foreground))", // Main text (often black/white)
                primary: {
                    DEFAULT: "hsl(var(--primary))", // Often black/white
                    foreground: "hsl(var(--primary-foreground))", // Often white/black
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))", // Often light gray / dark gray
                    foreground: "hsl(var(--secondary-foreground))", // Often dark gray / light gray
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))", // Red
                    foreground: "hsl(var(--destructive-foreground))", // White
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))", // Lighter gray / darker gray
                    foreground: "hsl(var(--muted-foreground))", // Gray
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))", // Very light gray / very dark gray
                    foreground: "hsl(var(--accent-foreground))", // Dark gray / light gray
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
            },
            borderRadius: { // Default border radius from shadcn
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            keyframes: { // Default keyframes from shadcn
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
            },
            animation: { // Default animations from shadcn
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
            },
        },
    },
    plugins: [require("tailwindcss-animate")], // Essential for shadcn animations
}