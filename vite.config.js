import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const rawBasePath = process.env.VITE_BASE_PATH ?? '/';
const basePath = rawBasePath.endsWith('/') ? rawBasePath : `${rawBasePath}/`;

export default defineConfig({
  plugins: [react()],
  base: basePath
});

