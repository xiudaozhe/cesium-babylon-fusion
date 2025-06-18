import * as BABYLON from '@babylonjs/core';
import * as Cesium from 'cesium';

export interface CesiumBabylonFusionOptions {
    container: HTMLDivElement;
    cesiumOptions?: Cesium.Viewer.ConstructorOptions;
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
}

export class CesiumBabylonFusion {
    private viewer!: Cesium.Viewer;
    private engine!: BABYLON.Engine;
    private scene!: BABYLON.Scene;
    private camera!: BABYLON.FreeCamera;
    private sunLight!: BABYLON.DirectionalLight;
    private hemisphericLight!: BABYLON.HemisphericLight;
    private basePoint!: Cesium.Cartesian3;
    private cesiumCanvas!: HTMLCanvasElement;
    private babylonCanvas!: HTMLCanvasElement;
    private _isDisposed: boolean = false;
    private _autoRender: boolean = true;
    private _enableLightSync: boolean = true;
    private _resizeObserver!: ResizeObserver;

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

        this._autoRender = options.autoRender ?? true;
        this._enableLightSync = options.enableLightSync ?? true;
        this.basePoint = options.basePoint || Cesium.Cartesian3.ZERO;

        try {
            this.initializeCanvases(options.container);
            this.initializeCesium(options.cesiumOptions);
            this.initializeBabylon();
            this.setupRenderLoop();
            this.setupResizeHandling(options.container);
        } catch (error) {
            this.dispose();
            throw error;
        }
    }

    private initializeCanvases(container: HTMLDivElement): void {
        // Create Cesium canvas
        this.cesiumCanvas = document.createElement('canvas');
        this.cesiumCanvas.style.width = '100%';
        this.cesiumCanvas.style.height = '100%';
        this.cesiumCanvas.style.position = 'absolute';
        container.appendChild(this.cesiumCanvas);

        // Create Babylon canvas
        this.babylonCanvas = document.createElement('canvas');
        this.babylonCanvas.style.width = '100%';
        this.babylonCanvas.style.height = '100%';
        this.babylonCanvas.style.position = 'absolute';
        this.babylonCanvas.style.pointerEvents = 'none';
        container.appendChild(this.babylonCanvas);
    }

    private initializeCesium(cesiumOptions?: Cesium.Viewer.ConstructorOptions): void {
        this.viewer = new Cesium.Viewer(this.cesiumCanvas, {
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
        this.engine = new BABYLON.Engine(this.babylonCanvas, true);
        this.scene = new BABYLON.Scene(this.engine);
        this.camera = new BABYLON.FreeCamera('camera', new BABYLON.Vector3(0, 0, 0), this.scene);
        this.sunLight = new BABYLON.DirectionalLight('sunLight', new BABYLON.Vector3(0, -1, 0), this.scene);
        this.hemisphericLight = new BABYLON.HemisphericLight('hemisphericLight', new BABYLON.Vector3(0, 1, 0), this.scene);
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

        // 2. 获取 Cesium 相机的逆视图矩阵
        let civm = this.viewer.camera.inverseViewMatrix;
        // 创建对应的 Babylon 矩阵
        let camera_matrix = BABYLON.Matrix.FromValues(
            civm[0], civm[1], civm[2], civm[3],
            civm[4], civm[5], civm[6], civm[7],
            civm[8], civm[9], civm[10], civm[11],
            civm[12], civm[13], civm[14], civm[15]
        );

        // 3. 分解矩阵获取位置和旋转信息
        let scaling = new BABYLON.Vector3();
        let rotation = new BABYLON.Quaternion();
        let transform = new BABYLON.Vector3();
        camera_matrix.decompose(scaling, rotation, transform);

        // 4. 转换相机位置和方向
        // 注意：Cesium 和 Babylon 使用不同的坐标系，需要转换
        let camera_pos = this.cart2vec(transform as unknown as Cesium.Cartesian3);
        let camera_direction = this.cart2vec(this.viewer.camera.direction);
        let camera_up = this.cart2vec(this.viewer.camera.up);

        // 5. 计算欧拉角旋转
        // 计算 Y 轴旋转（偏航角）
        let rotation_y = Math.atan(camera_direction.z / camera_direction.x);
        if (camera_direction.x < 0) rotation_y += Math.PI;
        rotation_y = Math.PI / 2 - rotation_y;

        // 计算 X 轴旋转（俯仰角）
        let rotation_x = Math.asin(-camera_direction.y);

        // 计算 Z 轴旋转（翻滚角）
        // 首先计算相机向上方向在 Y 轴旋转之前的理论值
        let camera_up_before_rotatez = new BABYLON.Vector3(-Math.cos(rotation_y), 0, Math.sin(rotation_y));
        // 然后通过当前相机向上方向和理论值的夹角计算 Z 轴旋转
        let rotation_z = Math.acos(
            camera_up.x * camera_up_before_rotatez.x +
            camera_up.y * camera_up_before_rotatez.y +
            camera_up.z * camera_up_before_rotatez.z
        );
        rotation_z = Math.PI / 2 - rotation_z;
        if (camera_up.y < 0) rotation_z = Math.PI - rotation_z;

        // 6. 应用位置和旋转
        // 位置需要考虑基准点的偏移
        this.camera.position.x = camera_pos.x - this.basePoint.x;
        this.camera.position.y = camera_pos.y - this.basePoint.y;
        this.camera.position.z = camera_pos.z - this.basePoint.z;
        // 应用欧拉角旋转
        this.camera.rotation.x = rotation_x;
        this.camera.rotation.y = rotation_y;
        this.camera.rotation.z = rotation_z;

        // 7. 更新光照
        this.updateBabylonLighting();
    }

    /**
     * 同步 Cesium 的光照到 Babylon 场景
     * 包括太阳光方向和强度的同步
     */
    private updateBabylonLighting() {
        // 1. 检查 Cesium 是否启用了光照
        // sphericalHarmonicCoefficients 存在表示场景中有光照计算
        const sunPosition = this.viewer.scene.globe.enableLighting &&
            this.viewer.scene.globe.lightingFadeOutDistance > 0
            ? this.viewer.scene.sphericalHarmonicCoefficients
            : null;

        if (sunPosition) {
            // 2. 获取太阳光源信息
            const light = this.viewer.scene.light;
            const sunDirection = new Cesium.Cartesian3();
            // 如果有光源使用 1.0 的强度，否则使用 0.5 作为默认值
            const intensity = light ? 1.0 : 0.5;

            // 3. 确定太阳方向
            if (light && 'direction' in light && light.direction instanceof Cesium.Cartesian3) {
                // 如果有有效的光源方向，就使用它
                Cesium.Cartesian3.clone(light.direction, sunDirection);
            } else {
                // 否则使用默认的向下方向
                Cesium.Cartesian3.fromElements(0, -1, 0, sunDirection);
            }

            // 4. 转换为 Babylon 的坐标系
            // 注意：需要反转方向因为 Babylon 和 Cesium 的坐标系不同
            const babylonSunDirection = new BABYLON.Vector3(
                -sunDirection.x,
                -sunDirection.y,
                -sunDirection.z
            );

            // 5. 更新 Babylon 场景的光照
            // 更新直射光方向
            this.sunLight.direction = babylonSunDirection;

            // 6. 设置光照强度
            // 直射光使用完整强度
            this.sunLight.intensity = intensity;
            // 环境光使用较低的强度以提供柔和的填充光
            this.hemisphericLight.intensity = intensity * 0.3;
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

        if (this.cesiumCanvas && this.cesiumCanvas.parentNode) {
            this.cesiumCanvas.parentNode.removeChild(this.cesiumCanvas);
        }

        if (this.babylonCanvas && this.babylonCanvas.parentNode) {
            this.babylonCanvas.parentNode.removeChild(this.babylonCanvas);
        }
    }
} 