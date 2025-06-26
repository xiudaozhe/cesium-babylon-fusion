// vite.config.ts
import { defineConfig } from "file:///D:/study/cesiumAndBabylon/node_modules/vite/dist/node/index.js";
import dts from "file:///D:/study/cesiumAndBabylon/node_modules/vite-plugin-dts/dist/index.mjs";
import { resolve } from "path";
var __vite_injected_original_dirname = "D:\\study\\cesiumAndBabylon";
var vite_config_default = defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true
    })
  ],
  build: {
    lib: {
      entry: resolve(__vite_injected_original_dirname, "src/index.ts"),
      name: "CesiumBabylonFusion",
      fileName: "index",
      formats: ["es", "cjs", "umd"]
    },
    rollupOptions: {
      external: ["@babylonjs/core", "cesium"],
      output: {
        globals: {
          "@babylonjs/core": "BABYLON",
          "cesium": "Cesium"
        }
      }
    },
    sourcemap: true,
    minify: "esbuild",
    target: "es2015",
    outDir: "dist",
    emptyOutDir: true
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxzdHVkeVxcXFxjZXNpdW1BbmRCYWJ5bG9uXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxzdHVkeVxcXFxjZXNpdW1BbmRCYWJ5bG9uXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9zdHVkeS9jZXNpdW1BbmRCYWJ5bG9uL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XHJcbmltcG9ydCBkdHMgZnJvbSAndml0ZS1wbHVnaW4tZHRzJztcclxuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ3BhdGgnO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICAgIHBsdWdpbnM6IFtcclxuICAgICAgICBkdHMoe1xyXG4gICAgICAgICAgICBpbnNlcnRUeXBlc0VudHJ5OiB0cnVlLFxyXG4gICAgICAgICAgICByb2xsdXBUeXBlczogdHJ1ZVxyXG4gICAgICAgIH0pXHJcbiAgICBdLFxyXG4gICAgYnVpbGQ6IHtcclxuICAgICAgICBsaWI6IHtcclxuICAgICAgICAgICAgZW50cnk6IHJlc29sdmUoX19kaXJuYW1lLCAnc3JjL2luZGV4LnRzJyksXHJcbiAgICAgICAgICAgIG5hbWU6ICdDZXNpdW1CYWJ5bG9uRnVzaW9uJyxcclxuICAgICAgICAgICAgZmlsZU5hbWU6ICdpbmRleCcsXHJcbiAgICAgICAgICAgIGZvcm1hdHM6IFsnZXMnLCAnY2pzJywgJ3VtZCddXHJcbiAgICAgICAgfSxcclxuICAgICAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgICAgICAgIGV4dGVybmFsOiBbJ0BiYWJ5bG9uanMvY29yZScsICdjZXNpdW0nXSxcclxuICAgICAgICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgICAgICAgICBnbG9iYWxzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgJ0BiYWJ5bG9uanMvY29yZSc6ICdCQUJZTE9OJyxcclxuICAgICAgICAgICAgICAgICAgICAnY2VzaXVtJzogJ0Nlc2l1bSdcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgc291cmNlbWFwOiB0cnVlLFxyXG4gICAgICAgIG1pbmlmeTogJ2VzYnVpbGQnLFxyXG4gICAgICAgIHRhcmdldDogJ2VzMjAxNScsXHJcbiAgICAgICAgb3V0RGlyOiAnZGlzdCcsXHJcbiAgICAgICAgZW1wdHlPdXREaXI6IHRydWVcclxuICAgIH1cclxufSk7ICJdLAogICJtYXBwaW5ncyI6ICI7QUFBbVEsU0FBUyxvQkFBb0I7QUFDaFMsT0FBTyxTQUFTO0FBQ2hCLFNBQVMsZUFBZTtBQUZ4QixJQUFNLG1DQUFtQztBQUl6QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUN4QixTQUFTO0FBQUEsSUFDTCxJQUFJO0FBQUEsTUFDQSxrQkFBa0I7QUFBQSxNQUNsQixhQUFhO0FBQUEsSUFDakIsQ0FBQztBQUFBLEVBQ0w7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNILEtBQUs7QUFBQSxNQUNELE9BQU8sUUFBUSxrQ0FBVyxjQUFjO0FBQUEsTUFDeEMsTUFBTTtBQUFBLE1BQ04sVUFBVTtBQUFBLE1BQ1YsU0FBUyxDQUFDLE1BQU0sT0FBTyxLQUFLO0FBQUEsSUFDaEM7QUFBQSxJQUNBLGVBQWU7QUFBQSxNQUNYLFVBQVUsQ0FBQyxtQkFBbUIsUUFBUTtBQUFBLE1BQ3RDLFFBQVE7QUFBQSxRQUNKLFNBQVM7QUFBQSxVQUNMLG1CQUFtQjtBQUFBLFVBQ25CLFVBQVU7QUFBQSxRQUNkO0FBQUEsTUFDSjtBQUFBLElBQ0o7QUFBQSxJQUNBLFdBQVc7QUFBQSxJQUNYLFFBQVE7QUFBQSxJQUNSLFFBQVE7QUFBQSxJQUNSLFFBQVE7QUFBQSxJQUNSLGFBQWE7QUFBQSxFQUNqQjtBQUNKLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
