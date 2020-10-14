import { StatefulService, mutation } from 'services/stateful-service';
import { ObsApiService, EOutputCode } from 'services/obs-api';
import { Inject } from 'util/injector';
import moment from 'moment';
import { SettingsService } from 'services/settings';
import { WindowsService } from 'services/windows';
import { Subject } from 'rxjs';
import * as electron from 'electron';
import {
  IStreamingServiceApi,
  IStreamingServiceState,
  EStreamingState,
  ERecordingState
} from './streaming-api';
import { UsageStatisticsService } from 'services/usage-statistics';
import { $t } from 'services/i18n';
import { CustomizationService } from 'services/customization';
import { UserService } from 'services/user';
import { IStreamingSetting } from '../platforms';
import { OptimizedSettings } from 'services/settings/optimizer';
import { openErrorDialogFromFailure } from 'services/nicolive-program/NicoliveFailure';

enum EOBSOutputType {
  Streaming = 'streaming',
  Recording = 'recording'
}

enum EOBSOutputSignal {
  Starting = 'starting',
  Start = 'start',
  Stopping = 'stopping',
  Stop = 'stop',
  Reconnect = 'reconnect',
  ReconnectSuccess = 'reconnect_success'
}

interface IOBSOutputSignalInfo {
  type: EOBSOutputType;
  signal: EOBSOutputSignal;
  code: EOutputCode;
  error: string;
}

export class StreamingService extends StatefulService<IStreamingServiceState>
  implements IStreamingServiceApi {
  @Inject() obsApiService: ObsApiService;
  @Inject() settingsService: SettingsService;
  @Inject() userService: UserService;
  @Inject() windowsService: WindowsService;
  @Inject() usageStatisticsService: UsageStatisticsService;
  @Inject() customizationService: CustomizationService;

  streamingStatusChange = new Subject<EStreamingState>();
  recordingStatusChange = new Subject<ERecordingState>();

  // Dummy subscription for stream deck
  streamingStateChange = new Subject<void>();

  powerSaveId: number;

  static initialState = {
    programFetching: false,
    streamingStatus: EStreamingState.Offline,
    streamingStatusTime: new Date().toISOString(),
    recordingStatus: ERecordingState.Offline,
    recordingStatusTime: new Date().toISOString()
  };

  init() {
    super.init();

    this.obsApiService.nodeObs.OBS_service_connectOutputSignals(
      (info: IOBSOutputSignalInfo) => {
        this.handleOBSOutputSignal(info);
      }
    );
  }

  getModel() {
    return this.state;
  }

  get isStreaming() {
    return this.state.streamingStatus !== EStreamingState.Offline;
  }

  get isRecording() {
    return this.state.recordingStatus !== ERecordingState.Offline;
  }

  /**
   * @deprecated Use toggleStreaming instead
   */
  startStreaming() {
    this.toggleStreaming();
  }

  /**
   * @deprecated Use toggleStreaming instead
   */
  stopStreaming() {
    this.toggleStreaming();
  }

  // 配信開始ボタンまたはショートカットキーによる配信開始(対話可能)
  async toggleStreamingAsync(
    options: {
      programId?: string,
      mustShowOptimizationDialog?: boolean
    } = {}
  ) {
    const opts = Object.assign({
      programId: '',
      mustShowOptimizationDialog: false
    }, options);

    if (this.isStreaming) {
      this.toggleStreaming();
      return;
    }

    console.log('Start Streaming button: platform=' + JSON.stringify(this.userService.platform));
    if (this.userService.isNiconicoLoggedIn()) {
      try {
        this.SET_PROGRAM_FETCHING(true);
        const setting = await this.userService.updateStreamSettings(opts.programId);
        if (setting.asking) {
          return;
        }
        const streamkey = setting.key;
        if (streamkey === '') {
          return new Promise(resolve => {
            electron.remote.dialog.showMessageBox(
              electron.remote.getCurrentWindow(),
              {
                title: $t('streaming.notBroadcasting'),
                type: 'warning',
                message: $t('streaming.notBroadcastingMessage'),
                buttons: [$t('common.close')],
                noLink: true,
              },
              done => resolve(done)
            );
          });
        }
        if (this.customizationService.optimizeForNiconico) {
          return this.optimizeForNiconicoAndStartStreaming(setting, opts.mustShowOptimizationDialog);
        }
      } catch (e) {
        const message = e instanceof Response
          ? $t('streaming.broadcastStatusFetchingError.httpError', { statusText: e.statusText })
          : $t('streaming.broadcastStatusFetchingError.default');

        return new Promise(resolve => {
          electron.remote.dialog.showMessageBox(
            electron.remote.getCurrentWindow(),
            {
              type: 'warning',
              message,
              buttons: [$t('common.close')],
              noLink: true,
            },
            done => resolve(done)
          );
        });
      } finally {
        this.SET_PROGRAM_FETCHING(false);
      }
    }
    this.toggleStreaming();
  }

  toggleStreaming() {
    if (this.state.streamingStatus === EStreamingState.Offline) {
      const shouldConfirm = this.settingsService.state.General
        .WarnBeforeStartingStream;
      const confirmText = $t('streaming.startStreamingConfirm');

      if (shouldConfirm && !confirm(confirmText)) return;

      this.powerSaveId = electron.remote.powerSaveBlocker.start(
        'prevent-display-sleep'
      );
      this.obsApiService.nodeObs.OBS_service_startStreaming();

      return;
    }

    if (
      this.state.streamingStatus === EStreamingState.Starting ||
      this.state.streamingStatus === EStreamingState.Live ||
      this.state.streamingStatus === EStreamingState.Reconnecting
    ) {
      const shouldConfirm = this.settingsService.state.General
        .WarnBeforeStoppingStream;
      const confirmText = $t('streaming.stopStreamingConfirm');

      if (shouldConfirm && !confirm(confirmText)) return;

      if (this.powerSaveId) {
        electron.remote.powerSaveBlocker.stop(this.powerSaveId);
      }

      this.obsApiService.nodeObs.OBS_service_stopStreaming(false);

      const keepRecording = this.settingsService.state.General
        .KeepRecordingWhenStreamStops;
      if (
        !keepRecording &&
        this.state.recordingStatus === ERecordingState.Recording
      ) {
        this.toggleRecording();
      }

      return;
    }

    if (this.state.streamingStatus === EStreamingState.Ending) {
      this.obsApiService.nodeObs.OBS_service_stopStreaming(true);
      return;
    }
  }

  // 最適化ウィンドウの高さを計算する
  private calculateOptimizeWindowSize(settings: OptimizedSettings): number {
    const windowHeader = 6 + 20 + 1;
    const descriptionLabel = 22.4 + 12;
    const useHardwareCheck = 28 + 12;
    const doNotShowCheck = 28 + 12;
    const contentOverhead = 16;
    const modalControls = 8 + 36 + 8;
    const categoryOverhead = 22.4 + 4 + 8 + 8 + 12;
    const lineHeight = 20.8;

    const overhead = windowHeader + descriptionLabel + useHardwareCheck + doNotShowCheck
      + contentOverhead + modalControls;

    const numCategories = settings.info.length;
    const numLines = settings.info.reduce((sum, tuple) => sum + tuple[1].length, 0);
    const height = overhead + numCategories * categoryOverhead + numLines * lineHeight;
    return Math.floor(height); // floorしないと死ぬ
  }

  /**
   * ニコニコ生放送用設定最適化を行い、配信を開始する。この際、必要なら最適化ダイアログ表示を行う。
   * @param streamingSetting 番組の情報から得られる最適化の前提となる情報
   * @param mustShowDialog trueなら、設定に変更が必要ない場合や、最適化ダイアログを表示しない接敵のときであっても最適化ダイアログを表示する。
   */
  private async optimizeForNiconicoAndStartStreaming(streamingSetting: IStreamingSetting, mustShowDialog: boolean) {
    if (streamingSetting.bitrate === undefined) {
      return new Promise(resolve => {
        electron.remote.dialog.showMessageBox(
          electron.remote.getCurrentWindow(),
          {
            title: $t('streaming.bitrateFetchingError.title'),
            type: 'warning',
            message: $t('streaming.bitrateFetchingError.message'),
            buttons: [$t('common.close')],
            noLink: true,
          },
          done => resolve(done)
        );
      });
    }
    const settings = this.settingsService.diffOptimizedSettings({
      bitrate: streamingSetting.bitrate,
      useHardwareEncoder: this.customizationService.optimizeWithHardwareEncoder,
    });
    if (Object.keys(settings.delta).length > 0 || mustShowDialog) {
      if (this.customizationService.showOptimizationDialogForNiconico || mustShowDialog) {
        this.windowsService.showWindow({
          componentName: 'OptimizeForNiconico',
          queryParams: settings,
          size: {
            width: 500,
            height: this.calculateOptimizeWindowSize(settings)
          }
        });
      } else {
        this.settingsService.optimizeForNiconico(settings.best);
        this.toggleStreaming();
      }
    } else {
      this.toggleStreaming();
    }
  }

  /**
   * @deprecated Use toggleRecording instead
   */
  startRecording() {
    this.toggleRecording();
  }

  /**
   * @deprecated Use toggleRecording instead
   */
  stopRecording() {
    this.toggleRecording();
  }

  toggleRecording() {
    if (this.state.recordingStatus === ERecordingState.Recording) {
      this.obsApiService.nodeObs.OBS_service_stopRecording();
      return;
    }

    if (this.state.recordingStatus === ERecordingState.Offline) {
      if (!this.settingsService.isValidOutputRecordingPath()) {
        alert($t('streaming.badPathError'));
        return;
      }

      if (this.userService.isNiconicoLoggedIn()) {
        const recordingSettings = this.settingsService.getRecordingSettings();
        if (recordingSettings) {
          // send Recording type to Sentry (どれぐらいURL出力が使われているかの比率を調査する)
          console.error('Recording / recType:' + recordingSettings.recType);
          console.log('Recording / path:' + JSON.stringify(recordingSettings.path));
        }
      }

      this.obsApiService.nodeObs.OBS_service_startRecording();
      return;
    }
  }

  get delayEnabled() {
    return this.settingsService.state.Advanced.DelayEnable;
  }

  get delaySeconds() {
    return this.settingsService.state.Advanced.DelaySec;
  }

  get delaySecondsRemaining() {
    if (!this.delayEnabled) return 0;

    if (
      this.state.streamingStatus === EStreamingState.Starting ||
      this.state.streamingStatus === EStreamingState.Ending
    ) {
      const elapsedTime =
        moment().unix() - this.streamingStateChangeTime.unix();
      return Math.max(this.delaySeconds - elapsedTime, 0);
    }

    return 0;
  }

  /**
   * Gives a formatted time that the streaming output has been in
   * its current state.
   */
  get formattedDurationInCurrentStreamingState() {
    return this.formattedDurationSince(this.streamingStateChangeTime);
  }

  get streamingStateChangeTime() {
    return moment(this.state.streamingStatusTime);
  }

  private formattedDurationSince(timestamp: moment.Moment) {
    const duration = moment.duration(moment().diff(timestamp));
    const seconds = duration.seconds().toString().padStart(2, '0');
    const minutes = duration.minutes().toString().padStart(2, '0');
    const dayHours = duration.days() * 24;
    const hours = (dayHours + duration.hours()).toString().padStart(2, '0');

    return `${hours}:${minutes}:${seconds}`;
  }

  private handleOBSOutputSignal(info: IOBSOutputSignalInfo) {
    console.debug('OBS Output signal: ', info);
    if (info.type === EOBSOutputType.Streaming) {
      const time = new Date().toISOString();

      if (info.signal === EOBSOutputSignal.Start) {
        this.SET_STREAMING_STATUS(EStreamingState.Live, time);
        this.streamingStatusChange.next(EStreamingState.Live);

        let streamEncoderInfo: Dictionary<string> = {};

        try {
          streamEncoderInfo = this.settingsService.getStreamEncoderSettings();
        } catch (e) {
          console.error('Error fetching stream encoder info: ', e);
        }

        const recordWhenStreaming = this.settingsService.state.General.RecordWhenStreaming;
        if (
          recordWhenStreaming &&
          this.state.recordingStatus === ERecordingState.Offline
        ) {
          this.toggleRecording();
        }

        this.usageStatisticsService.recordEvent('stream_start', streamEncoderInfo);
      } else if (info.signal === EOBSOutputSignal.Starting) {
        this.SET_STREAMING_STATUS(EStreamingState.Starting, time);
        this.streamingStatusChange.next(EStreamingState.Starting);
      } else if (info.signal === EOBSOutputSignal.Stop) {
        this.SET_STREAMING_STATUS(EStreamingState.Offline, time);
        this.streamingStatusChange.next(EStreamingState.Offline);
        this.usageStatisticsService.recordEvent('stream_end');
      } else if (info.signal === EOBSOutputSignal.Stopping) {
        this.SET_STREAMING_STATUS(EStreamingState.Ending, time);
        this.streamingStatusChange.next(EStreamingState.Ending);
      } else if (info.signal === EOBSOutputSignal.Reconnect) {
        if (this.customizationService.reconnectionEnabled) {
          this.SET_STREAMING_STATUS(EStreamingState.Reconnecting);
          this.streamingStatusChange.next(EStreamingState.Reconnecting);
        } else {
          this.stopStreaming();
          // show notification alert dialog
          info.code = EOutputCode.Disconnected;
        }
      } else if (info.signal === EOBSOutputSignal.ReconnectSuccess) {
        this.SET_STREAMING_STATUS(EStreamingState.Live);
        this.streamingStatusChange.next(EStreamingState.Live);
      }
    } else if (info.type === EOBSOutputType.Recording) {
      const time = new Date().toISOString();

      if (info.signal === EOBSOutputSignal.Start) {
        this.SET_RECORDING_STATUS(ERecordingState.Recording, time);
        this.recordingStatusChange.next(ERecordingState.Recording);
      } else if (info.signal === EOBSOutputSignal.Starting) {
        this.SET_RECORDING_STATUS(ERecordingState.Starting, time);
        this.recordingStatusChange.next(ERecordingState.Starting);
      } else if (info.signal === EOBSOutputSignal.Stop) {
        this.SET_RECORDING_STATUS(ERecordingState.Offline, time);
        this.recordingStatusChange.next(ERecordingState.Offline);
      } else if (info.signal === EOBSOutputSignal.Stopping) {
        this.SET_RECORDING_STATUS(ERecordingState.Stopping, time);
        this.recordingStatusChange.next(ERecordingState.Stopping);
      }
    }

    if (info.code) {
      let errorMessage = '';
      let errorDetail = '';

      if (info.code === EOutputCode.BadPath) {
        errorDetail = 'badPathError';
        errorMessage = $t(`streaming.${errorDetail}`);
      } else if (info.code === EOutputCode.ConnectFailed) {
        errorDetail = 'connectFailedError';
        errorMessage = $t(`streaming.${errorDetail}`);
      } else if (info.code === EOutputCode.Disconnected) {
        errorDetail = 'disconnectedError';
        errorMessage = $t(`streaming.${errorDetail}`);
      } else if (info.code === EOutputCode.InvalidStream) {
        errorDetail = 'invalidStreamError';
        errorMessage = $t(`streaming.${errorDetail}`);
      } else if (info.code === EOutputCode.NoSpace) {
        errorDetail = 'noSpaceError';
        errorMessage = $t(`streaming.${errorDetail}`);
      } else if (info.code === EOutputCode.Unsupported) {
        errorDetail = 'unsupportedError';
        errorMessage = $t(`streaming.${errorDetail}`);
      } else if (info.code === EOutputCode.Error) {
        errorMessage = $t('streaming.error') + info.error;
      }

      electron.remote.dialog.showMessageBox(
        electron.remote.getCurrentWindow(),
        {
          type: 'error',
          message: errorMessage,
          detail: errorDetail,
          buttons: ['OK', 'Reconnect'],
          noLink: true,
        },
        (button) => {
          switch (button) {
            case 0: // ok
              break;
            case 1: // reconnect
              this.toggleStreaming();
              break;
          }
        }
      );
    }
  }

  @mutation()
  private SET_PROGRAM_FETCHING(status: boolean) {
    this.state.programFetching = status;
  }

  @mutation()
  private SET_STREAMING_STATUS(status: EStreamingState, time?: string) {
    this.state.streamingStatus = status;
    if (time) this.state.streamingStatusTime = time;
  }

  @mutation()
  private SET_RECORDING_STATUS(status: ERecordingState, time: string) {
    this.state.recordingStatus = status;
    this.state.recordingStatusTime = time;
  }
}
