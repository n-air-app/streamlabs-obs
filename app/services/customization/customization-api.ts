import { Observable } from 'rxjs';
import { TFormData } from '../../components/shared/forms/Input';

export interface ICustomizationServiceState {
  performanceMode: boolean;
  studioControlsOpened: boolean;
  optimizeForNiconico: boolean;
  showOptimizationDialogForNiconico: boolean;
  optimizeWithHardwareEncoder: boolean;
  pollingPerformanceStatistics: boolean;
  reconnectionEnabled: boolean;
  experimental: any;
}

export interface ICustomizationSettings extends ICustomizationServiceState {}

export interface ICustomizationServiceApi {
  settingsChanged: Observable<Partial<ICustomizationSettings>>;
  setSettings(settingsPatch: Partial<ICustomizationSettings>): void;
  getSettings(): ICustomizationSettings;
  getSettingsFormData(): TFormData;
  getExperimentalSettingsFormData(): TFormData;
  restoreDefaults(): void;
}
