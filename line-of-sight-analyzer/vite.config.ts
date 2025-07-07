import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react'; // <-- Step 1: IMPORT THE REACT PLUGIN
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    // ================== FIX START ==================
    // Step 2: ADD THE PLUGINS ARRAY WITH THE REACT PLUGIN.
    // This is the essential line that was missing. It tells Vite to process
    // your React code (JSX) and enables the integration with PostCSS for Tailwind.
    plugins: [react()],
    // =================== FIX END ===================

    // Your existing configuration for environment variables is preserved below.
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },

    // Your existing configuration for path aliases is also preserved.
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});