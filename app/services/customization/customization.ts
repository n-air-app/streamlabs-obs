import { Subject } from 'rxjs';
import { PersistentStatefulService } from '../core/persistent-stateful-service';
import { mutation } from '../core/stateful-service';
import {
  ICustomizationServiceApi,
  ICustomizationServiceState,
  ICustomizationSettings
} from './customization-api';
import { TObsFormData } from 'components/obs/inputs/ObsInput';
import Utils from 'services/utils';
import { $t } from 'services/i18n';

/**
 * This class is used to store general UI behavior flags
 * that are sticky across application runtimes.
 */
export class CustomizationService
  extends PersistentStatefulService<ICustomizationServiceState>
  implements ICustomizationServiceApi
{

  static defaultState: ICustomizationServiceState = {
    performanceMode: false,
    studioControlsOpened: true,
    optimizeForNiconico: true,
    showOptimizationDialogForNiconico: true,
    optimizeWithHardwareEncoder: true,
    pollingPerformanceStatistics: true,
    experimental: {
      // put experimental features here
    }
  };

  settingsChanged = new Subject<Partial<ICustomizationSettings>>();

  setSettings(settingsPatch: Partial<ICustomizationSettings>) {
    settingsPatch = Utils.getChangedParams(this.state, settingsPatch);
    this.SET_SETTINGS(settingsPatch);
    this.settingsChanged.next(settingsPatch);
  }

  getSettings(): ICustomizationSettings {
    return this.state;
  }

  get studioControlsOpened() {
    return this.state.studioControlsOpened;
  }

  toggleStudioControls() {
    this.setSettings({ studioControlsOpened: !this.state.studioControlsOpened });
  }

  get optimizeForNiconico() {
    return this.state.optimizeForNiconico;
  }

  setOptimizeForNiconico(optimize: boolean) {
    this.setSettings({
      optimizeForNiconico: optimize,
      showOptimizationDialogForNiconico: optimize
    });
  }

  get showOptimizationDialogForNiconico() {
    return this.state.showOptimizationDialogForNiconico;
  }

  setShowOptimizationDialogForNiconico(optimize: boolean) {
    this.setSettings({ showOptimizationDialogForNiconico: optimize });
  }

  get optimizeWithHardwareEncoder() {
    return this.state.optimizeWithHardwareEncoder;
  }

  setOptimizeWithHardwareEncoder(useHardwareEncoder: boolean) {
    this.setSettings({ optimizeWithHardwareEncoder: useHardwareEncoder });
  }

  get pollingPerformanceStatistics() {
    return this.state.pollingPerformanceStatistics;
  }

  setPollingPerformanceStatistics(activate: boolean) {
    this.setSettings({ pollingPerformanceStatistics: activate });
  }

  getSettingsFormData(): TObsFormData {
    const settings = this.getSettings();

    return [];
  }

  getExperimentalSettingsFormData(): TObsFormData {
    return [];
  }

  restoreDefaults() {
    this.setSettings(CustomizationService.defaultState);
  }

  @mutation()
  private SET_SETTINGS(settingsPatch: Partial<ICustomizationSettings>) {
    Object.assign(this.state, settingsPatch);
  }

}
