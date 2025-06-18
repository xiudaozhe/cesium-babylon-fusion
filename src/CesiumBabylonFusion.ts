import * as BABYLON from '@babylonjs/core';
import * as Cesium from 'cesium';

export interface CesiumBabylonFusionOptions {
    container: HTMLDivElement;
    cesiumOptions?: Cesium.Viewer.ConstructorOptions;
    /**
     * Babylon.js 引擎配置选项
     * @default { alpha: true }
     */
    babylonOptions?: BABYLON.EngineOptions;
    basePoint?: Cesium.Cartesian3;
    /**
     * 是否启用自动渲染循环
     * @default true
     */
    autoRender?: boolean;
    /**
     * 是否启用光照同步
     * @default true
     */
    enableLightSync?: boolean;
    /**
     * 点击事件回调
     */
    onMeshPicked?: (mesh: BABYLON.AbstractMesh | null) => void;
}

export class CesiumBabylonFusion {
    private viewer!: Cesium.Viewer;
    private engine!: BABYLON.Engine;
    private scene!: BABYLON.Scene;
    private camera!: BABYLON.FreeCamera;
    private sunLight!: BABYLON.DirectionalLight;
    private hemisphericLight!: BABYLON.HemisphericLight;
    private basePoint!: Cesium.Cartesian3;
    private basePointBabylon!: BABYLON.Vector3;
    private cesiumContainer!: HTMLDivElement;
    private babylonCanvas!: HTMLCanvasElement;
    private rootNode!: BABYLON.TransformNode;
    private _isDisposed: boolean = false;
    private _autoRender: boolean = true;
    private _enableLightSync: boolean = true;
    private _resizeObserver!: ResizeObserver;
    private _options: CesiumBabylonFusionOptions;

    /**
     * 获取 Cesium 查看器实例
     */
    public get cesiumViewer(): Cesium.Viewer {
        return this.viewer;
    }

    /**
     * 获取 Babylon 场景实例
     */
    public get babylonScene(): BABYLON.Scene {
        return this.scene;
    }

    /**
     * 获取 Babylon 引擎实例
     */
    public get babylonEngine(): BABYLON.Engine {
        return this.engine;
    }

    constructor(options: CesiumBabylonFusionOptions) {
        if (!options.container) {
            throw new Error('Container element is required');
        }

        this._options = options;
        this._autoRender = options.autoRender ?? true;
        this._enableLightSync = options.enableLightSync ?? true;
        this.basePoint = options.basePoint || Cesium.Cartesian3.ZERO;
        this.basePointBabylon = this.cart2vec(this.basePoint);

        try {
            this.initializeCanvases(options.container);
            this.initializeCesium(options.cesiumOptions);
            this.initializeBabylon();
            this.setupClickHandling();
            this.setupRenderLoop();
            this.setupResizeHandling(options.container);
        } catch (error) {
            this.dispose();
            throw error;
        }
    }

    private initializeCanvases(container: HTMLDivElement): void {
        // Create Cesium container div
        const cesiumContainer = document.createElement('div');
        cesiumContainer.style.left = '0';
        cesiumContainer.style.top = '0';
        cesiumContainer.style.width = '100%';
        cesiumContainer.style.height = '100%';
        cesiumContainer.style.position = 'absolute';
        container.appendChild(cesiumContainer);

        // Create Babylon canvas
        this.babylonCanvas = document.createElement('canvas');
        this.babylonCanvas.style.left = '0';
        this.babylonCanvas.style.top = '0';
        this.babylonCanvas.style.width = '100%';
        this.babylonCanvas.style.height = '100%';
        this.babylonCanvas.style.position = 'absolute';
        this.babylonCanvas.style.pointerEvents = 'none';
        container.appendChild(this.babylonCanvas);

        // Store the cesium container reference
        this.cesiumContainer = cesiumContainer;
    }

    private initializeCesium(cesiumOptions?: Cesium.Viewer.ConstructorOptions): void {

        this.viewer = new Cesium.Viewer(this.cesiumContainer, {
            useDefaultRenderLoop: false,
            selectionIndicator: false,
            homeButton: false,
            sceneModePicker: false,
            navigationHelpButton: false,
            animation: false,
            timeline: false,
            fullscreenButton: false,
            baseLayerPicker: false,
            ...cesiumOptions
        });
    }

    private initializeBabylon(): void {
        // 合并默认配置和用户配置
        const defaultOptions: BABYLON.EngineOptions = {
            alpha: true // 默认启用透明支持
        };
        const engineOptions = { ...defaultOptions, ...this._options.babylonOptions };

        this.engine = new BABYLON.Engine(this.babylonCanvas, true, engineOptions);
        this.scene = new BABYLON.Scene(this.engine);
        this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 0.2);
        this.camera = new BABYLON.FreeCamera('camera', new BABYLON.Vector3(0, 0, 0), this.scene);
        this.sunLight = new BABYLON.DirectionalLight('sunLight', new BABYLON.Vector3(0, -1, 0), this.scene);
        this.hemisphericLight = new BABYLON.HemisphericLight('hemisphericLight', new BABYLON.Vector3(0, 1, 0), this.scene);

        // 创建根节点
        this.rootNode = new BABYLON.TransformNode("BaseNode", this.scene);
        //cesium在basePoint的地球表面向上方向的法向量
        const upVector = Cesium.Cartesian3.normalize(Cesium.Cartesian3.add(this.basePoint, Cesium.Cartesian3.fromElements(0, 1, 0), new Cesium.Cartesian3()), new Cesium.Cartesian3());
        // 设置根节点朝向，yaw和roll设为0，保持默认朝向
        this.rootNode.lookAt(this.cart2vec(upVector));
        this.rootNode.addRotation(Math.PI / 2, 0, 0);

        // 设置自动mesh父节点
        this.setupAutoMeshParenting();
    }

    /**
     * 设置自动mesh父节点功能
     * 当新的mesh被添加到场景时，自动将其设置为rootNode的子节点
     */
    private setupAutoMeshParenting(): void {
        this.scene.onNewMeshAddedObservable.add((mesh) => {
            // 如果mesh还没有父节点，并且不是从其他父节点继承而来的
            if (!mesh.parent) {
                mesh.parent = this.rootNode;
            }
        });
    }

    private setupRenderLoop(): void {
        if (this._autoRender) {
            this.engine.runRenderLoop(() => {
                if (this._isDisposed) return;

                try {
                    // 1. 渲染 Cesium 场景
                    this.viewer.render();

                    // 2. 同步相机和光照
                    this.moveBabylonCamera();
                    if (this._enableLightSync) {
                        this.updateBabylonLighting();
                    }

                    // 3. 渲染 Babylon 场景
                    this.scene.render();
                } catch (error) {
                    console.error('Error in render loop:', error);
                }
            });
        }
    }

    private setupResizeHandling(container: HTMLDivElement): void {
        this._resizeObserver = new ResizeObserver(() => {
            if (!this._isDisposed) {
                this.engine.resize();
                this.viewer.resize();
            }
        });
        this._resizeObserver.observe(container);
    }

    /**
     * 手动触发一次渲染
     * 当 autoRender 为 false 时使用
     */
    public render(): void {
        if (this._isDisposed) {
            throw new Error('Cannot render after disposal');
        }

        this.viewer.render();
        this.moveBabylonCamera();
        if (this._enableLightSync) {
            this.updateBabylonLighting();
        }
        this.scene.render();
    }

    /**
     * 同步 Cesium 相机到 Babylon 相机
     * 这个方法处理两个引擎之间的坐标系转换和相机参数同步
     */
    private moveBabylonCamera() {
        // 1. 同步视场角(FOV)
        const frustum = this.viewer.camera.frustum;
        let fov = 60; // 默认视场角

        // 检查是否为透视相机并同步视场角
        if (frustum instanceof Cesium.PerspectiveFrustum && typeof frustum.fovy === 'number') {
            fov = Cesium.Math.toDegrees(frustum.fovy);
        }
        this.camera.fov = fov / 180 * Math.PI; // 转换为弧度

        // 2. 获取 Cesium 相机的位置、方向和上方向
        const cesiumPos = this.viewer.camera.position;
        const cesiumDir = this.viewer.camera.direction;
        const cesiumUp = this.viewer.camera.up;

        // 3. 转换相机位置和方向到 Babylon 坐标系
        const camera_pos = this.cart2vec(cesiumPos);
        const camera_dir = this.cart2vec(cesiumDir);
        const camera_up = this.cart2vec(cesiumUp);

        // 4. 应用位置（考虑基准点偏移）
        this.camera.position.x = camera_pos.x - this.basePointBabylon.x;
        this.camera.position.y = camera_pos.y - this.basePointBabylon.y;
        this.camera.position.z = camera_pos.z - this.basePointBabylon.z;

        // 5. 创建目标点（在相机前方）
        const targetPos = new BABYLON.Vector3(
            this.camera.position.x + camera_dir.x,
            this.camera.position.y + camera_dir.y,
            this.camera.position.z + camera_dir.z
        );

        // 6. 使用 lookAt 来设置相机方向
        // 这样可以避免直接处理欧拉角，提供更稳定的相机控制
        this.camera.upVector = camera_up;
        this.camera.setTarget(targetPos);
    }

    /**
     * 同步 Cesium 的光照到 Babylon 场景
     * 包括太阳光方向和强度的同步
     */
    private updateBabylonLighting() {
        // 1. 检查 Cesium 是否启用了光照
        const hasLighting = this.viewer.scene.globe.enableLighting;

        if (hasLighting) {
            // 2. 获取太阳光源信息
            const time = this.viewer.clock.currentTime;
            const sunPosition = Cesium.Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(time);
            const secondsDiff = Cesium.JulianDate.secondsDifference(time, Cesium.JulianDate.fromIso8601('2000-01-01'));
            const rotationAngle = (secondsDiff * 2 * Math.PI) / 86400;
            const sunPositionInFixed = Cesium.Matrix3.multiplyByVector(
                Cesium.Matrix3.fromRotationZ(rotationAngle),
                sunPosition,
                new Cesium.Cartesian3()
            );

            // 计算太阳在地平面以上的高度角
            const cameraPosition = this.viewer.scene.camera.position;
            const up = Cesium.Cartesian3.normalize(cameraPosition, new Cesium.Cartesian3());
            const sunDirection = Cesium.Cartesian3.subtract(sunPositionInFixed, cameraPosition, new Cesium.Cartesian3());
            Cesium.Cartesian3.normalize(sunDirection, sunDirection);

            // 计算太阳高度角（点积结果范围在-1到1之间）
            const sunElevation = Cesium.Cartesian3.dot(up, sunDirection);

            // 如果太阳在地平线以下，将光照强度设为0，否则使用Cesium的光照强度
            // 根据太阳高度角计算光照强度，当太阳接近地平线时逐渐减弱
            const normalizedElevation = Math.max(0, sunElevation);
            const intensity = sunElevation > 0 ? normalizedElevation : 0.0;

            // 转换为 Babylon 的坐标系
            // 注意：Cesium和Babylon坐标系的对应关系是：
            // Cesium(x,y,z) -> Babylon(x,z,y)
            const babylonSunDirection = new BABYLON.Vector3(
                sunDirection.x,
                sunDirection.z,
                sunDirection.y
            );

            // 更新 Babylon 场景的光照
            this.sunLight.direction = babylonSunDirection;
            this.sunLight.intensity = intensity;



            // 环境光使用较低的强度以提供柔和的填充光
            this.hemisphericLight.intensity = intensity * 0.3 + 0.1;
        }
    }

    private cart2vec(cart: Cesium.Cartesian3): BABYLON.Vector3 {
        return new BABYLON.Vector3(cart.x, cart.z, cart.y);
    }

    /**
     * 释放所有资源
     */
    public dispose(): void {
        if (this._isDisposed) return;

        this._isDisposed = true;

        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
        }

        if (this.engine) {
            this.engine.dispose();
        }

        if (this.viewer) {
            this.viewer.destroy();
        }

        if (this.cesiumContainer && this.cesiumContainer.parentNode) {
            this.cesiumContainer.parentNode.removeChild(this.cesiumContainer);
        }

        if (this.babylonCanvas && this.babylonCanvas.parentNode) {
            this.babylonCanvas.parentNode.removeChild(this.babylonCanvas);
        }
    }

    /**
     * 获取根节点实例
     */
    public get babylonRootNode(): BABYLON.TransformNode {
        return this.rootNode;
    }

    /**
     * 设置点击事件处理
     * 将Cesium的点击事件转发到Babylon场景中进行拾取测试
     */
    private setupClickHandling(): void {
        // 只在设置了回调函数时添加点击事件处理
        if (!this._options.onMeshPicked) {
            return;
        }

        // 保存this引用以在事件处理函数中使用
        const _this = this;
        const onMeshPicked = this._options.onMeshPicked;

        // 添加点击事件处理
        this.viewer.screenSpaceEventHandler.setInputAction(function (click: { position: Cesium.Cartesian2 }) {
            // 获取点击位置的Cesium坐标
            const pickedPosition = _this.viewer.scene.pickPosition(click.position);

            if (Cesium.defined(pickedPosition)) {
                // 将Cesium坐标转换为Babylon坐标（考虑基准点偏移）
                const babylonPos = _this.cart2vec(pickedPosition);
                babylonPos.subtractInPlace(_this.basePointBabylon);

                // 在Babylon场景中执行拾取测试
                const pickResult = _this.scene.pick(click.position.x, click.position.y);
                const pickedMesh = pickResult ? pickResult.pickedMesh : null;

                // 调用回调函数
                onMeshPicked(pickedMesh);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }
} 