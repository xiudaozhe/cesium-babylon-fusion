# Cesium-Babylon 融合

一个用于集成 Cesium 和 Babylon.js 的 TypeScript 库。本包实现了 Cesium 和 Babylon.js 场景之间的相机运动和光照同步，并内部管理两个引擎的画布，实现无缝集成。

## 特性

- **自动画布管理**：内部创建和管理 Cesium 和 Babylon.js 的画布
- **统一渲染循环**：单一渲染循环控制两个引擎，提供更好的性能
- **相机同步**：精确的相机位置和旋转同步
- **动态光照**：将 Babylon.js 的光照与 Cesium 的太阳位置和强度匹配
- **资源管理**：自动清理资源和事件监听器
- **TypeScript 支持**：包含完整的 TypeScript 类型定义
- **灵活控制**：可选的手动渲染和光照同步控制
- **高效内存使用**：合理的资源释放和内存管理
- **自动网格节点管理**：自动为 Babylon.js 网格设置父节点
- **透明画布支持**：内置对 Babylon.js 画布的透明通道支持

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

## 基本用法

以下是一个基本的使用示例：

```typescript
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { CesiumBabylonFusion } from 'cesium-babylon-fusion';
import * as BABYLON from '@babylonjs/core';

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
        terrainProvider: Cesium.createWorldTerrain(),
        imageryProvider: new Cesium.ArcGisMapServerImageryProvider({
            url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
        })
    },
    // 设置北京为基准点
    basePoint: Cesium.Cartesian3.fromDegrees(116.391, 39.904, 0),
    // 可选的 Babylon.js 引擎选项
    babylonOptions: {
        alpha: true,
        antialias: true
    }
});

// 访问各个引擎实例
const cesiumViewer = fusion.cesiumViewer;
const babylonScene = fusion.babylonScene;

// 清理资源
function cleanup() {
    fusion.dispose();
}
```

## 高级用法

### 手动渲染控制

您可以禁用自动渲染并手动控制：

```typescript
const fusion = new CesiumBabylonFusion({
    container: container,
    autoRender: false // 禁用自动渲染
});

// 在需要时手动触发渲染
function animate() {
    fusion.render();
    requestAnimationFrame(animate);
}
animate();
```

### 光照配置

您可以自定义光照行为：

```typescript
const fusion = new CesiumBabylonFusion({
    container: container,
    enableLightSync: false, // 禁用自动光照同步
    enableShadow: true, // 启用阴影生成
    lightDistance: 1000, // 设置平行光距离
    showSunDirectionLine: true // 显示太阳方向的调试线
});
```

### 处理网格点击事件

您可以通过 Cesium 的点击事件来处理 Babylon.js 网格的点击：

```typescript
const fusion = new CesiumBabylonFusion({
    container: container,
    onMeshPicked: (mesh) => {
        if (mesh) {
            console.log('点击的网格:', mesh.name);
            // 处理被点击的网格
        }
    }
});
```

### 使用 Babylon.js 网格

库会自动为新创建的网格设置父节点，以确保正确的坐标系统对齐：

```typescript
// 创建一个新的网格
const box = BABYLON.MeshBuilder.CreateBox("box", {}, fusion.babylonScene);
// 该网格会自动被设置正确的父节点，无需手动设置
```

## API 参考

### CesiumBabylonFusion

主类，用于处理 Cesium 和 Babylon.js 之间的集成。

#### 构造函数选项

```typescript
interface CesiumBabylonFusionOptions {
    container: HTMLDivElement;           // 两个画布的容器元素
    cesiumOptions?: Cesium.Viewer.ConstructorOptions; // 可选的 Cesium 查看器选项
    babylonOptions?: BABYLON.EngineOptions; // 可选的 Babylon.js 引擎选项
    basePoint?: Cesium.Cartesian3;       // 可选的坐标系统基准点
    autoRender?: boolean;                // 启用自动渲染（默认：true）
    enableLightSync?: boolean;           // 启用光照同步（默认：true）
    enableShadow?: boolean;              // 启用阴影生成（默认：false）
    lightDistance?: number;              // 平行光距离（默认：100）
    showSunDirectionLine?: boolean;      // 显示太阳方向的调试线（默认：false）
    onMeshPicked?: (mesh: BABYLON.AbstractMesh | null) => void; // 网格点击事件回调函数
}
```

#### 属性

- `cesiumViewer`：获取 Cesium 查看器实例
- `babylonScene`：获取 Babylon.js 场景实例
- `babylonEngine`：获取 Babylon.js 引擎实例

#### 方法

- `render()`：手动触发渲染帧
- `dispose()`：清理资源，停止渲染循环，并移除画布

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
- 提供根变换节点用于正确的网格定位

### 光照系统
- 将 Babylon.js 的平行光与 Cesium 的太阳位置同步
- 根据太阳高度调整光照强度
- 通过半球光提供环境光照
- 支持昼夜循环模拟
- 可选的阴影生成
- 可配置的光照距离
- 太阳方向的调试可视化

### 性能考虑
- 单一渲染循环控制两个引擎
- 高效的矩阵分解用于相机变换
- 优化的光照同步
- 合理的资源清理和内存管理
- 通过 ResizeObserver 自动调整画布大小

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
4. 所有 Babylon.js 网格会自动设置正确的父节点以确保正确定位

### 如何调试渲染问题？
1. 检查控制台是否有错误信息
2. 确认容器大小设置正确
3. 验证 Cesium 资源是否正确加载
4. 检查相机同步是否正常工作
5. 验证网格的父子层级关系
6. 如果网格不可见，请确认透明度设置是否正确

## 示例

查看 `examples` 目录以获取更详细的示例：
- `basic.html`：基本设置和使用
- 更多示例即将推出...

### 完整的阴影和网格示例

以下是一个综合示例，展示了如何设置带阴影的融合场景、创建网格以及处理相机定位：

```typescript
const fusion = new CesiumBabylonFusion({
    container: container.value,
    basePoint: Cesium.Cartesian3.fromDegrees(120, 30, 0), // 设置基准点为杭州
    cesiumOptions: {
      timeline: true,
      animation: true,
    },
    enableLightSync: true,
    enableShadow: true,
    showSunDirectionLine: true,
    onMeshPicked,
});

const { viewer, scene } = fusion;

// 在 Cesium 地球上启用光照
viewer.scene.globe.enableLighting = true;

// 创建一个红色立方体
const mesh = BABYLON.MeshBuilder.CreateBox("mesh", { size: 10 }, scene);
const material = new BABYLON.StandardMaterial("material", scene);
material.diffuseColor = new BABYLON.Color3(1, 0, 0);
mesh.material = material;
mesh.position = new BABYLON.Vector3(0, 10, 0);

// 将立方体添加为阴影投射者
fusion.shadowGenerator.addShadowCaster(mesh);

// 创建一个绿色地面接收阴影
const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 100, height: 100 }, scene);
const groundMaterial = new BABYLON.StandardMaterial("groundMaterial", scene);
groundMaterial.diffuseColor = new BABYLON.Color3(0, 1, 0);
ground.material = groundMaterial;
ground.receiveShadows = true;

// 移动相机以查看场景
viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(120, 30, 10),
});
```

这个示例演示了：
- 设置启用阴影的融合场景
- 创建和定位 Babylon.js 网格
- 配置阴影的投射和接收
- 控制 Cesium 相机
- 使用基准点进行局部坐标系统对齐

## 贡献

欢迎贡献！请随时提交 Pull Request。

## 许可证

MIT 