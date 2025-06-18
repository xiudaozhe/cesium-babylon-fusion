# Cesium-Babylon Fusion

A TypeScript library for integrating Cesium and Babylon.js. This package implements camera motion and lighting synchronization between Cesium and Babylon.js scenes, and internally manages the canvases of both engines for seamless integration.

## Features

- **Automatic Canvas Management**: Internally creates and manages canvases for both Cesium and Babylon.js
- **Unified Render Loop**: Single render loop controlling both engines for better performance
- **Camera Synchronization**: Precise camera position and rotation synchronization
- **Dynamic Lighting**: Matches Babylon.js lighting with Cesium's sun position and intensity
- **Resource Management**: Automatic cleanup of resources and event listeners
- **TypeScript Support**: Complete TypeScript type definitions
- **Flexible Control**: Optional manual rendering and lighting sync control
- **Efficient Memory Usage**: Proper resource disposal and memory management

## Installation

First, install this package:
```bash
npm install cesium-babylon-fusion
```

Then, install the required peer dependencies:
```bash
npm install @babylonjs/core cesium
```

## Configuration

### 1. Configure Cesium Assets
Ensure your build system properly handles Cesium's static assets. For example, if you're using Vite:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import cesium from 'vite-plugin-cesium'; // Need to install this plugin first

export default defineConfig({
    plugins: [cesium()]
});
```

### 2. Import Required CSS
In your main entry file:
```typescript
import 'cesium/Build/Cesium/Widgets/widgets.css';
```

## Basic Usage

Here's a basic example:

```typescript
import { CesiumBabylonFusion } from 'cesium-babylon-fusion';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import * as BABYLON from '@babylonjs/core';

// Create container
const container = document.createElement('div');
container.style.width = '100%';
container.style.height = '100%';
container.style.position = 'relative';
document.body.appendChild(container);

// Initialize fusion
const fusion = new CesiumBabylonFusion({
    container: container,
    cesiumOptions: {
        terrainProvider: Cesium.createWorldTerrain(),
        imageryProvider: new Cesium.ArcGisMapServerImageryProvider({
            url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
        })
    },
    // Set Beijing as the base point
    basePoint: Cesium.Cartesian3.fromDegrees(116.391, 39.904, 0)
});

// Access individual engines
const cesiumViewer = fusion.cesiumViewer;
const babylonScene = fusion.babylonScene;

// Clean up resources
function cleanup() {
    fusion.dispose();
}
```

## Advanced Usage

### Manual Rendering Control

You can disable automatic rendering and control it manually:

```typescript
const fusion = new CesiumBabylonFusion({
    container: container,
    autoRender: false // Disable automatic rendering
});

// Manually trigger render when needed
function animate() {
    fusion.render();
    requestAnimationFrame(animate);
}
animate();
```

### Disable Lighting Synchronization

If you want to control Babylon.js lighting independently:

```typescript
const fusion = new CesiumBabylonFusion({
    container: container,
    enableLightSync: false // Disable automatic lighting sync
});
```

## API Reference

### CesiumBabylonFusion

Main class handling the integration between Cesium and Babylon.js.

#### Constructor Options

```typescript
interface CesiumBabylonFusionOptions {
    container: HTMLDivElement;           // Container element for both canvases
    cesiumOptions?: Cesium.Viewer.ConstructorOptions; // Optional Cesium viewer options
    basePoint?: Cesium.Cartesian3;       // Optional coordinate system base point
    autoRender?: boolean;                // Enable automatic rendering (default: true)
    enableLightSync?: boolean;           // Enable lighting sync (default: true)
}
```

#### Properties

- `cesiumViewer`: Get the Cesium viewer instance
- `babylonScene`: Get the Babylon.js scene instance
- `babylonEngine`: Get the Babylon.js engine instance

#### Methods

- `render()`: Manually trigger a render frame
- `dispose()`: Clean up resources, stop render loop, and remove canvases

## Technical Details

### Canvas Layout
The package creates two canvases in the provided container:
1. Cesium canvas (bottom layer)
2. Babylon.js canvas (top layer, pointer events disabled)

### Render Loop
Uses a unified render loop executing in the following order:
1. Render Cesium scene
2. Sync camera and lighting
3. Render Babylon.js scene

### Coordinate System
- Uses Cesium's coordinate system as the primary reference
- Automatically converts between Cesium and Babylon.js coordinate systems
- Supports local coordinate system alignment using a base point

### Performance Considerations
- Single render loop controlling both engines
- Efficient matrix decomposition for camera transforms
- Optimized lighting synchronization
- Proper resource cleanup and memory management

## Common Issues

### Why do I need to import Cesium?
While this package handles the integration of Cesium and Babylon.js, you still need to:
1. Use Cesium's types and utilities (like `Cesium.Cartesian3`)
2. Configure Cesium's assets and CSS
3. Potentially use other Cesium features

### How to handle coordinate conversion?
The package automatically handles coordinate conversion between Cesium and Babylon.js. However, if you need to handle coordinates yourself, note that:
1. Cesium uses a geographic coordinate system (WGS84)
2. Babylon.js uses a local Cartesian coordinate system
3. Use `basePoint` to set the origin of the local coordinate system

### How to debug rendering issues?
1. Check console for error messages
2. Verify container size is set correctly
3. Confirm Cesium assets are loading properly
4. Check camera synchronization is working

## Examples

Check out the `examples` directory for more detailed examples:
- `basic.html`: Basic setup and usage
- More examples coming soon...

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT 