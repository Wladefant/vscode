/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PixelRatio } from 'vs/base/browser/browser';
import * as dom from 'vs/base/browser/dom';
import { GlobalPointerMoveMonitor } from 'vs/base/browser/globalPointerMoveMonitor';
import { Widget } from 'vs/base/browser/ui/widget';
import { Codicon } from 'vs/base/common/codicons';
import { Color, HSVA, RGBA } from 'vs/base/common/color';
import { Emitter, Event } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';
import { ThemeIcon } from 'vs/base/common/themables';
import 'vs/css!./colorPicker';
import { ColorPickerModel } from 'vs/editor/contrib/colorPicker/browser/colorPickerModel';
import { IEditorHoverColorPickerWidget } from 'vs/editor/contrib/hover/browser/hoverTypes';
import { localize } from 'vs/nls';
import { editorHoverBackground } from 'vs/platform/theme/common/colorRegistry';
import { registerIcon } from 'vs/platform/theme/common/iconRegistry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
const $ = dom.$;

export class ColorPickerHeader extends Disposable {

	private readonly _domNode: HTMLElement;
	private readonly pickedColorNode: HTMLElement;
	private backgroundColor: Color;
	private readonly _closeButton: CloseButton | null = null;

	constructor(container: HTMLElement, private readonly model: ColorPickerModel, themeService: IThemeService, private showingStandaloneColorPicker: boolean = false) {
		super();

		this._domNode = $('.colorpicker-header');
		dom.append(container, this._domNode);

		this.pickedColorNode = dom.append(this._domNode, $('.picked-color'));

		const tooltip = localize('clickToToggleColorOptions', "Click to toggle color options (rgb/hsl/hex)");
		this.pickedColorNode.setAttribute('title', tooltip);

		const colorBox = dom.append(this._domNode, $('.original-color'));
		colorBox.style.backgroundColor = Color.Format.CSS.format(this.model.originalColor) || '';

		this.backgroundColor = themeService.getColorTheme().getColor(editorHoverBackground) || Color.white;
		this._register(themeService.onDidColorThemeChange(theme => {
			this.backgroundColor = theme.getColor(editorHoverBackground) || Color.white;
		}));

		this._register(dom.addDisposableListener(this.pickedColorNode, dom.EventType.CLICK, () => this.model.selectNextColorPresentation()));
		this._register(dom.addDisposableListener(colorBox, dom.EventType.CLICK, () => {
			this.model.color = this.model.originalColor;
			this.model.flushColor();
		}));
		this._register(model.onDidChangeColor(this.onDidChangeColor, this));
		this._register(model.onDidChangePresentation(this.onDidChangePresentation, this));
		this.pickedColorNode.style.backgroundColor = Color.Format.CSS.format(model.color) || '';
		this.pickedColorNode.classList.toggle('light', model.color.rgba.a < 0.5 ? this.backgroundColor.isLighter() : model.color.isLighter());

		this.onDidChangeColor(this.model.color);

		if (this.showingStandaloneColorPicker) {
			this._closeButton = new CloseButton(this._domNode);
			this._register(this._closeButton);
			this._domNode.classList.add('standalone-color-picker');
		}
	}

	public get domNode(): HTMLElement {
		return this._domNode;
	}

	public get closeButton(): CloseButton | null {
		return this._closeButton;
	}

	private onDidChangeColor(color: Color): void {
		this.pickedColorNode.style.backgroundColor = Color.Format.CSS.format(color) || '';
		this.pickedColorNode.classList.toggle('light', color.rgba.a < 0.5 ? this.backgroundColor.isLighter() : color.isLighter());
		this.onDidChangePresentation();
	}

	private onDidChangePresentation(): void {
		this.pickedColorNode.textContent = this.model.presentation ? this.model.presentation.label : '';
		this.pickedColorNode.prepend($('.codicon.codicon-color-mode'));
	}
}

class CloseButton extends Disposable {

	private _button: HTMLElement;
	private readonly _onClicked = this._register(new Emitter<void>());
	public readonly onClicked = this._onClicked.event;

	constructor(container: HTMLElement) {
		super();
		this._button = document.createElement('div');
		const closeButtonInnerDiv = document.createElement('div');
		dom.append(container, this._button);
		dom.append(this._button, closeButtonInnerDiv);
		this._button.classList.add('color-picker-close-button-outer-div');
		closeButtonInnerDiv.classList.add('color-picker-close-button-inner-div');
		const closeIcon = registerIcon('color-picker-close', Codicon.close, localize('closeIcon', 'Icon to close the color picker'));
		const closeButton = dom.append(closeButtonInnerDiv, $('.button' + ThemeIcon.asCSSSelector(closeIcon)));
		closeButton.classList.add('color-picker-close-button');
		this._button.onclick = e => {
			this._onClicked.fire();
		};
	}
}

export class ColorPickerBody extends Disposable {

	private readonly _domNode: HTMLElement;
	private readonly _saturationBox: SaturationBox;
	private readonly _hueStrip: Strip;
	private readonly _opacityStrip: Strip;
	private readonly _insertButton: InsertButton | null = null;

	constructor(container: HTMLElement, private readonly model: ColorPickerModel, private pixelRatio: number, private showingStandaloneColorPicker: boolean = false) {
		super();

		this._domNode = $('.colorpicker-body');
		dom.append(container, this._domNode);

		this._saturationBox = new SaturationBox(this._domNode, this.model, this.pixelRatio);
		this._register(this._saturationBox);
		this._register(this._saturationBox.onDidChange(this.onDidSaturationValueChange, this));
		this._register(this._saturationBox.onColorFlushed(this.flushColor, this));

		this._opacityStrip = new OpacityStrip(this._domNode, this.model, showingStandaloneColorPicker);
		this._register(this._opacityStrip);
		this._register(this._opacityStrip.onDidChange(this.onDidOpacityChange, this));
		this._register(this._opacityStrip.onColorFlushed(this.flushColor, this));

		this._hueStrip = new HueStrip(this._domNode, this.model, showingStandaloneColorPicker);
		this._register(this._hueStrip);
		this._register(this._hueStrip.onDidChange(this.onDidHueChange, this));
		this._register(this._hueStrip.onColorFlushed(this.flushColor, this));

		if (this.showingStandaloneColorPicker) {
			this._insertButton = new InsertButton(this._domNode);
			this._register(this._insertButton);
			this._domNode.classList.add('standalone-color-picker');
		}
	}

	private flushColor(): void {
		this.model.flushColor();
	}

	private onDidSaturationValueChange({ s, v }: { s: number; v: number }): void {
		const hsva = this.model.color.hsva;
		this.model.color = new Color(new HSVA(hsva.h, s, v, hsva.a));
	}

	private onDidOpacityChange(a: number): void {
		const hsva = this.model.color.hsva;
		this.model.color = new Color(new HSVA(hsva.h, hsva.s, hsva.v, a));
	}

	private onDidHueChange(value: number): void {
		const hsva = this.model.color.hsva;
		const h = (1 - value) * 360;

		this.model.color = new Color(new HSVA(h === 360 ? 0 : h, hsva.s, hsva.v, hsva.a));
	}

	get domNode() {
		return this._domNode;
	}

	get saturationBox() {
		return this._saturationBox;
	}

	get opacityStrip() {
		return this._opacityStrip;
	}

	get hueStrip() {
		return this._hueStrip;
	}

	get enterButton() {
		return this._insertButton;
	}

	layout(): void {
		console.log('inside of layout of the color picker body');
		this._saturationBox.layout();
		this._opacityStrip.layout();
		this._hueStrip.layout();
	}
}

class SaturationBox extends Disposable {

	private readonly _domNode: HTMLElement;
	private readonly selection: HTMLElement;
	private readonly _canvas: HTMLCanvasElement;
	private width!: number;
	private height!: number;

	private monitor: GlobalPointerMoveMonitor | null;
	private readonly _onDidChange = new Emitter<{ s: number; v: number }>();
	readonly onDidChange: Event<{ s: number; v: number }> = this._onDidChange.event;

	private readonly _onColorFlushed = new Emitter<void>();
	readonly onColorFlushed: Event<void> = this._onColorFlushed.event;

	constructor(container: HTMLElement, private readonly model: ColorPickerModel, private pixelRatio: number) {
		super();

		this._domNode = $('.saturation-wrap');
		dom.append(container, this._domNode);

		// Create canvas, draw selected color
		this._canvas = document.createElement('canvas');
		this._canvas.className = 'saturation-box';
		dom.append(this._domNode, this._canvas);

		// Add selection circle
		this.selection = $('.saturation-selection');
		dom.append(this._domNode, this.selection);

		this.layout();

		this._register(dom.addDisposableListener(this._domNode, dom.EventType.POINTER_DOWN, e => this.onPointerDown(e)));
		this._register(this.model.onDidChangeColor(this.onDidChangeColor, this));
		this.monitor = null;
	}

	public get domNode() {
		return this._domNode;
	}

	public get canvas() {
		return this._canvas;
	}

	private onPointerDown(e: PointerEvent): void {
		if (!e.target || !(e.target instanceof Element)) {
			return;
		}
		this.monitor = this._register(new GlobalPointerMoveMonitor());
		const origin = dom.getDomNodePagePosition(this._domNode);

		if (e.target !== this.selection) {
			this.onDidChangePosition(e.offsetX, e.offsetY);
		}

		this.monitor.startMonitoring(e.target, e.pointerId, e.buttons, event => this.onDidChangePosition(event.pageX - origin.left, event.pageY - origin.top), () => null);

		const pointerUpListener = dom.addDisposableListener(document, dom.EventType.POINTER_UP, () => {
			this._onColorFlushed.fire();
			pointerUpListener.dispose();
			if (this.monitor) {
				this.monitor.stopMonitoring(true);
				this.monitor = null;
			}
		}, true);
	}

	private onDidChangePosition(left: number, top: number): void {
		const s = Math.max(0, Math.min(1, left / this.width));
		const v = Math.max(0, Math.min(1, 1 - (top / this.height)));

		this.paintSelection(s, v);
		this._onDidChange.fire({ s, v });
	}

	layout(): void {
		console.log('inside of the layout of the saturation box');
		this.width = this._domNode.offsetWidth;
		this.height = this._domNode.offsetHeight;
		console.log('this.width : ', this.width);
		console.log('this.heigth : ', this.height);

		// TODO: works if hard-coding the values, need to figure out why the above is zero
		this._canvas.width = this.width * this.pixelRatio;
		this._canvas.height = this.height * this.pixelRatio;
		this.paint();

		const hsva = this.model.color.hsva;
		this.paintSelection(hsva.s, hsva.v);
	}

	private paint(): void {
		const hsva = this.model.color.hsva;
		const saturatedColor = new Color(new HSVA(hsva.h, 1, 1, 1));
		const ctx = this._canvas.getContext('2d')!;

		const whiteGradient = ctx.createLinearGradient(0, 0, this._canvas.width, 0);
		whiteGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
		whiteGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
		whiteGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

		const blackGradient = ctx.createLinearGradient(0, 0, 0, this._canvas.height);
		blackGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
		blackGradient.addColorStop(1, 'rgba(0, 0, 0, 1)');

		ctx.rect(0, 0, this._canvas.width, this._canvas.height);
		ctx.fillStyle = Color.Format.CSS.format(saturatedColor)!;
		ctx.fill();
		ctx.fillStyle = whiteGradient;
		ctx.fill();
		ctx.fillStyle = blackGradient;
		ctx.fill();
	}

	private paintSelection(s: number, v: number): void {
		this.selection.style.left = `${s * this.width}px`;
		this.selection.style.top = `${this.height - v * this.height}px`;
	}

	private onDidChangeColor(): void {
		if (this.monitor && this.monitor.isMonitoring()) {
			return;
		}
		this.paint();
	}
}

abstract class Strip extends Disposable {

	public domNode: HTMLElement;
	protected overlay: HTMLElement;
	protected slider: HTMLElement;
	private height!: number;

	private readonly _onDidChange = new Emitter<number>();
	readonly onDidChange: Event<number> = this._onDidChange.event;

	private readonly _onColorFlushed = new Emitter<void>();
	readonly onColorFlushed: Event<void> = this._onColorFlushed.event;

	constructor(container: HTMLElement, protected model: ColorPickerModel, showingStandaloneColorPicker: boolean = false) {
		super();
		if (showingStandaloneColorPicker) {
			this.domNode = dom.append(container, $('.modified-strip'));
			this.overlay = dom.append(this.domNode, $('.modified-overlay'));
		} else {
			this.domNode = dom.append(container, $('.strip'));
			this.overlay = dom.append(this.domNode, $('.overlay'));
		}

		this.slider = dom.append(this.domNode, $('.slider'));
		this.slider.style.top = `0px`;

		this._register(dom.addDisposableListener(this.domNode, dom.EventType.POINTER_DOWN, e => this.onPointerDown(e)));
		this.layout();
	}

	layout(): void {
		console.log('inside of the layout of the strip');
		this.height = this.domNode.offsetHeight - this.slider.offsetHeight;
		console.log('this.height : ', this.height);
		const value = this.getValue(this.model.color);
		this.updateSliderPosition(value);
	}

	private onPointerDown(e: PointerEvent): void {
		if (!e.target || !(e.target instanceof Element)) {
			return;
		}
		const monitor = this._register(new GlobalPointerMoveMonitor());
		const origin = dom.getDomNodePagePosition(this.domNode);
		this.domNode.classList.add('grabbing');

		if (e.target !== this.slider) {
			this.onDidChangeTop(e.offsetY);
		}

		monitor.startMonitoring(e.target, e.pointerId, e.buttons, event => this.onDidChangeTop(event.pageY - origin.top), () => null);

		const pointerUpListener = dom.addDisposableListener(document, dom.EventType.POINTER_UP, () => {
			this._onColorFlushed.fire();
			pointerUpListener.dispose();
			monitor.stopMonitoring(true);
			this.domNode.classList.remove('grabbing');
		}, true);
	}

	private onDidChangeTop(top: number): void {
		const value = Math.max(0, Math.min(1, 1 - (top / this.height)));

		this.updateSliderPosition(value);
		this._onDidChange.fire(value);
	}

	private updateSliderPosition(value: number): void {
		this.slider.style.top = `${(1 - value) * this.height}px`;
	}

	protected abstract getValue(color: Color): number;
}

class OpacityStrip extends Strip {

	constructor(container: HTMLElement, model: ColorPickerModel, showingStandaloneColorPicker: boolean = false) {
		super(container, model, showingStandaloneColorPicker);
		this.domNode.classList.add('opacity-strip');

		this._register(model.onDidChangeColor(this.onDidChangeColor, this));
		this.onDidChangeColor(this.model.color);
	}

	private onDidChangeColor(color: Color): void {
		const { r, g, b } = color.rgba;
		const opaque = new Color(new RGBA(r, g, b, 1));
		const transparent = new Color(new RGBA(r, g, b, 0));

		this.overlay.style.background = `linear-gradient(to bottom, ${opaque} 0%, ${transparent} 100%)`;
	}

	protected getValue(color: Color): number {
		return color.hsva.a;
	}
}

class HueStrip extends Strip {

	constructor(container: HTMLElement, model: ColorPickerModel, showingStandaloneColorPicker: boolean = false) {
		super(container, model, showingStandaloneColorPicker);
		this.domNode.classList.add('hue-strip');
	}

	protected getValue(color: Color): number {
		return 1 - (color.hsva.h / 360);
	}
}

class InsertButton extends Disposable {

	private _button: HTMLElement;
	private readonly _onClicked = this._register(new Emitter<void>());
	public readonly onClicked = this._onClicked.event;

	constructor(container: HTMLElement) {
		super();
		this._button = dom.append(container, document.createElement('button'));
		this._button.classList.add('insert-button');
		this._button.textContent = 'Insert';
		this._button.onclick = e => {
			this._onClicked.fire();
		};
	}
}

export class ColorPickerWidget extends Widget implements IEditorHoverColorPickerWidget {

	private static readonly ID = 'editor.contrib.colorPickerWidget';

	body: ColorPickerBody;
	header: ColorPickerHeader;

	constructor(container: Node, readonly model: ColorPickerModel, private pixelRatio: number, themeService: IThemeService, standaloneColorPicker: boolean = false) {
		super();

		this._register(PixelRatio.onDidChange(() => this.layout()));

		const element = $('.colorpicker-widget');
		container.appendChild(element);

		this.header = new ColorPickerHeader(element, this.model, themeService, standaloneColorPicker);
		this.body = new ColorPickerBody(element, this.model, this.pixelRatio, standaloneColorPicker);

		this._register(this.header);
		this._register(this.body);
	}

	getId(): string {
		return ColorPickerWidget.ID;
	}

	layout(): void {
		console.log('inside of the color picker widget layout function');
		this.body.layout();
	}
}
