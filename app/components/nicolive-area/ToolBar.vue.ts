import Vue from 'vue';
import { Component, Watch } from 'vue-property-decorator';
import { Inject } from 'services/core/injector';
import { $t } from 'services/i18n';
import { NicoliveProgramService } from 'services/nicolive-program/nicolive-program';
import { NicoliveFailure, openErrorDialogFromFailure } from 'services/nicolive-program/NicoliveFailure';

@Component({})
export default class ToolBar extends Vue {
  @Inject()
  nicoliveProgramService: NicoliveProgramService;

  manualExtentionTooltip = $t('common.manualExtendButton');

  format(timeInSeconds: number): string {
    return NicoliveProgramService.format(timeInSeconds);
  }

  isExtending: boolean = false;
  async extendProgram() {
    if (this.isExtending) throw new Error('extendProgram is running');
    try {
      this.isExtending = true;
      return await this.nicoliveProgramService.extendProgram();
    } catch (caught) {
      if (caught instanceof NicoliveFailure) {
        await openErrorDialogFromFailure(caught);
      } else {
        throw caught;
      }
    } finally {
      this.isExtending = false;
    }
  }

  toggleAutoExtension() {
    this.nicoliveProgramService.toggleAutoExtension();
  }

  get programStatus(): string {
    return this.nicoliveProgramService.state.status;
  }

  get programEndTime(): number {
    return this.nicoliveProgramService.state.endTime;
  }

  get programStartTime(): number {
    return this.nicoliveProgramService.state.startTime;
  }

  get isProgramExtendable() {
    return this.nicoliveProgramService.isProgramExtendable && this.programEndTime - this.currentTime > 60;
  }

  get autoExtensionEnabled() {
    return this.nicoliveProgramService.state.autoExtensionEnabled;
  }

  currentTime: number = NaN;
  updateCurrrentTime() {
    this.currentTime = Math.floor(Date.now() / 1000);
  }

  get programCurrentTime(): number {
    return this.currentTime - this.programStartTime;
  }

  get programTotalTime(): number {
    return this.programEndTime - this.programStartTime;
  }

  @Watch('programStatus')
  onStatusChange(newValue: string, oldValue: string) {
    if (newValue === 'end') {
      clearInterval(this.timeTimer);
    　this.currentTime = NaN;
    } else if (oldValue === 'end') {
      clearInterval(this.timeTimer);
      this.startTimer();
    }
  }

  startTimer() {
    this.timeTimer = (setInterval(() => this.updateCurrrentTime(), 1000) as any) as number;
  }

  timeTimer: number = 0;
  mounted() {
    if (this.programStatus !== 'end') {
      this.startTimer();
    }
  }
}
