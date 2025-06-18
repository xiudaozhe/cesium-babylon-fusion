# Cesium-Babylon 融合

一个用于集成 Cesium 和 Babylon.js 的 TypeScript 库。本包实现了 Cesium 和 Babylon.js 场景之间的相机运动和光照同步，并内部管理两个引擎的画布，实现无缝集成。

## 安装

首先，安装本包：
```bash
npm install cesium-babylon-fusion
```

然后，安装所需的依赖：
```bash
npm install @babylonjs/core cesium
```

## 配置

### 1. 配置 Cesium 资源
确保您的构建系统正确处理 Cesium 的静态资源。例如，如果您使用 Vite：

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import cesium from 'vite-plugin-cesium'; // 需要先安装这个插件

export default defineConfig({
    plugins: [cesium()]
});
```

### 2. 导入所需的 CSS
在您的主入口文件中：
```typescript
import 'cesium/Build/Cesium/Widgets/widgets.css';
```

## 使用方法

以下是一个基本的使用示例：

```typescript
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { CesiumBabylonFusion } from 'cesium-babylon-fusion';

// 创建容器 div
const container = document.createElement('div');
container.style.width = '100%';
container.style.height = '100%';
container.style.position = 'relative';
document.body.appendChild(container);

// 初始化融合器
const fusion = new CesiumBabylonFusion({
    container: container,
    cesiumOptions: {
        // 可选：配置 Cesium 查看器
        terrainProvider: Cesium.createWorldTerrain(),
        imageryProvider: new Cesium.ArcGisMapServerImageryProvider({
            url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
        })
    },
    // 可选：设置坐标系统对齐的基准点
    basePoint: Cesium.Cartesian3.fromDegrees(116.391, 39.904, 0) // 以北京为例
});

// 清理资源
function cleanup() {
    fusion.dispose();
}
```

## 特性

- **自动画布管理**：内部创建和管理 Cesium 和 Babylon.js 的画布
- **统一渲染循环**：单一渲染循环控制两个引擎，提供更好的性能
- **相机同步**：精确的相机位置和旋转同步
- **动态光照**：将 Babylon.js 的光照与 Cesium 的太阳位置和强度匹配
- **资源管理**：自动清理资源和事件监听器
- **TypeScript 支持**：包含完整的 TypeScript 类型定义

## API 参考

### CesiumBabylonFusion

主类，用于处理 Cesium 和 Babylon.js 之间的集成。

#### 构造函数选项

```typescript
interface CesiumBabylonFusionOptions {
    container: HTMLDivElement;           // 两个画布的容器元素
    cesiumOptions?: Cesium.Viewer.ConstructorOptions; // 可选的 Cesium 查看器选项
    basePoint?: Cesium.Cartesian3;       // 可选的坐标系统基准点
}
```

#### 方法

- `dispose()`: 清理资源，停止渲染循环，并移除画布

## 技术细节

### 画布布局
本包在提供的容器中创建两个画布：
1. Cesium 画布（底层）
2. Babylon.js 画布（顶层，禁用指针事件）

### 渲染循环
使用统一的渲染循环，按以下顺序执行：
1. 渲染 Cesium 场景
2. 同步相机和光照
3. 渲染 Babylon.js 场景

### 坐标系统
- 使用 Cesium 的坐标系统作为主要参考
- 自动在 Cesium 和 Babylon.js 坐标系统之间转换
- 支持使用基准点进行局部坐标系统对齐

### 性能考虑
- 单一渲染循环控制两个引擎
- 高效的矩阵分解用于相机变换
- 优化的光照同步

## 常见问题

### 为什么还需要导入 Cesium？
虽然本包处理了 Cesium 和 Babylon.js 的集成，但您仍需要：
1. 使用 Cesium 的类型和工具（如 `Cesium.Cartesian3`）
2. 配置 Cesium 的资源文件和 CSS
3. 可能需要使用 Cesium 的其他功能

### 如何处理坐标转换？
本包自动处理了 Cesium 和 Babylon.js 之间的坐标转换。但如果您需要自己处理坐标，请注意：
1. Cesium 使用地理坐标系统（WGS84）
2. Babylon.js 使用局部笛卡尔坐标系统
3. 可以使用 `basePoint` 设置局部坐标系统的原点

### 如何调试渲染问题？
1. 检查控制台是否有错误信息
2. 确认容器大小设置正确
3. 验证 Cesium 资源是否正确加载
4. 检查相机同步是否正常工作

## 许可证

MIT 