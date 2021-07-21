import Vue from 'vue';
import { Component, Watch } from 'vue-property-decorator';
import { Inject } from 'services/core/injector';
import { NicoliveProgramService } from 'services/nicolive-program/nicolive-program';
import { remote } from 'electron';
import { $t } from 'services/i18n';
import { StreamingService } from 'services/streaming';
import { NicoliveFailure, openErrorDialogFromFailure } from 'services/nicolive-program/NicoliveFailure';

@Component({})
export default class ProgramInfo extends Vue {
  @Inject()
  nicoliveProgramService: NicoliveProgramService;
  @Inject() streamingService: StreamingService;

  // TODO: 後でまとめる
  programIsMemberOnlyTooltip = 'コミュニティ限定放送';

  isCreating: boolean = false;
  async createProgram() {
    if (this.isCreating) throw new Error('createProgram is running');
    try {
      this.isCreating = true;
      return await this.nicoliveProgramService.createProgram();
    } catch (caught) {
      if (caught instanceof NicoliveFailure) {
        await openErrorDialogFromFailure(caught);
      } else {
        throw caught;
      }
    } finally {
      this.isCreating = false;
    }
  }

  isFetching: boolean = false;
  async fetchProgram(): Promise<void> {
    if (this.isFetching) throw new Error('fetchProgram is running');
    try {
      this.isFetching = true;
      await this.nicoliveProgramService.fetchProgram();
    } catch (caught) {
      if (caught instanceof NicoliveFailure) {
        await openErrorDialogFromFailure(caught);
      } else {
        throw caught;
      }
    } finally {
      this.isFetching = false;
    }
  }

  isStarting: boolean = false;
  async startProgram() {
    if (this.isStarting) throw new Error('startProgram is running');
    try {
      this.isStarting = true;
      await this.nicoliveProgramService.startProgram();

      // もし配信開始してなかったら確認する
      if (!this.streamingService.isStreaming) {
        const startStreaming = await new Promise(resolve => {
          // TODO: 翻訳
          remote.dialog.showMessageBox(
            remote.getCurrentWindow(),
            {
              type: 'warning',
              message: $t('program-info.start-streaming-confirmation'),
              buttons: [$t('streaming.goLive'), $t('program-info.later')],
              noLink: true,
            },
            idx => resolve(idx === 0)
          );
        });
        if (startStreaming) {
          // 開始
          await this.streamingService.toggleStreamingAsync();
        }
      }
    } catch (caught) {
      if (caught instanceof NicoliveFailure) {
        await openErrorDialogFromFailure(caught);
      } else {
        throw caught;
      }
    } finally {
      this.isStarting = false;
    }
  }

  isEnding: boolean = false;
  async endProgram() {
    if (this.isEnding) throw new Error('endProgram is running');
    try {
      this.isEnding = true;
      const isOk = await new Promise(resolve => {
        // TODO: 翻訳
        remote.dialog.showMessageBox(
          remote.getCurrentWindow(),
          {
            type: 'warning',
            message: '番組を終了しますか？',
            buttons: ['終了する', $t('common.cancel')],
            noLink: true,
          },
          idx => resolve(idx === 0)
        );
      });

      if (isOk) {
        return await this.nicoliveProgramService.endProgram();
      }
    } catch (caught) {
      if (caught instanceof NicoliveFailure) {
        // 終了済み番組を終了しようとした場合は黙って番組情報を更新する
        if (caught.type === 'http_error' && caught.reason === '409') {
          return this.refreshProgram();
        }
        await openErrorDialogFromFailure(caught);
      } else {
        throw caught;
      }
    } finally {
      this.isEnding = false;
    }
  }

  private async refreshProgram() {
    try {
      return await this.nicoliveProgramService.refreshProgram();
    } catch (caught) {
      if (caught instanceof NicoliveFailure) {
        await openErrorDialogFromFailure(caught);
      } else {
        throw caught;
      }
    }
  }

  get programID(): string {
    return this.nicoliveProgramService.state.programID;
  }

  get programStatus(): string {
    return this.nicoliveProgramService.state.status;
  }

  get programTitle(): string {
    return this.nicoliveProgramService.state.title;
  }

  get programIsMemberOnly(): boolean {
    return this.nicoliveProgramService.state.isMemberOnly;
  }

  get communityID(): string {
    return this.nicoliveProgramService.state.communityID;
  }

  get communityName(): string {
    return this.nicoliveProgramService.state.communityName;
  }

  get communitySymbol(): string {
    return this.nicoliveProgramService.state.communitySymbol;
  }

  openInDefaultBrowser(event: MouseEvent): void {
    const href = (event.currentTarget as HTMLAnchorElement).href;
    const url = new URL(href);
    if (/^https?/.test(url.protocol)) {
      remote.shell.openExternal(url.toString());
    }
  }

  get watchPageURL(): string {
    return `https://live.nicovideo.jp/watch/${this.programID}`;
  }

  get communityPageURL(): string {
    return `https://com.nicovideo.jp/community/${this.communityID}`;
  }

}
