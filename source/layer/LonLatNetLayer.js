import Event from '../core/Event.js'
import defaultValue from '../core/defaultValue.js';
import LonlatTilingScheme from '../core/LonlatTilingScheme.js';
function buildText(imageryProvider, x, y, level) {
    let text = [];
    let getValue = imageryProvider._tags['z'];
    text[0] = 'L: ' + getValue(imageryProvider, x, y, level);
    getValue = imageryProvider._tags['x'];
    text[1] = 'X: ' + getValue(imageryProvider, x, y, level);
    if (imageryProvider.reverseY) {
        getValue = imageryProvider._tags['reverseY'];
    } else {
        getValue = imageryProvider._tags['y'];
    }
    text[2] = 'Y: ' + getValue(imageryProvider, x, y, level);
    return text;
}
class LonLatNetLayer {
    /**
     * 创建一个提供经纬网的图层。
     * @param {Object} [options] 具有以下属性。
     * @param {String} [options.font='bold 24px sans-serif'] 字体
     * @param {String} [options.color = 'white'] 文字颜色
     * @param {String} [options.borderColor = 'gold'] 边框颜色
     * @param {String} [options.borderWidth = 2] 边框宽度
     * @param {Number} [options.intervalOfZeorLevel=16] 0级两条线之间的度数
     * @param {Boolean} [options.hasAlphaChannel=true] 是否有alpha通道
     */
    constructor(options = {}) {
        const tilingScheme = new LonlatTilingScheme({
            rectangle: Cesium.Rectangle.MAX_VALUE,
            intervalOfZeorLevel: options.intervalOfZeorLevel
        });
        this._hasAlphaChannel = defaultValue(options.hasAlphaChannel, true);
        this._tilingScheme = tilingScheme;
        this._image = undefined;
        this._texture = undefined;

        this._errorEvent = new Event();

        this._ready = true;
        this._readyPromise = Cesium.when.defer();
        this._readyPromise.resolve(true);

        this._font = defaultValue(options.font, 'bold 24px sans-serif');
        this._color = defaultValue(options.color, 'white');
        this._borderColor = defaultValue(options.borderColor, 'gold')
        this._borderWidth = defaultValue(options.borderWidth, 2)
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 256;
        this.canvas.height = 256;
        this.ctx.textBaseline = 'middle';
    }
    get hasAlphaChannel() {
        return this._hasAlphaChannel;
    }
    get tileHeight() {
        return 256;
    }
    get tileWidth() {
        return 256;
    }
    get minimumLevel() {
        return 0;
    }
    get maximumLevel() {
        return 4;
    }
    get rectangle() {
        return Cesium.Rectangle.MAX_VALUE;
    }
    get errorEvent() {
        return this._errorEvent;
    }
    get tileDiscardPolicy() {
        return undefined;
    }
    get readyPromise() {
        return this._readyPromise;
    }
    get ready() {
        return true;
    }
    /**
     * 图层的坐标系
     * @type {Cesium.TilingScheme}
     * @readonly
     */
    get tilingScheme() {
        return this._tilingScheme;
    }
    /**
     * 获得或设置字体
     * @type {String}
     */
    get font() {
        return this._font;
    }
    set font(val) {
        this._font = val;
    }
    /**
     * 获得或设置文字颜色
     * @type {String}
     */
    get color() {
        return this._color;
    }
    set color(val) {
        this._color = val;
    }
    /**
     * 获得或设置边框颜色
     * @type {String}
     */
    get borderColor() {
        return this._borderColor;
    }
    set borderColor(val) {
        this._borderColor = val;
    }
    /**
     * 获得或设置边框宽度
     * @type {Number}
     */
    get borderWidth() {
        return this._borderWidth
    }
    _resetStyle() {
        // this.ctx.textAlign = 'left';
        this.ctx.font = this.font;
        this.ctx.fillStyle = this.color;
        this.ctx.strokeStyle = this.borderColor;
        this.ctx.lineWidth = this.borderWidth
    }
    _clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    getOffset(left, top, level) {
        const delta = this.tilingScheme.getDelatXY(level);
        const validValueX = Math.floor(left);
        const validValueY = Math.floor(top);
        if (validValueX === left && validValueY === top) {
            return [0, 0, validValueX, validValueY]
        }
        const modX = left - validValueX;
        const modY = top - validValueY;
        let x = 0, y = 0;
        if (modX) {
            x = this.tileWidth / delta.dx * modX;
        }
        if(modY) {
            y = this.tileHeight / delta.dy * modY;
        }
        return [x, y, validValueX, validValueY]
    }
    requestImage(x, y, level, request) {
        this._clearCanvas()
        this._resetStyle();
        const { canvas, ctx } = this;
        const value = this.tilingScheme.getLonLatValuee(level, x, y);
        const value1 = this.tilingScheme.tileXYToNativeRectangle(x, y, level);
        this.ctx.textAlign = 'left';
        ctx.fillText(value.lon, 10, canvas.height / 2);
        this.ctx.textAlign = 'center';
        ctx.fillText(value.lat, canvas.width / 2, 20);
        ctx.strokeRect(0, 0, canvas.width, canvas.height);
        return canvas;
    }

}
export default LonLatNetLayer;