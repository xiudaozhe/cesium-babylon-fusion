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

### 相机控制模式

库支持三种不同的相机控制模式：

```typescript
const fusion = new CesiumBabylonFusion({
    container: container,
    controlMode: 'auto', // 'cesium' | 'babylon' | 'auto'
    autoSwitchDistance: 1000 // auto模式的距离切换阈值（米）
});

// 您还可以在运行时更改控制模式
fusion.setControlMode('babylon');

// 动态设置auto模式的切换距离
fusion.setAutoSwitchDistance(1500);

// 获取当前控制模式
console.log('当前模式:', fusion.controlMode);
console.log('实际模式:', fusion.actualControlMode);
```

**控制模式详解：**
- `'cesium'`：Cesium 控制相机，Babylon.js 跟随
  - 适用于大范围地球导航和飞行
  - 支持地球表面的自然导航
- `'babylon'`：Babylon.js 控制相机，Cesium 跟随  
  - 使用 ArcRotateCamera 进行精确的本地场景检查
  - 适用于建筑物内部或详细模型查看
- `'auto'`：根据相机到基准点的距离自动切换模式
  - 距离大于阈值：自动使用 Cesium 控制（远距离观察）
  - 距离小于等于阈值：自动使用 Babylon.js 控制（近距离检查）
  - 内置防抖机制，避免频繁切换造成的抖动

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
    babylonOptions?: BABYLON.EngineOptions; // 可选的 Babylon.js 引擎选项（默认：{ alpha: true }）
    basePoint?: Cesium.Cartesian3;       // 可选的坐标系统基准点
    autoRender?: boolean;                // 启用自动渲染（默认：true）
    enableLightSync?: boolean;           // 启用光照同步（默认：true）
    showSunDirectionLine?: boolean;      // 显示太阳方向的调试线（默认：true）
    enableShadow?: boolean;              // 启用阴影生成（默认：false）
    lightDistance?: number;              // 太阳光源距离（默认：1000）
    controlMode?: 'cesium' | 'babylon' | 'auto'; // 相机控制模式（默认：'cesium'）
    autoSwitchDistance?: number;         // auto模式的距离切换阈值，单位米（默认：1000）
    onMeshPicked?: (mesh: BABYLON.AbstractMesh | null) => void; // 网格点击事件回调函数
}
```

#### 属性

- `cesiumViewer`：获取 Cesium 查看器实例
- `babylonScene`：获取 Babylon.js 场景实例
- `babylonEngine`：获取 Babylon.js 引擎实例
- `sunDirection`：获取当前太阳光方向向量（Babylon坐标系）
- `controlMode`：获取当前控制模式
- `actualControlMode`：获取实际控制模式（在auto模式下有用）
- `babylonCameraController`：获取 Babylon.js 相机控制器（仅在babylon控制模式下可用）
- `shadowGenerator`：获取阴影生成器实例（外部网格需要addShadowCaster才能有阴影）

#### 方法

- `render()`：手动触发渲染帧
- `setControlMode(mode: 'cesium' | 'babylon' | 'auto')`：更改相机控制模式
- `setAutoSwitchDistance(distance: number)`：设置auto模式的距离切换阈值
- `cartesianToBabylon(cartesian: Cesium.Cartesian3): BABYLON.Vector3`：将Cesium坐标转换为Babylon坐标
- `lonLatToBabylon(longitude: number, latitude: number, height?: number): BABYLON.Vector3`：将经纬度坐标转换为Babylon坐标
- `babylonToCartesian(vector: BABYLON.Vector3): Cesium.Cartesian3`：将Babylon坐标转换为Cesium坐标
- `dispose()`：清理资源，停止渲染循环，并移除画布

## 技术细节

### 画布布局
本包在提供的容器中创建两个画布：
1. Cesium 画布（底层）
2. Babylon.js 画布（顶层）

本包自动配置UI元素以实现最佳交互：
- Cesium UI元素（工具栏、动画容器、时间线容器）设置为z-index: 999和pointer-events: auto
- 根据当前控制模式管理画布的指针事件

### 渲染循环
使用统一的渲染循环，按以下顺序执行：
1. 渲染 Cesium 场景
2. 同步相机和光照
3. 渲染 Babylon.js 场景

### 坐标系统
- 使用 Cesium 的WGS84地理坐标系统作为主要参考
- 精确的坐标转换算法，支持大范围地理区域
- 基于基准点的局部ENU（东-北-上）坐标系统
- 自动处理 Cesium 和 Babylon.js 之间的坐标系统转换
- 支持经纬度到本地坐标的直接转换
- 内置防抖机制的相机控制切换，确保平滑的用户体验

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
本包提供了完整的坐标转换API，可以在不同坐标系统之间精确转换：

```typescript
// 1. 经纬度转换为Babylon坐标
const babylonPos = fusion.lonLatToBabylon(120.0, 30.0, 100); // 经度、纬度、高度

// 2. Cesium笛卡尔坐标转换为Babylon坐标
const cesiumPoint = Cesium.Cartesian3.fromDegrees(120.0, 30.0, 100);
const babylonPoint = fusion.cartesianToBabylon(cesiumPoint);

// 3. Babylon坐标转换回Cesium坐标
const backToCesium = fusion.babylonToCartesian(babylonPoint);
```

**坐标系统说明：**
1. Cesium 使用WGS84地理坐标系统（经纬度+高度）
2. Babylon.js 使用基于基准点的局部ENU坐标系统
3. 所有转换都考虑了地球曲率和精确的大地测量学计算
4. 支持大范围地理区域的高精度转换

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

### 综合功能演示示例

以下是一个展示所有最新功能的完整示例：

```typescript
import * as Cesium from 'cesium';
import * as BABYLON from '@babylonjs/core';
import { CesiumBabylonFusion } from 'cesium-babylon-fusion';

// 创建融合场景，展示所有关键特性
const fusion = new CesiumBabylonFusion({
    container: document.getElementById('mapContainer'),
    basePoint: Cesium.Cartesian3.fromDegrees(120.15, 30.25, 0), // 杭州市中心
    cesiumOptions: {
        timeline: true,
        animation: true,
        terrainProvider: Cesium.createWorldTerrain(),
    },
    babylonOptions: {
        alpha: true,
        antialias: true
    },
    enableLightSync: true,
    enableShadow: true,
    showSunDirectionLine: true,
    lightDistance: 50,
    controlMode: 'auto',
    autoSwitchDistance: 1000, // 1公里为切换阈值
    onMeshPicked: (mesh) => {
        if (mesh) {
            console.log('选中的网格:', mesh.name);
            // 高亮选中的网格
            if (mesh.material instanceof BABYLON.StandardMaterial) {
                mesh.material.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0);
            }
        }
    }
});

// 获取引擎实例
const cesiumViewer = fusion.cesiumViewer;
const babylonScene = fusion.babylonScene;
const shadowGenerator = fusion.shadowGenerator;

// 启用 Cesium 地球光照
cesiumViewer.scene.globe.enableLighting = true;

// 1. 在基准点创建主建筑物
const mainBuilding = BABYLON.MeshBuilder.CreateBox("mainBuilding", { 
    width: 20, height: 30, depth: 15 
}, babylonScene);
const buildingMaterial = new BABYLON.StandardMaterial("buildingMaterial", babylonScene);
buildingMaterial.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.8);
mainBuilding.material = buildingMaterial;
mainBuilding.position = new BABYLON.Vector3(0, 15, 0); // 地面上方15米
shadowGenerator?.addShadowCaster(mainBuilding);

// 2. 使用经纬度坐标创建其他建筑物
const building2Pos = fusion.lonLatToBabylon(120.151, 30.251, 0);
const building2 = BABYLON.MeshBuilder.CreateBox("building2", { 
    width: 15, height: 25, depth: 12 
}, babylonScene);
building2.position = building2Pos.add(new BABYLON.Vector3(0, 12.5, 0));
const building2Material = new BABYLON.StandardMaterial("building2Material", babylonScene);
building2Material.diffuseColor = new BABYLON.Color3(0.8, 0.6, 0.4);
building2.material = building2Material;
shadowGenerator?.addShadowCaster(building2);

// 3. 创建地面接收阴影
const ground = BABYLON.MeshBuilder.CreateGround("ground", { 
    width: 200, height: 200 
}, babylonScene);
const groundMaterial = new BABYLON.StandardMaterial("groundMaterial", babylonScene);
groundMaterial.diffuseColor = new BABYLON.Color3(0.4, 0.6, 0.3);
ground.material = groundMaterial;
ground.receiveShadows = true;

// 4. 演示坐标转换功能
function demonstrateCoordinateConversion() {
    // 经纬度转Babylon坐标
    const lat = 30.25, lon = 120.15, height = 50;
    const babylonPos = fusion.lonLatToBabylon(lon, lat, height);
    console.log(`经纬度 (${lon}, ${lat}, ${height}) 转换为 Babylon 坐标:`, babylonPos);
    
    // Babylon坐标转回Cesium坐标
    const cesiumPos = fusion.babylonToCartesian(babylonPos);
    const cartographic = Cesium.Cartographic.fromCartesian(cesiumPos);
    console.log('转换回的地理坐标:', {
        longitude: Cesium.Math.toDegrees(cartographic.longitude),
        latitude: Cesium.Math.toDegrees(cartographic.latitude),
        height: cartographic.height
    });
}

// 5. 监控控制模式切换
function monitorControlMode() {
    setInterval(() => {
        console.log('当前控制模式:', fusion.controlMode);
        console.log('实际控制模式:', fusion.actualControlMode);
        console.log('当前太阳方向:', fusion.sunDirection);
    }, 5000);
}

// 6. 演示相机控制
function demonstrateCameraControl() {
    // 远距离视角（Cesium控制）
    cesiumViewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(120.15, 30.25, 2000),
        duration: 3.0
    });
    
    // 3秒后切换到近距离视角（Babylon控制）
    setTimeout(() => {
        cesiumViewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(120.15, 30.25, 200),
            duration: 2.0
        });
    }, 4000);
}

// 7. 运行时配置调整
function adjustRuntimeSettings() {
    setTimeout(() => {
        // 修改auto模式的切换距离
        fusion.setAutoSwitchDistance(1500);
        console.log('切换距离已更新为1500米');
        
        // 切换到手动控制模式
        fusion.setControlMode('babylon');
        console.log('已切换到Babylon控制模式');
    }, 10000);
}

// 执行演示
demonstrateCoordinateConversion();
monitorControlMode();
demonstrateCameraControl();
adjustRuntimeSettings();

// 清理资源
window.addEventListener('beforeunload', () => {
    fusion.dispose();
});
```

**这个综合示例展示了：**
- 完整的融合场景初始化，包含所有配置选项
- 基于基准点和经纬度的精确网格定位
- 完整的阴影系统配置和使用
- auto控制模式的自动切换机制
- 坐标转换API的使用方法
- 网格点击事件的处理
- 运行时参数的动态调整
- 相机控制和动画效果
- 资源管理和清理

## 贡献

欢迎贡献！请随时提交 Pull Request。

## 许可证

MIT 