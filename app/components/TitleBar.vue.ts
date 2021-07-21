import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import electron from 'electron';
import { CustomizationService } from 'services/customization';
import { Inject } from 'services/core/injector';
import { StreamingService } from 'services/streaming';
import Utils from 'services/utils';
import { $t } from 'services/i18n';

@Component({
  components: {}
})
export default class TitleBar extends Vue {
  @Inject() customizationService: CustomizationService;
  @Inject() streamingService: StreamingService;

  @Prop() title: string;

  get isMinimizable() {
    return electron.remote.getCurrentWindow().isMinimizable();
  }

  get isUnstable() {
    return Utils.isMainWindow() && Utils.isUnstable();
  }

  minimize() {
    electron.remote.getCurrentWindow().minimize();
  }

  maximize() {
    const win = electron.remote.getCurrentWindow();

    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }

  close() {
    if (Utils.isMainWindow() && this.streamingService.isStreaming) {
      if (!confirm($t('streaming.endStreamInStreamingConfirm'))) return;
    }

    electron.remote.getCurrentWindow().close();
  }

  get isStreaming() {
    return this.streamingService.isStreaming;
  }

}
