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
     * 是否启用阴影
     * @default false
     */
    enableShadow?: boolean;
    /**
     * 太阳光源距离
     * @default 1000
     */
    lightDistance?: number;
    /**
     * 控制模式：
     * - 'cesium': Cesium 控制 Babylon
     * - 'babylon': Babylon 控制 Cesium  
     * - 'auto': 根据相机高度自动切换（>1000m为cesium，≤1000m为babylon）
     * @default 'cesium'
     */
    controlMode?: 'cesium' | 'babylon' | 'auto';
    /**
     * auto模式下的高度切换阈值（米）
     * 高于此值使用Cesium控制，低于此值使用Babylon控制
     * @default 1000
     */
    autoSwitchHeight?: number;
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
    private _isDisposed: boolean = false;
    private _autoRender: boolean = true;
    private _enableLightSync: boolean = true;
    private _showSunDirectionLine: boolean = false;
    private _enableShadow: boolean = false;
    private _lightDistance: number = 1000;
    private _resizeObserver!: ResizeObserver;
    private _options: CesiumBabylonFusionOptions;
    private _directionLine: BABYLON.LinesMesh | null = null;
    private _currentSunDirection: BABYLON.Vector3 = new BABYLON.Vector3(0, -1, 0);
    private _controlMode: 'cesium' | 'babylon' | 'auto' = 'cesium';
    private _actualControlMode: 'cesium' | 'babylon' = 'cesium'; // auto模式下的实际控制模式
    private _cameraController: BABYLON.ArcRotateCamera | null = null;
    private _autoSwitchHeight: number; // auto模式的切换高度阈值（米）
    // 阴影生成器,外部盒子需要addShadowCaster 才能有阴影
    public shadowGenerator: BABYLON.ShadowGenerator | null = null;

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

    /**
     * 获取当前控制模式
     */
    public get controlMode(): 'cesium' | 'babylon' | 'auto' {
        return this._controlMode;
    }

    /**
     * 获取实际的控制模式（auto模式下返回当前实际使用的模式）
     */
    public get actualControlMode(): 'cesium' | 'babylon' {
        return this._actualControlMode;
    }

    /**
     * 获取 Babylon 相机控制器（仅在 babylon 控制模式下可用）
     */
    public get babylonCameraController(): BABYLON.ArcRotateCamera | null {
        return this._cameraController;
    }

    constructor(options: CesiumBabylonFusionOptions) {
        if (!options.container) {
            throw new Error('Container element is required');
        }

        this._options = options;
        this._autoRender = options.autoRender ?? true;
        this._enableLightSync = options.enableLightSync ?? true;
        this._showSunDirectionLine = options.showSunDirectionLine ?? false;
        this._enableShadow = options.enableShadow ?? false;
        this._lightDistance = options.lightDistance ?? 50;
        this._controlMode = options.controlMode ?? 'cesium';
        this._autoSwitchHeight = options.autoSwitchHeight ?? 1000;
        this._actualControlMode = this._controlMode === 'auto' ? 'cesium' : this._controlMode;
        this.basePoint = options.basePoint || Cesium.Cartesian3.ZERO;
        this.basePointBabylon = this.cart2vec(this.basePoint);

        try {
            this.initializeCanvases(options.container);
            this.initializeCesium(options.cesiumOptions);
            this.initializeBabylon();
            this.setupEventHandling();
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

        // 根据实际控制模式设置事件处理
        if (this._actualControlMode === 'cesium') {
            this.babylonCanvas.style.pointerEvents = 'none';
            cesiumContainer.style.pointerEvents = 'auto';
        } else {
            this.babylonCanvas.style.pointerEvents = 'auto';
            cesiumContainer.style.pointerEvents = 'none';
        }

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

        // 设置Cesium工具栏等元素的z-index
        this.setCesiumElementsZIndex();
    }

    /**
 * 设置Cesium特定元素的z-index为999并启用pointer-events
 */
    private setCesiumElementsZIndex(): void {
        // 需要设置样式的class列表
        const classNames = [
            'cesium-viewer-toolbar',
            'cesium-viewer-animationContainer',
            'cesium-viewer-timelineContainer'
        ];

        // 使用setTimeout确保DOM元素已经创建
        setTimeout(() => {
            classNames.forEach(className => {
                const elements = document.getElementsByClassName(className);
                for (let i = 0; i < elements.length; i++) {
                    const element = elements[i] as HTMLElement;
                    element.style.zIndex = '999';
                    element.style.pointerEvents = 'auto';
                }
            });
        }, 100);
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

        // 根据实际控制模式创建不同类型的相机
        if (this._actualControlMode === 'babylon') {
            // Babylon 控制模式：创建 ArcRotateCamera 用于交互控制
            this._cameraController = new BABYLON.ArcRotateCamera(
                'arcCamera',
                -Math.PI / 2,        // alpha: 水平角度（-90度，面向北方）
                Math.PI / 3,         // beta: 垂直角度（60度，俯视角）
                300,                 // radius: 距离目标的距离
                BABYLON.Vector3.Zero(), // 目标点
                this.scene
            );

            // 设置相机控制参数
            this._cameraController.attachControl(this.babylonCanvas, true);
            this._cameraController.setTarget(BABYLON.Vector3.Zero());

            // 设置相机限制，提供更好的用户体验
            this._cameraController.lowerBetaLimit = 0.1;  // 最小俯视角
            this._cameraController.upperBetaLimit = Math.PI / 2 - 0.1;  // 最大俯视角
            this._cameraController.lowerRadiusLimit = 10;   // 最小距离
            this._cameraController.upperRadiusLimit = 2000; // 最大距离

            // 设置默认视场角
            this._cameraController.fov = Math.PI / 4; // 45度视场角

            // 同时创建一个 FreeCamera 用于同步到 Cesium
            this.camera = new BABYLON.FreeCamera('camera', new BABYLON.Vector3(0, 50, 200), this.scene);
        } else {
            // Cesium 控制模式：只创建 FreeCamera，用于接收 Cesium 的相机同步
            this.camera = new BABYLON.FreeCamera('camera', new BABYLON.Vector3(0, 50, 200), this.scene);

            // 如果是auto模式，预先创建ArcRotateCamera但不激活，以备自动切换时使用
            if (this._controlMode === 'auto') {
                this._cameraController = new BABYLON.ArcRotateCamera(
                    'arcCamera',
                    -Math.PI / 2,
                    Math.PI / 3,
                    300,
                    BABYLON.Vector3.Zero(),
                    this.scene
                );

                // 设置相机控制参数但不附加控制
                this._cameraController.lowerBetaLimit = 0.1;
                this._cameraController.upperBetaLimit = Math.PI / 2 - 0.1;
                this._cameraController.lowerRadiusLimit = 10;
                this._cameraController.upperRadiusLimit = 2000;
                this._cameraController.fov = Math.PI / 4;

                // 确保不激活这个相机
                // this.scene.activeCamera保持为FreeCamera
            }
        }

        // 只在启用光照同步时创建太阳光
        if (this._enableLightSync) {
            this.sunLight = new BABYLON.DirectionalLight('sunLight', this._currentSunDirection.scale(-1), this.scene);
            // 启用阴影生成
            if (this._enableShadow) {
                this.scene.shadowsEnabled = true;
                // 设置阴影生成器参数
                this.shadowGenerator = new BABYLON.ShadowGenerator(1024, this.sunLight);
                this.shadowGenerator.useBlurExponentialShadowMap = true;
                this.shadowGenerator.blurScale = 2;
            }
        }
    }

    private setupRenderLoop(): void {
        if (this._autoRender) {
            this.engine.runRenderLoop(() => {
                if (this._isDisposed) return;

                try {
                    // 1. 渲染 Cesium 场景
                    this.viewer.render();

                    // 2. 检查并处理auto模式的自动切换
                    if (this._controlMode === 'auto') {
                        this.checkAndUpdateAutoMode();
                    }

                    // 3. 根据实际控制模式同步相机
                    if (this._actualControlMode === 'cesium') {
                        // Cesium 控制模式：从 Cesium 同步到 Babylon
                        this.moveBabylonCamera();
                    } else {
                        // Babylon 控制模式：从 Babylon 同步到 Cesium
                        this.moveCesiumCamera();
                    }

                    // 3. 同步光照
                    if (this._enableLightSync) {
                        this.updateBabylonLighting();
                    }

                    // 4. 渲染 Babylon 场景
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

        // 检查并处理auto模式的自动切换
        if (this._controlMode === 'auto') {
            this.checkAndUpdateAutoMode();
        }

        // 根据实际控制模式同步相机
        if (this._actualControlMode === 'cesium') {
            this.moveBabylonCamera();
        } else {
            this.moveCesiumCamera();
        }

        if (this._enableLightSync) {
            this.updateBabylonLighting();
        }
        this.scene.render();
    }

    /**
     * 同步 Babylon 相机到 Cesium 相机
     * 这个方法处理从 Babylon 到 Cesium 的坐标系转换和相机参数同步
     */
    private moveCesiumCamera() {
        if (!this._cameraController) return;

        // 1. 同步视场角
        if (this._cameraController.fov) {
            const frustum = this.viewer.camera.frustum;
            if (frustum instanceof Cesium.PerspectiveFrustum) {
                // 创建新的 PerspectiveFrustum 来设置视场角
                const newFrustum = new Cesium.PerspectiveFrustum({
                    fov: this._cameraController.fov,
                    aspectRatio: frustum.aspectRatio,
                    near: frustum.near,
                    far: frustum.far
                });
                this.viewer.camera.frustum = newFrustum;
            }
        }

        // 2. 获取 Babylon 相机的位置、方向和上方向
        const babylonPos = this._cameraController.position.clone();
        const babylonTarget = this._cameraController.target.clone();
        const babylonUp = this._cameraController.upVector.clone();

        // 3. 计算方向向量（从位置指向目标）
        const babylonDirection = babylonTarget.subtract(babylonPos).normalize();

        // 4. 转换 Babylon 坐标到 Cesium 坐标系
        // 这里需要使用与 cartesianToBabylon 相对应的逆转换
        const cesiumPos = this.babylonPositionToCesium(babylonPos);
        const cesiumDirection = this.babylonDirectionToCesium(babylonDirection);
        const cesiumUp = this.babylonDirectionToCesium(babylonUp);

        // 5. 设置 Cesium 相机
        this.viewer.camera.position = cesiumPos;
        this.viewer.camera.direction = cesiumDirection;
        this.viewer.camera.up = cesiumUp;

        // 确保方向向量已归一化
        Cesium.Cartesian3.normalize(this.viewer.camera.direction, this.viewer.camera.direction);
        Cesium.Cartesian3.normalize(this.viewer.camera.up, this.viewer.camera.up);

        // 6. 同步 FreeCamera 用于其他计算
        this.camera.position = babylonPos;
        this.camera.setTarget(babylonTarget);
        this.camera.upVector = babylonUp;
        this.camera.fov = this._cameraController.fov;
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

            // 更新太阳光
            if (this.sunLight) {
                // 设置光源位置（在光照方向上的一个远点）
                this.sunLight.position = this._currentSunDirection.scale(this._lightDistance)
                this.sunLight.direction = this._currentSunDirection.scale(-1);
                // 设置光照强度
                this.sunLight.intensity = intensity;
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
     * 将Babylon的位置坐标精确转换为Cesium的Cartesian3坐标
     * 这是cartesianToBabylon方法的逆转换，保证双向转换的一致性
     * @param babylonPos Babylon的位置坐标
     * @returns Cesium的笛卡尔坐标
     */
    private babylonPositionToCesium(babylonPos: BABYLON.Vector3): Cesium.Cartesian3 {
        // 1. 获取基准点的地理坐标
        const basePointCartographic = Cesium.Cartographic.fromCartesian(this.basePoint);

        // 2. 从Babylon坐标系获取距离信息
        // Babylon中：x=东西距离, y=高度差, z=南北距离
        const eastDistance = babylonPos.x;      // 东西方向距离（米）
        const heightDiff = babylonPos.y;        // 高度差（米）
        const northDistance = babylonPos.z;     // 南北方向距离（米）

        // 3. 计算地球半径（WGS84）
        const radius = 6378137.0;

        // 4. 计算经纬度偏移（弧度）
        const lonDiff = eastDistance / (radius * Math.cos(basePointCartographic.latitude));
        const latDiff = northDistance / radius;

        // 5. 计算目标点的地理坐标
        const targetLongitude = basePointCartographic.longitude + lonDiff;
        const targetLatitude = basePointCartographic.latitude + latDiff;
        const targetHeight = basePointCartographic.height + heightDiff;

        // 6. 转换为Cesium的Cartesian3坐标
        return Cesium.Cartesian3.fromRadians(targetLongitude, targetLatitude, targetHeight);
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

        if (this.shadowGenerator) {
            this.shadowGenerator.dispose();
            this.shadowGenerator = null;
        }

        if (this.sunLight) {
            this.sunLight.dispose();
            this.sunLight = null;
        }

        if (this._cameraController) {
            this._cameraController.dispose();
            this._cameraController = null;
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
     * 根据控制模式设置事件处理
     */
    private setupEventHandling(): void {
        if (this._actualControlMode === 'cesium') {
            this.setupCesiumEventHandling();
        } else {
            this.setupBabylonEventHandling();
        }
    }

    /**
     * 设置Cesium模式的点击事件处理
     * 将Cesium的点击事件转发到Babylon场景中进行拾取测试
     */
    private setupCesiumEventHandling(): void {
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
     * 设置Babylon模式的事件处理
     * 在Babylon场景中直接处理点击事件
     */
    private setupBabylonEventHandling(): void {
        // 只在设置了回调函数时添加点击事件处理
        if (!this._options.onMeshPicked) {
            return;
        }

        const onMeshPicked = this._options.onMeshPicked;

        // 设置Babylon的点击事件处理
        this.scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.pickInfo && pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
                const pickedMesh = pointerInfo.pickInfo.pickedMesh;
                onMeshPicked(pickedMesh);
            }
        });
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

    /**
     * 将Babylon的方向向量转换为Cesium的方向向量
     * 这是cesiumDirectionToBabylon方法的逆转换，保证双向转换的一致性
     * @param direction Babylon中的方向向量
     * @returns Cesium中的方向向量
     */
    private babylonDirectionToCesium(direction: BABYLON.Vector3): Cesium.Cartesian3 {
        // 1. 将Babylon坐标系的向量转换为ENU坐标系
        // Babylon到ENU的映射：
        // Babylon X -> East   (x)
        // Babylon Y -> Up     (z)  
        // Babylon Z -> North  (y)
        const localDirection = new Cesium.Cartesian3(
            direction.x,    // East
            direction.z,    // North
            direction.y     // Up
        );

        // 2. 归一化方向向量
        Cesium.Cartesian3.normalize(localDirection, localDirection);

        // 3. 在基准点位置建立一个局部ENU坐标系的变换矩阵
        const transform = Cesium.Transforms.eastNorthUpToFixedFrame(this.basePoint);

        // 4. 将ENU坐标系的方向向量转换为ECEF
        const cesiumDirection = Cesium.Matrix4.multiplyByPointAsVector(
            transform,
            localDirection,
            new Cesium.Cartesian3()
        );

        // 5. 再次归一化确保精度
        return Cesium.Cartesian3.normalize(cesiumDirection, new Cesium.Cartesian3());
    }

    /**
     * 检查相机高度并自动切换控制模式（仅在auto模式下）
     */
    private checkAndUpdateAutoMode(): void {
        if (this._controlMode !== 'auto') return;

        const currentHeight = this.getCurrentCameraHeight();
        const shouldUseCesium = currentHeight > this._autoSwitchHeight;
        const targetMode: 'cesium' | 'babylon' = shouldUseCesium ? 'cesium' : 'babylon';

        if (this._actualControlMode !== targetMode) {
            this.switchActualControlMode(targetMode);
        }
    }

    /**
     * 获取当前相机相对于地面的高度（米）
     */
    private getCurrentCameraHeight(): number {
        // 获取相机位置的地理坐标
        const cameraCartographic = Cesium.Cartographic.fromCartesian(this.viewer.camera.position);
        return cameraCartographic.height;
    }

    /**
     * 动态切换实际控制模式（保持相机位置）
     */
    private switchActualControlMode(newMode: 'cesium' | 'babylon'): void {
        if (this._actualControlMode === newMode) return;

        // 保存当前相机状态
        const currentCesiumPos = this.viewer.camera.position.clone();
        const currentCesiumDir = this.viewer.camera.direction.clone();
        const currentCesiumUp = this.viewer.camera.up.clone();

        this._actualControlMode = newMode;

        // 更新事件处理和相机控制器
        this.updateControlsForMode(newMode);

        // 恢复相机位置
        this.viewer.camera.position = currentCesiumPos;
        this.viewer.camera.direction = currentCesiumDir;
        this.viewer.camera.up = currentCesiumUp;

        // 同步到对应的Babylon相机
        if (newMode === 'cesium') {
            this.moveBabylonCamera();
            // 确保FreeCamera是活动相机
            this.scene.activeCamera = this.camera;
        } else {
            // 在Babylon控制模式下，使用简单但可靠的方法
            if (this._cameraController) {
                // 获取当前Babylon坐标系下的位置
                const babylonPos = this.cartesianToBabylon(currentCesiumPos);

                // 设置一个安全的目标点（场景中心附近）
                const targetPos = new BABYLON.Vector3(0, 0, 0);

                // 计算从相机到目标的距离
                const distance = BABYLON.Vector3.Distance(babylonPos, targetPos);

                // 确保距离在合理范围内
                const safeDistance = Math.max(50, Math.min(distance, 500));

                // 设置目标和相机参数
                this._cameraController.setTarget(targetPos);
                this._cameraController.radius = safeDistance;

                // 使用简单的角度设置
                this._cameraController.alpha = 0;
                this._cameraController.beta = Math.PI / 4; // 45度俯视角

                // 重建位置
                this._cameraController.rebuildAnglesAndRadius();

                // 设置为活动相机
                this.scene.activeCamera = this._cameraController;
            }
        }

        // 强制触发一次渲染以确保所有更新生效
        if (this._autoRender && this.scene) {
            this.scene.render();
        }

        console.log(`Switched to ${newMode} mode - Camera controller attached: ${this._cameraController?.attachControl !== undefined}`);
    }

    /**
     * 根据控制模式更新控件设置
     */
    private updateControlsForMode(mode: 'cesium' | 'babylon'): void {
        if (mode === 'cesium') {
            // 切换到Cesium控制
            this.babylonCanvas.style.pointerEvents = 'none';
            this.cesiumContainer.style.pointerEvents = 'auto';

            // 如果有ArcRotateCamera，禁用其控制
            if (this._cameraController) {
                this._cameraController.detachControl();
            }
        } else {
            // 切换到Babylon控制
            this.babylonCanvas.style.pointerEvents = 'auto';
            this.cesiumContainer.style.pointerEvents = 'none';

            // 如果没有ArcRotateCamera，创建一个
            if (!this._cameraController) {
                this._cameraController = new BABYLON.ArcRotateCamera(
                    'arcCamera',
                    -Math.PI / 2,
                    Math.PI / 3,
                    300,
                    BABYLON.Vector3.Zero(),
                    this.scene
                );

                // 设置相机控制参数
                this._cameraController.lowerBetaLimit = 0.1;
                this._cameraController.upperBetaLimit = Math.PI / 2 - 0.1;
                this._cameraController.lowerRadiusLimit = 10;
                this._cameraController.upperRadiusLimit = 2000;
                this._cameraController.fov = Math.PI / 4;
            }

            // 确保ArcRotateCamera已经从任何旧的控制中分离
            this._cameraController.detachControl();

            // 重新附加到当前canvas
            this._cameraController.attachControl(this.babylonCanvas, true);

            // 确保相机是当前活动的相机
            this.scene.activeCamera = this._cameraController;
        }
    }

    /**
     * 设置控制模式
     * @param mode 控制模式：'cesium' | 'babylon' | 'auto'
     */
    public setControlMode(mode: 'cesium' | 'babylon' | 'auto'): void {
        if (this._controlMode === mode) return;

        const oldMode = this._controlMode;
        this._controlMode = mode;

        if (mode === 'auto') {
            // 切换到auto模式，根据当前高度确定实际模式
            const currentHeight = this.getCurrentCameraHeight();
            const targetMode: 'cesium' | 'babylon' = currentHeight > this._autoSwitchHeight ? 'cesium' : 'babylon';
            this.switchActualControlMode(targetMode);
        } else {
            // 切换到固定模式
            this._actualControlMode = mode;
            this.switchActualControlMode(mode);
        }

        console.log(`Control mode switched from ${oldMode} to ${mode} (actual: ${this._actualControlMode})`);
    }

    /**
     * 设置auto模式的高度切换阈值
     * @param height 高度阈值（米），高于此值使用Cesium控制，低于此值使用Babylon控制
     */
    public setAutoSwitchHeight(height: number): void {
        this._autoSwitchHeight = height;
        // 如果当前是auto模式，立即检查是否需要切换
        if (this._controlMode === 'auto') {
            this.checkAndUpdateAutoMode();
        }
    }
} 