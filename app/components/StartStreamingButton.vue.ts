import Vue from 'vue';
import { Component, Prop, Watch } from 'vue-property-decorator';
import { StreamingService, EStreamingState } from 'services/streaming';
import { Inject } from 'services/core/injector';
import { NavigationService } from 'services/navigation';
import { SettingsService } from 'services/settings';
import { WindowsService } from '../services/windows';
import { $t } from 'services/i18n';
import StartStreamingIcon from '../../media/images/start-streaming-icon.svg';

@Component({
  components: {
    StartStreamingIcon
  }
})
export default class StartStreamingButton extends Vue {
  @Inject() streamingService: StreamingService;
  @Inject() navigationService: NavigationService;
  @Inject() settingsService: SettingsService;
  @Inject() windowsService: WindowsService;

  @Prop() disabled: boolean;

  toggleStreaming() {
    if (this.streamingService.isStreaming) {
      this.streamingService.toggleStreaming();
      return;
    }

    this.streamingService.toggleStreamingAsync();
  }

  get streamingStatus() {
    return this.streamingService.state.streamingStatus;
  }

  get programFetching() {
    return this.streamingService.state.programFetching;
  }

  getStreamButtonLabel() {
    if (this.programFetching) {
      return $t('streaming.programFetching');
    }

    if (this.streamingStatus === EStreamingState.Live) {
      return $t('streaming.endStream');
    }

    if (this.streamingStatus === EStreamingState.Starting) {
      if (this.streamingService.delayEnabled) {
        return $t('streaming.startingWithDelay', { delaySeconds: this.streamingService.delaySecondsRemaining });
      }

      return $t('streaming.starting');
    }

    if (this.streamingStatus === EStreamingState.Ending) {
      if (this.streamingService.delayEnabled) {
        return $t('streaming.endingWithDelay', { delaySeconds: this.streamingService.delaySecondsRemaining });
      }

      return $t('streaming.ending');
    }

    if (this.streamingStatus === EStreamingState.Reconnecting) {
      return $t('streaming.reconnecting');
    }

    return $t('streaming.goLive');
  }

  get isStreaming() {
    return this.streamingService.isStreaming;
  }

  get isDisabled() {
    return this.disabled || this.programFetching ||
      ((this.streamingStatus === EStreamingState.Starting) && (this.streamingService.delaySecondsRemaining === 0)) ||
      ((this.streamingStatus === EStreamingState.Ending) && (this.streamingService.delaySecondsRemaining === 0));
  }

  @Watch('streamingStatus')
  setDelayUpdate() {
    this.$forceUpdate();

    if (this.streamingService.delaySecondsRemaining) {
      setTimeout(() => this.setDelayUpdate(), 100);
    }
  }
}
