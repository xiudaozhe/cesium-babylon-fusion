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
     * 是否显示太阳方向指示线
     * @default true
     */
    showSunDirectionLine?: boolean;
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
    private sunLight: BABYLON.DirectionalLight | null = null;
    private basePoint!: Cesium.Cartesian3;
    private basePointBabylon!: BABYLON.Vector3;
    private cesiumContainer!: HTMLDivElement;
    private babylonCanvas!: HTMLCanvasElement;
    private rootNode!: BABYLON.TransformNode;
    private _isDisposed: boolean = false;
    private _autoRender: boolean = true;
    private _enableLightSync: boolean = true;
    private _showSunDirectionLine: boolean = true;
    private _resizeObserver!: ResizeObserver;
    private _options: CesiumBabylonFusionOptions;
    private _directionLine: BABYLON.LinesMesh | null = null;
    private _currentSunDirection: BABYLON.Vector3 = new BABYLON.Vector3(0, -1, 0);

    /**
     * 获取当前太阳光方向
     * @returns Babylon坐标系下的太阳光方向向量
     */
    public get sunDirection(): BABYLON.Vector3 {
        return this._currentSunDirection.clone();
    }

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
        this._showSunDirectionLine = options.showSunDirectionLine ?? true;
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

        // 只在启用光照同步时创建太阳光
        if (this._enableLightSync) {
            this.sunLight = new BABYLON.DirectionalLight('sunLight', this._currentSunDirection.scale(-1), this.scene);
        }
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
        const camera_pos = this.cartesianToBabylon(cesiumPos);
        const camera_dir = this.cesiumDirectionToBabylon(cesiumDir);
        const camera_up = this.cesiumDirectionToBabylon(cesiumUp);

        // 4. 应用位置（考虑基准点偏移）
        this.camera.position = camera_pos;
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
            // 获取当前时间
            const julianDate = this.viewer.clock.currentTime;

            // 计算太阳位置
            // 1. 获取太阳在惯性坐标系中的位置
            const inertialSunPosition = Cesium.Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(julianDate);

            // 2. 获取地球旋转矩阵（从惯性坐标系到ECEF）
            const icrfToFixed = Cesium.Transforms.computeIcrfToFixedMatrix(julianDate);

            if (!icrfToFixed) {
                return; // 如果转换矩阵不可用，跳过更新
            }

            // 3. 将太阳位置从惯性坐标系转换到ECEF
            const sunPosition = Cesium.Matrix3.multiplyByVector(
                icrfToFixed,
                inertialSunPosition,
                new Cesium.Cartesian3()
            );

            // 4. 计算从基准点到太阳的方向向量
            const sunDirection = Cesium.Cartesian3.subtract(
                sunPosition,
                this.basePoint,
                new Cesium.Cartesian3()
            );

            // 5. 归一化方向向量
            Cesium.Cartesian3.normalize(sunDirection, sunDirection);

            // 将Cesium的方向向量转换为Babylon坐标系
            const babylonSunDirection = this.cesiumDirectionToBabylon(sunDirection);
            // 保存当前太阳光方向
            this._currentSunDirection = babylonSunDirection;

            // 计算太阳高度角（与地平面的夹角）
            const heightAngle = Math.asin(babylonSunDirection.y);
            // 计算光照强度（0-1之间）
            // 当太阳在地平线以下时为0，正上方时为1，之间线性插值
            const intensity = Math.max(0, Math.sin(heightAngle));

            // 更新或创建太阳光
            if (this._enableLightSync) {
                if (!this.sunLight) {
                    this.sunLight = new BABYLON.DirectionalLight('sunLight', this._currentSunDirection.scale(-1), this.scene);
                } else {
                    this.sunLight.direction = this._currentSunDirection.scale(-1);
                    // 设置光照强度
                    this.sunLight.intensity = intensity;
                }
            } else if (this.sunLight) {
                this.sunLight.dispose();
                this.sunLight = null;
            }

            // 计算终点位置 (基准点 + 方向向量 * 1000)
            const endPoint = Cesium.Cartesian3.add(
                this.basePoint,
                Cesium.Cartesian3.multiplyByScalar(sunDirection, 1000, new Cesium.Cartesian3()),
                new Cesium.Cartesian3()
            );

            // 更新或创建Babylon辅助线
            if (this._showSunDirectionLine) {
                if (!this._directionLine) {
                    // 如果辅助线不存在，创建新的辅助线
                    this._directionLine = BABYLON.MeshBuilder.CreateLines(
                        "directionLine",
                        { points: [new BABYLON.Vector3(0, 0, 0), this.cartesianToBabylon(endPoint)] },
                        this.scene
                    );
                    const lineMaterial = new BABYLON.StandardMaterial("lineMaterial", this.scene);
                    lineMaterial.diffuseColor = new BABYLON.Color3(1, 0, 0);
                    this._directionLine.material = lineMaterial;
                } else {
                    // 如果辅助线已存在，只更新其顶点数据
                    const points = [new BABYLON.Vector3(0, 0, 0), this.cartesianToBabylon(endPoint)];
                    const positions = [];
                    for (const point of points) {
                        positions.push(point.x, point.y, point.z);
                    }
                    this._directionLine.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
                }
            } else if (this._directionLine) {
                // 如果配置为不显示且辅助线存在，则销毁辅助线
                this._directionLine.dispose();
                this._directionLine = null;
            }
        }
    }

    private cart2vec(cart: Cesium.Cartesian3): BABYLON.Vector3 {
        return new BABYLON.Vector3(cart.x, cart.z, cart.y);
    }

    /**
     * 将Cesium的Cartesian3坐标转换为Babylon的Vector3坐标
     * @param cartesian Cesium的笛卡尔坐标
     * @returns Babylon的三维向量坐标
     */
    public cartesianToBabylon(cartesian: Cesium.Cartesian3): BABYLON.Vector3 {
        // 1. 将基准点转换为地理坐标
        const basePointCartographic = Cesium.Cartographic.fromCartesian(this.basePoint);

        // 2. 将目标点转换为地理坐标
        const targetCartographic = Cesium.Cartographic.fromCartesian(cartesian);

        // 3. 计算经纬度差值（弧度）
        const lonDiff = targetCartographic.longitude - basePointCartographic.longitude;
        const latDiff = targetCartographic.latitude - basePointCartographic.latitude;

        // 4. 计算高度差值（米）
        const heightDiff = targetCartographic.height - basePointCartographic.height;

        // 5. 计算东西方向和南北方向的距离（米）
        // 使用球面距离近似
        const radius = 6378137.0; // WGS84椭球体的平均半径（米）
        const eastDistance = radius * Math.cos(basePointCartographic.latitude) * lonDiff;
        const northDistance = radius * latDiff;

        // 6. 转换为Babylon坐标系
        // Babylon中：
        // x对应东西方向（东为正）
        // y对应高度方向（上为正）
        // z对应南北方向（北为正）
        return new BABYLON.Vector3(
            eastDistance,
            heightDiff,
            northDistance
        );
    }

    /**
     * 将经纬度坐标转换为Babylon的Vector3坐标
     * @param longitude 经度（度）
     * @param latitude 纬度（度）
     * @param height 高度（米）
     * @returns Babylon的三维向量坐标
     */
    public lonLatToBabylon(longitude: number, latitude: number, height: number = 0): BABYLON.Vector3 {
        // 首先转换为Cesium的Cartesian3坐标
        const cartesian = Cesium.Cartesian3.fromDegrees(longitude, latitude, height);
        // 然后转换为相对于基准点的Babylon坐标
        return this.cartesianToBabylon(cartesian);
    }

    /**
     * 将Babylon的Vector3坐标转换为Cesium的Cartesian3坐标
     * @param vector Babylon的三维向量坐标
     * @returns Cesium的笛卡尔坐标
     */
    public babylonToCartesian(vector: BABYLON.Vector3): Cesium.Cartesian3 {
        // 创建相对于基准点的偏移（注意：需要将Babylon的xyz转换为Cesium的xyz）
        const offset = new Cesium.Cartesian3(vector.x, vector.z, vector.y);
        // 将偏移添加到基准点
        return Cesium.Cartesian3.add(this.basePoint, offset, new Cesium.Cartesian3());
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

        if (this._directionLine) {
            this._directionLine.dispose();
            this._directionLine = null;
        }

        if (this.sunLight) {
            this.sunLight.dispose();
            this.sunLight = null;
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

    /**
     * 将Cesium的方向向量转换为Babylon的方向向量
     * @param direction Cesium中的方向向量
     * @returns Babylon中的方向向量
     */
    private cesiumDirectionToBabylon(direction: Cesium.Cartesian3): BABYLON.Vector3 {
        // 1. 在基准点位置建立一个局部ENU坐标系的变换矩阵
        const transform = Cesium.Transforms.eastNorthUpToFixedFrame(this.basePoint);

        // 2. 计算从ECEF到ENU的逆变换矩阵
        const inverseTransform = Cesium.Matrix4.inverse(transform, new Cesium.Matrix4());

        // 3. 将方向向量从ECEF转换到ENU
        const localDirection = Cesium.Matrix4.multiplyByPointAsVector(
            inverseTransform,
            direction,
            new Cesium.Cartesian3()
        );

        // 4. 将ENU坐标系的向量转换为Babylon坐标系
        // ENU到Babylon的映射：
        // East   (x) -> Babylon X
        // North  (y) -> Babylon Z
        // Up     (z) -> Babylon Y
        return new BABYLON.Vector3(
            localDirection.x,
            localDirection.z,
            localDirection.y
        );
    }
} 