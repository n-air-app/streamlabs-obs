import Vue from 'vue';
import electron from 'electron';
import { Component } from 'vue-property-decorator';
import { Inject } from 'util/injector';
import BoolInput from 'components/shared/forms/BoolInput.vue';
import { CustomizationService } from 'services/customization';
import { IFormInput } from 'components/shared/forms/Input';
import { OnboardingService } from 'services/onboarding';
import { WindowsService } from 'services/windows';
import { UserService } from 'services/user';
import { StreamingService } from 'services/streaming';
import { AppService } from 'services/app';
import { $t } from 'services/i18n';
import { QuestionaireService } from 'services/questionaire';
import ClipBoardCopy from '../../media/images/clipboard-copy.svg';

@Component({
  components: {
    BoolInput,
    ClipBoardCopy
  }
})

export default class ExtraSettings extends Vue {
  @Inject() customizationService: CustomizationService;
  @Inject() onboardingService: OnboardingService;
  @Inject() windowsService: WindowsService;
  @Inject() userService: UserService;
  @Inject() streamingService: StreamingService;
  @Inject() appService: AppService;
  @Inject() questionaireService: QuestionaireService;

  cacheUploading = false;
  showCacheId = false;

  get cacheId() : string {
     return this.questionaireService.uuid;
  }

  copyToClipboard(text: string) {
    electron.clipboard.writeText(text);
  }

  get optimizeForNiconicoModel(): IFormInput<boolean> {
    return {
      name: 'optimize_for_niconico',
      description: $t('settings.optimizeForNiconico'),
      value: this.customizationService.state.optimizeForNiconico,
      enabled: this.streamingService.isStreaming === false
    };
  }

  setOptimizeForNiconico(model: IFormInput<boolean>) {
    this.customizationService.setOptimizeForNiconico(model.value);
  }

  get showOptimizationDialogForNiconicoModel(): IFormInput<boolean> {
    return {
      name: 'show_optimization_dialog_for_niconico',
      description: $t('settings.showOptimizationDialogForNiconico'),
      value: this.customizationService.state.showOptimizationDialogForNiconico,
      enabled: this.streamingService.isStreaming === false
    };
  }

  setShowOptimizationDialogForNiconico(model: IFormInput<boolean>) {
    this.customizationService.setShowOptimizationDialogForNiconico(model.value);
  }

  get optimizeWithHardwareEncoderModel(): IFormInput<boolean> {
    return {
      name: 'optimize_with_hardware_encoder',
      description: $t('settings.optimizeWithHardwareEncoder'),
      value: this.customizationService.state.optimizeWithHardwareEncoder,
      enabled: this.streamingService.isStreaming === false
    };
  }

  setOptimizeWithHardwareEncoder(model: IFormInput<boolean>) {
    this.customizationService.setOptimizeWithHardwareEncoder(model.value);
  }

  get pollingPerformanceStatisticsModel(): IFormInput<boolean> {
    return {
      name: 'polling_performance_statistics',
      description: $t('settings.pollingPerformanceStatistics'),
      value: this.customizationService.pollingPerformanceStatistics
    };
  }

  setPollingPerformanceStatistics(model: IFormInput<boolean>) {
    this.customizationService.setPollingPerformanceStatistics(model.value);
  }

  get reconnectionEnabledModel(): IFormInput<boolean> {
    return {
      name: 'reconnection',
      description: $t('settings.reconnectionEnabled'),
      value: this.customizationService.reconnectionEnabled
    };
  }

  setReconnectionEnabled(model: IFormInput<boolean>) {
    this.customizationService.setReconnectionEnabled(model.value);
  }

  showCacheDir() {
    electron.remote.shell.showItemInFolder(
      electron.remote.app.getPath('userData')
    );
  }

  deleteCacheDir() {
    if (
      confirm(
        $t('settings.clearCacheConfirm')
      )
    ) {
      this.appService.relaunch({ clearCacheDir: true });
    }
  }

  isNiconicoLoggedIn(): boolean {
    return this.userService.isNiconicoLoggedIn();
  }
}
