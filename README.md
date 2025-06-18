# Cesium-Babylon Fusion

[中文文档](./README.zh-CN.md)

A TypeScript library that integrates Cesium and Babylon.js for advanced 3D visualization. This package synchronizes camera movements and lighting between Cesium and Babylon.js scenes, managing both canvases internally for seamless integration.

## Installation

First, install the package:
```bash
npm install cesium-babylon-fusion
```

Then, install the required peer dependencies:
```bash
npm install @babylonjs/core cesium
```

## Setup

### 1. Configure Cesium Assets
Make sure to configure your build system to handle Cesium's static assets. For example, if you're using Vite:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import cesium from 'vite-plugin-cesium'; // You'll need to install this

export default defineConfig({
    plugins: [cesium()]
});
```

### 2. Import Required CSS
In your main entry file:
```typescript
import 'cesium/Build/Cesium/Widgets/widgets.css';
```

## Usage

Here's a basic example of how to use the CesiumBabylonFusion package:

```typescript
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { CesiumBabylonFusion } from 'cesium-babylon-fusion';

// Create a container div
const container = document.createElement('div');
container.style.width = '100%';
container.style.height = '100%';
container.style.position = 'relative';
document.body.appendChild(container);

// Initialize the fusion
const fusion = new CesiumBabylonFusion({
    container: container,
    cesiumOptions: {
        // Optional: Configure Cesium viewer
        terrainProvider: Cesium.createWorldTerrain(),
        imageryProvider: new Cesium.ArcGisMapServerImageryProvider({
            url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
        })
    },
    // Optional: Set a base point for coordinate system alignment
    basePoint: Cesium.Cartesian3.fromDegrees(116.391, 39.904, 0)
});

// Clean up when done
function cleanup() {
    fusion.dispose();
}
```

## Features

- **Automatic Canvas Management**: Creates and manages both Cesium and Babylon.js canvases internally
- **Unified Render Loop**: Single render loop controlling both engines for better performance
- **Synchronized Camera**: Accurate camera position and rotation synchronization between engines
- **Dynamic Lighting**: Matches Babylon.js lighting with Cesium's sun position and intensity
- **Proper Resource Management**: Automatic cleanup of resources and event listeners
- **TypeScript Support**: Full TypeScript type definitions included

## API Reference

### CesiumBabylonFusion

The main class that handles the integration between Cesium and Babylon.js.

#### Constructor Options

```typescript
interface CesiumBabylonFusionOptions {
    container: HTMLDivElement;           // Container element for both canvases
    cesiumOptions?: Cesium.Viewer.ConstructorOptions; // Optional Cesium viewer options
    basePoint?: Cesium.Cartesian3;       // Optional base point for coordinate system
}
```

#### Methods

- `dispose()`: Cleans up resources, stops the render loop, and removes canvases

## Technical Details

### Canvas Layout
The package creates two canvases within the provided container:
1. Cesium canvas (bottom layer)
2. Babylon.js canvas (top layer, with pointer-events disabled)

### Render Loop
Uses a unified render loop that:
1. Renders the Cesium scene
2. Synchronizes camera and lighting
3. Renders the Babylon.js scene

### Coordinate System
- Uses Cesium's coordinate system as the primary reference
- Automatically converts between Cesium and Babylon.js coordinate systems
- Supports a base point offset for local coordinate system alignment

### Performance Considerations
- Single render loop for both engines
- Efficient matrix decomposition for camera transformations
- Optimized lighting synchronization

## License

MIT 