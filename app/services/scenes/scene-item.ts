import { merge } from 'lodash';
import { mutation, ServiceHelper, Inject } from '../core';
import Utils from '../utils';
import { SourcesService, TSourceType, ISource } from 'services/sources';
import { VideoService } from 'services/video';
import { ScalableRectangle, CenteringAxis } from 'util/ScalableRectangle';
import { TObsFormData } from 'components/obs/inputs/ObsInput';
import * as obs from '../../../obs-api';

import {
  IPartialSettings,
  IPartialTransform,
  ISceneItemSettings,
  ITransform,
  ScenesService,
  Scene,
  ISceneItem,
  ISceneItemInfo,
} from './index';
import { SceneItemNode } from './scene-node';
import { TSceneNodeType } from './scenes';
/**
 * A SceneItem is a source that contains
 * all of the information about that source, and
 * how it fits in to the given scene
 */
@ServiceHelper()
export class SceneItem extends SceneItemNode {

  sourceId: string;
  name: string;
  type: TSourceType;
  audio: boolean;
  video: boolean;
  async: boolean;
  muted: boolean;
  width: number;
  height: number;
  properties: TObsFormData;
  channel?: number;

  sceneItemId: string;
  obsSceneItemId: number;

  transform: ITransform;
  visible: boolean;
  locked: boolean;

  sceneNodeType: TSceneNodeType = 'item';

  deinterlaceMode: obs.EDeinterlaceMode;
  deinterlaceFieldOrder: obs.EDeinterlaceFieldOrder;

  // Some computed attributes

  get scaledWidth(): number {
    return this.width * this.transform.scale.x;
  }

  get scaledHeight(): number {
    return this.height * this.transform.scale.y;
  }

  // A visual source is visible in the editor and not locked
  get isVisualSource() {
    return (this.video && (this.width > 0) && (this.height > 0)) && !this.locked;
  }

  state: ISceneItem;

  @Inject() protected scenesService: ScenesService;
  @Inject() private sourcesService: SourcesService;
  @Inject() private videoService: VideoService;

  constructor(sceneId: string, sceneItemId: string, sourceId: string) {
    super();
    const sceneItemState = this.scenesService.state.scenes[sceneId].nodes.find(item => {
      return item.id === sceneItemId;
    }) as ISceneItem;
    const sourceState = this.sourcesService.state.sources[sourceId];
    this.state = sceneItemState;
    Utils.applyProxy(this, sourceState);
    Utils.applyProxy(this, this.state);
  }

  getModel(): ISceneItem & ISource {
    return { ...this.source.state, ...this.state };
  }

  getScene(): Scene {
    return this.scenesService.getScene(this.sceneId);
  }

  get source() {
    return this.sourcesService.getSource(this.sourceId);
  }

  getSource() {
    return this.source;
  }

  getObsInput() {
    return this.source.getObsInput();
  }

  getObsSceneItem(): obs.ISceneItem {
    return this.getScene().getObsScene().findItem(this.obsSceneItemId);
  }

  getSettings(): ISceneItemSettings {
    return {
      transform: this.transform,
      locked: this.locked,
      visible: this.visible,
    };
  }

  setSettings(patch: IPartialSettings) {

    // update only changed settings to reduce the amount of IPC calls
    const obsSceneItem = this.getObsSceneItem();
    const changed = Utils.getChangedParams(this.state, patch);
    const newSettings = merge({}, this.state, patch);

    if (changed.transform) {
      const changedTransform = Utils.getChangedParams(
        this.state.transform,
        patch.transform
      );

      if (changedTransform.position) {
        obsSceneItem.position = newSettings.transform.position;
      }

      if (changedTransform.scale) {
        obsSceneItem.scale = newSettings.transform.scale;
      }


      if (changedTransform.crop) {
        const crop = newSettings.transform.crop;
        const cropModel: ICrop = {
          top: Math.round(crop.top),
          right: Math.round(crop.right),
          bottom: Math.round(crop.bottom),
          left: Math.round(crop.left)
        };
        changed.transform.crop = cropModel;
        obsSceneItem.crop = cropModel;
      }

      if (changedTransform.rotation !== void 0) {
        // Adjusts any positve or negative rotation value into a normalized
        // value between 0 and 360.
        const effectiveRotation = ((newSettings.transform.rotation % 360) + 360) % 360;

        this.getObsSceneItem().rotation = effectiveRotation;
        changed.transform.rotation = effectiveRotation;
      }

    }


    if (changed.locked !== void 0) {
      if (changed.locked && (this.selectionService.isSelected(this.sceneItemId))) {
        this.selectionService.deselect(this.sceneItemId);
      }
    }

    if (changed.visible !== void 0) {
      this.getObsSceneItem().visible = newSettings.visible;
    }

    this.UPDATE({ sceneItemId: this.sceneItemId, ...changed });

    this.scenesService.itemUpdated.next(this.getModel());
  }

  remove() {
    this.scenesService.getScene(this.sceneId).removeItem(this.sceneItemId);
  }

  nudgeLeft() {
    this.setTransform({ position: { x: this.transform.position.x - 1 } });
  }


  nudgeRight() {
    this.setTransform({ position: { x: this.transform.position.x + 1 } });
  }


  nudgeUp() {
    this.setTransform({ position: { y: this.transform.position.y - 1 } });
  }


  nudgeDown() {
    this.setTransform({ position: { y: this.transform.position.y + 1 } });
  }


  setVisibility(visible: boolean) {
    this.setSettings({ visible });
  }


  setLocked(locked: boolean) {
    this.setSettings({ locked });
  }


  loadAttributes() {
    const { position, scale, visible, crop, rotation } = this.getObsSceneItem();
    this.UPDATE({
      sceneItemId: this.sceneItemId,
      transform: {
        position,
        scale,
        crop,
        rotation
      },
      visible
    });
  }

  loadItemAttributes(customSceneItem: ISceneItemInfo) {
    const visible = customSceneItem.visible;
    const position = { x: customSceneItem.x, y: customSceneItem.y };
    const crop = customSceneItem.crop;

    this.UPDATE({
      sceneItemId: this.sceneItemId,
      transform: {
        scale: { x: customSceneItem.scaleX, y: customSceneItem.scaleY },
        rotation: customSceneItem.rotation,
        position,
        crop
      },
      visible,
      locked: !!customSceneItem.locked,
    });
  }

  setTransform(transform: IPartialTransform) {
    this.setSettings({ transform });
  }

  resetTransform() {
    this.setTransform({
      position: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      rotation: 0,
      crop: {
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      }
    });
  }

  flipY() {
    this.preservePosition(() => {
      const rect = this.getRectangle();
      rect.flipY();
      this.setRect(rect);
    });
  }

  flipX() {
    this.preservePosition(() => {
      const rect = this.getRectangle();
      rect.flipX();
      this.setRect(rect);
    });
  }


  stretchToScreen() {
    const rect = this.getRectangle();
    rect.stretchAcross(this.videoService.getScreenRectangle());
    this.setRect(rect);
  }


  fitToScreen() {
    const rect = this.getRectangle();
    rect.fitTo(this.videoService.getScreenRectangle());
    this.setRect(rect);
  }

  centerOnScreen() {
    const rect = this.getRectangle();
    rect.centerOn(this.videoService.getScreenRectangle());
    this.setRect(rect);
  }

  centerOnAxis(axis: CenteringAxis) {
    const rect = this.getRectangle();
    rect.centerOn(this.videoService.getScreenRectangle(), axis);
    this.setRect(rect);
  }

  rotate(deltaRotation: number) {
    this.preservePosition(() => {
      this.setTransform({ rotation: this.transform.rotation + deltaRotation });
    });
  }

  getItemIndex(): number {
    return this.getScene()
      .getItems()
      .findIndex(sceneItemModel => sceneItemModel.id === this.id);
  }

  /**
   * only for scene sources
   */
  setContentCrop() {
    const source = this.getSource();
    if (source.type !== 'scene') return;
    const scene = this.scenesService.getScene(source.sourceId);
    const rect = scene.getSelection().selectAll().getBoundingRect();
    const { width, height } = this.source.getObsInput();
    this.setTransform({
      position: {
        x: rect.x,
        y: rect.y
      },
      crop: {
        top: rect.y,
        right: width - (rect.x + rect.width),
        bottom: height - (rect.y + rect.height),
        left: rect.x
      }
    });
  }

  private setRect(rect: IScalableRectangle) {
    this.setTransform({
      position: { x: rect.x, y: rect.y },
      scale: { x: rect.scaleX, y: rect.scaleY }
    });
  }


  getSelection() {
    return this.getScene().getSelection(this.id);
  }


  /**
   * A rectangle representing this sceneItem
   */
  getRectangle(): ScalableRectangle {
    return new ScalableRectangle({
      x: this.transform.position.x,
      y: this.transform.position.y,
      scaleX: this.transform.scale.x,
      scaleY: this.transform.scale.y,
      width: this.width,
      height: this.height,
      crop: this.transform.crop,
      rotation: this.transform.rotation
    });
  }

  /**
   *   Many of these transforms can unexpectedly change the position of the
   *   object.  For example, rotations happen around the NW axis.  This function
   *   records the normalized x,y position before the operation and returns it to
   *   that position after the operation has been performed.
   */
  private preservePosition(fun: Function) {
    const rect = this.getRectangle();
    rect.normalize();
    const x = rect.x;
    const y = rect.y;

    fun();

    const newRect = this.getRectangle();
    newRect.normalized(() => {
      newRect.x = x;
      newRect.y = y;
    });

    this.setTransform({ position: { x: newRect.x, y: newRect.y } });
  }


  @mutation()
  private UPDATE(patch: {sceneItemId: string} & IPartialSettings) {
    merge(this.state, patch);
  }
}
