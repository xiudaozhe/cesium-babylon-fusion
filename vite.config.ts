import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
    plugins: [
        dts({
            insertTypesEntry: true,
            rollupTypes: true
        })
    ],
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'CesiumBabylonFusion',
            fileName: 'index',
            formats: ['es', 'cjs', 'umd']
        },
        rollupOptions: {
            external: ['@babylonjs/core', 'cesium'],
            output: {
                globals: {
                    '@babylonjs/core': 'BABYLON',
                    'cesium': 'Cesium'
                }
            }
        },
        sourcemap: true,
        minify: 'esbuild',
        target: 'es2015',
        outDir: 'dist',
        emptyOutDir: true
    }
}); 