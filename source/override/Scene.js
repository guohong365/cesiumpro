import createInRegionShader from '../core/createInRegionShader'
import attachCustomUniforms from '../core/attachCustomUniforms'
const CesiumScene = Cesium.Scene;
const {
    JulianDate,
    defined,
    RequestScheduler,
    PerformanceDisplay,
    Cesium3DTilePassState,
    Cesium3DTilePass,
    defaultValue,
    Color,
    BoundingRectangle,
    Pass,
    SunLight,
    Cartesian3
} = Cesium;
const preloadTilesetPassState = new Cesium3DTilePassState({
    pass: Cesium3DTilePass.PRELOAD,
});

const preloadFlightTilesetPassState = new Cesium3DTilePassState({
    pass: Cesium3DTilePass.PRELOAD_FLIGHT,
});

const requestRenderModeDeferCheckPassState = new Cesium3DTilePassState({
    pass: Cesium3DTilePass.REQUEST_RENDER_MODE_DEFER_CHECK,
});

function updateFrameNumber(scene, frameNumber, time) {
    var frameState = scene._frameState;
    frameState.frameNumber = frameNumber;
    frameState.time = JulianDate.clone(time, frameState.time);
}
function tryAndCatchError(scene, functionToExecute) {
    try {
        functionToExecute(scene);
    } catch (error) {
        scene._renderError.raiseEvent(scene, error);

        if (scene.rethrowRenderErrors) {
            throw error;
        }
    }
}
function updateDebugShowFramesPerSecond(scene, renderedThisFrame) {
    if (scene.debugShowFramesPerSecond) {
        if (!defined(scene._performanceDisplay)) {
            var performanceContainer = document.createElement("div");
            performanceContainer.className =
                "cesium-performanceDisplay-defaultContainer";
            var container = scene._canvas.parentNode;
            container.appendChild(performanceContainer);
            var performanceDisplay = new PerformanceDisplay({
                container: performanceContainer,
            });
            scene._performanceDisplay = performanceDisplay;
            scene._performanceContainer = performanceContainer;
        }

        scene._performanceDisplay.throttled = scene.requestRenderMode;
        scene._performanceDisplay.update(renderedThisFrame);
    } else if (defined(scene._performanceDisplay)) {
        scene._performanceDisplay =
            scene._performanceDisplay && scene._performanceDisplay.destroy();
        scene._performanceContainer.parentNode.removeChild(
            scene._performanceContainer
        );
    }
}
function callAfterRenderFunctions(scene) {
    // Functions are queued up during primitive update and executed here in case
    // the function modifies scene state that should remain constant over the frame.
    var functions = scene._frameState.afterRender;
    for (var i = 0, length = functions.length; i < length; ++i) {
        functions[i]();
        scene.requestRender();
    }

    functions.length = 0;
}
function prePassesUpdate(scene) {
    scene._jobScheduler.resetBudgets();

    var frameState = scene._frameState;
    var primitives = scene.primitives;
    primitives.prePassesUpdate(frameState);

    if (defined(scene.globe)) {
        scene.globe.update(frameState);
    }

    scene._picking.update();
    frameState.creditDisplay.update();
}
function updateMostDetailedRayPicks(scene) {
    return scene._picking.updateMostDetailedRayPicks(scene);
}
function updatePreloadPass(scene) {
    var frameState = scene._frameState;
    preloadTilesetPassState.camera = frameState.camera;
    preloadTilesetPassState.cullingVolume = frameState.cullingVolume;

    var primitives = scene.primitives;
    primitives.updateForPass(frameState, preloadTilesetPassState);
}
function updatePreloadFlightPass(scene) {
    var frameState = scene._frameState;
    var camera = frameState.camera;
    if (!camera.canPreloadFlight()) {
        return;
    }

    preloadFlightTilesetPassState.camera = scene.preloadFlightCamera;
    preloadFlightTilesetPassState.cullingVolume =
        scene.preloadFlightCullingVolume;

    var primitives = scene.primitives;
    primitives.updateForPass(frameState, preloadFlightTilesetPassState);
}
const renderTilesetPassState = new Cesium3DTilePassState({
    pass: Cesium3DTilePass.RENDER,
});
function updateRequestRenderModeDeferCheckPass(scene) {
    // Check if any ignored requests are ready to go (to wake rendering up again)
    scene.primitives.updateForPass(
        scene._frameState,
        requestRenderModeDeferCheckPassState
    );
}
function postPassesUpdate(scene) {
    var frameState = scene._frameState;
    var primitives = scene.primitives;
    primitives.postPassesUpdate(frameState);

    RequestScheduler.update();
}
function render(scene) {
    var frameState = scene._frameState;

    var context = scene.context;
    var us = context.uniformState;

    var view = scene._defaultView;
    scene._view = view;

    scene.updateFrameState();
    frameState.passes.render = true;
    frameState.passes.postProcess = scene.postProcessStages.hasSelected;
    frameState.tilesetPassState = renderTilesetPassState;

    var backgroundColor = defaultValue(scene.backgroundColor, Color.BLACK);
    if (scene._hdr) {
        backgroundColor = Color.clone(backgroundColor, scratchBackgroundColor);
        backgroundColor.red = Math.pow(backgroundColor.red, scene.gamma);
        backgroundColor.green = Math.pow(backgroundColor.green, scene.gamma);
        backgroundColor.blue = Math.pow(backgroundColor.blue, scene.gamma);
    }
    frameState.backgroundColor = backgroundColor;

    scene.fog.update(frameState);

    us.update(frameState);

    var shadowMap = scene.shadowMap;
    if (defined(shadowMap) && shadowMap.enabled) {
        if (!defined(scene.light) || scene.light instanceof SunLight) {
            // Negate the sun direction so that it is from the Sun, not to the Sun
            Cartesian3.negate(us.sunDirectionWC, scene._shadowMapCamera.direction);
        } else {
            Cartesian3.clone(scene.light.direction, scene._shadowMapCamera.direction);
        }
        frameState.shadowMaps.push(shadowMap);
    }

    scene._computeCommandList.length = 0;
    scene._overlayCommandList.length = 0;

    var viewport = view.viewport;
    viewport.x = 0;
    viewport.y = 0;
    viewport.width = context.drawingBufferWidth;
    viewport.height = context.drawingBufferHeight;

    var passState = view.passState;
    passState.framebuffer = undefined;
    passState.blendingEnabled = undefined;
    passState.scissorTest = undefined;
    passState.viewport = BoundingRectangle.clone(viewport, passState.viewport);

    if (defined(scene.globe)) {
        scene.globe.beginFrame(frameState);
        // cesiumpro override
        attachCustomUniforms(scene)
        scene._vectorTileQuadtree.beginFrame(frameState)
    }
    scene.updateEnvironment();
    scene.updateAndExecuteCommands(passState, backgroundColor);
    // cesiumpro override
    scene.globe && scene._vectorTileQuadtree.render(frameState);
    scene.resolveFramebuffers(passState);

    passState.framebuffer = undefined;
    executeOverlayCommands(scene, passState);

    if (defined(scene.globe)) {
        scene.globe.endFrame(frameState);
        // cesiumpro override
        scene._vectorTileQuadtree.endFrame(frameState)
        scene.globe && scene.globe.clipRegion.update(frameState);
        if (!scene.globe.tilesLoaded) {
            scene._renderRequested = true;
        }
    }
    context.endFrame();
}
function executeOverlayCommands(scene, passState) {
    var us = scene.context.uniformState;
    us.updatePass(Pass.OVERLAY);

    var context = scene.context;
    var commandList = scene._overlayCommandList;
    var length = commandList.length;
    for (var i = 0; i < length; ++i) {
        commandList[i].execute(context, passState);
    }
}
function sceneRender(time) {
    this._preUpdate.raiseEvent(this, time);

    var frameState = this._frameState;
    frameState.newFrame = false;

    if (!defined(time)) {
        time = JulianDate.now();
    }

    // Determine if shouldRender
    var cameraChanged = this._view.checkForCameraUpdates(this);
    var shouldRender =
        !this.requestRenderMode ||
        this._renderRequested ||
        cameraChanged ||
        this._logDepthBufferDirty ||
        this._hdrDirty ||
        this.mode === SceneMode.MORPHING;
    if (
        !shouldRender &&
        defined(this.maximumRenderTimeChange) &&
        defined(this._lastRenderTime)
    ) {
        var difference = Math.abs(
            JulianDate.secondsDifference(this._lastRenderTime, time)
        );
        shouldRender = shouldRender || difference > this.maximumRenderTimeChange;
    }

    if (shouldRender) {
        this._lastRenderTime = JulianDate.clone(time, this._lastRenderTime);
        this._renderRequested = false;
        this._logDepthBufferDirty = false;
        this._hdrDirty = false;

        var frameNumber = Cesium.Math.incrementWrap(
            frameState.frameNumber,
            15000000.0,
            1.0
        );
        updateFrameNumber(this, frameNumber, time);
        frameState.newFrame = true;
    }

    tryAndCatchError(this, prePassesUpdate);

    /**
     *
     * Passes update. Add any passes here
     *
     */
    if (this.primitives.show) {
        tryAndCatchError(this, updateMostDetailedRayPicks);
        tryAndCatchError(this, updatePreloadPass);
        tryAndCatchError(this, updatePreloadFlightPass);
        if (!shouldRender) {
            tryAndCatchError(this, updateRequestRenderModeDeferCheckPass);
        }
    }

    this._postUpdate.raiseEvent(this, time);

    if (shouldRender) {
        this._preRender.raiseEvent(this, time);
        frameState.creditDisplay.beginFrame();
        createInRegionShader(this);
        tryAndCatchError(this, render);
    }

    /**
     *
     * Post passes update. Execute any pass invariant code that should run after the passes here.
     *
     */
    updateDebugShowFramesPerSecond(this, shouldRender);
    tryAndCatchError(this, postPassesUpdate);

    // Often used to trigger events (so don't want in trycatch) that the user might be subscribed to. Things like the tile load events, ready promises, etc.
    // We don't want those events to resolve during the render loop because the events might add new primitives
    callAfterRenderFunctions(this);

    if (shouldRender) {
        this._postRender.raiseEvent(this, time);
        frameState.creditDisplay.endFrame();
    }
}
class Scene {
    static overrideRenderFunction() {
        CesiumScene.prototype.render = sceneRender;
    }

}
function override() {    
    Scene.overrideRenderFunction();
}
export default override;