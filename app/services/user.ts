import Vue from 'vue';
import URI from 'urijs';
import { PersistentStatefulService } from 'services/core/persistent-stateful-service';
import { Inject } from 'services/core/injector';
import { mutation } from 'services/core/stateful-service';
import electron from 'electron';
import { IncrementalRolloutService } from 'services/incremental-rollout';
import { HostsService } from './hosts';
import {
  getPlatformService,
  IPlatformAuth,
  TPlatform,
  IPlatformService,
  IStreamingSetting
} from './platforms';
import Raven from 'raven-js';
import { AppService } from 'services/app';
import { SceneCollectionsService } from 'services/scene-collections';
import { Subject, Observable, merge } from 'rxjs';
import { WindowsService } from 'services/windows';
import {
  cpu as systemInfoCpu,
  graphics as systemInfoGraphics,
  osInfo as systemInfoOsInfo,
  uuid as systemInfoUuid,
} from 'systeminformation';
import {
  totalmem as nodeTotalMem,
  freemem as nodeFreeMem,
  cpus as nodeCpus,
  release as nodeOsRelease,
} from 'os';
import { memoryUsage as nodeMemUsage } from 'process';
import { $t } from 'services/i18n';
import uuid from 'uuid/v4';
import { OnboardingService } from './onboarding';
import { QuestionaireService } from './questionaire';
import { addClipboardMenu } from 'util/addClipboardMenu';

// Eventually we will support authing multiple platforms at once
interface IUserServiceState {
  auth?: IPlatformAuth;
}

export class UserService extends PersistentStatefulService<IUserServiceState> {
  @Inject() private appService: AppService;
  @Inject() private sceneCollectionsService: SceneCollectionsService;
  @Inject() private windowsService: WindowsService;
  @Inject() private onboardingService: OnboardingService;
  @Inject() private incrementalRolloutService: IncrementalRolloutService;
  @Inject() private hostsService: HostsService;
  @Inject() private questionaireService: QuestionaireService;

  @mutation()
  LOGIN(auth: IPlatformAuth) {
    Vue.set(this.state, 'auth', auth);
  }

  @mutation()
  LOGOUT() {
    Vue.delete(this.state, 'auth');
  }

  @mutation()
  private SET_PLATFORM_TOKEN(token: string) {
    this.state.auth.platform.token = token;
  }

  @mutation()
  private SET_CHANNEL_ID(id: string) {
    this.state.auth.platform.channelId = id;
  }

  userLogin = new Subject<IPlatformAuth>();
  userLogout = new Subject<void>();
  userLoginState: Observable<IPlatformAuth | void> = merge(this.userLogin, this.userLogout);

  init() {
    super.init();
    this.setRavenContext();
    this.validateLogin();
    this.incrementalRolloutService.fetchAvailableFeatures();
  }

  mounted() {
    // This is used for faking authentication in tests
    electron.ipcRenderer.on(
      'testing-fakeAuth',
      async (e: Electron.Event, auth: any) => {
        this.LOGIN(auth);
        await this.sceneCollectionsService.setupNewUser();
      }
    );
  }

  // Makes sure the user's login is still good
  validateLogin(): Promise<void> {
    if (!this.isLoggedIn()) return Promise.resolve();

    console.log('validateLogin: this.platform=' + JSON.stringify(this.platform));
    const service = getPlatformService(this.platform.type);
    if (service && service.isLoggedIn) {
      return service.isLoggedIn().then(valid => {
        if (!valid) {
          this.LOGOUT();
          this.userLogout.next();
        }
      });
    }

    // ここに来るパターンは存在しないはず
    console.error('unexpected state: There is no proper instance of the platform service');
    this.LOGOUT();
    return Promise.resolve();
  }

  isLoggedIn() {
    return !!(this.state.auth && this.state.auth.apiToken);
  }

  /**
   * This is a uuid that persists across the application lifetime and uniquely
   * identifies this particular installation of N Air, even when the user is
   * not logged in.
   */
  getLocalUserId() {
    const localStorageKey = 'NAirLocalUserId';
    let userId = localStorage.getItem(localStorageKey);

    if (!userId) {
      userId = uuid();
      localStorage.setItem(localStorageKey, userId);
    }

    return userId;
  }

  get apiToken() {
    if (this.isLoggedIn()) return this.state.auth.apiToken;
  }

  get platform() {
    if (this.isLoggedIn()) {
      return this.state.auth.platform;
    }
  }

  get username() {
    if (this.isLoggedIn()) {
      return this.state.auth.platform.username;
    }
  }

  get userIcon() {
    if (this.isLoggedIn()) {
      return this.state.auth.platform.userIcon;
    }
  }

  get platformId() {
    if (this.isLoggedIn()) {
      return this.state.auth.platform.id;
    }
  }

  get platformUserPageURL() {
    if (this.isLoggedIn()) {
      const platform = getPlatformService(this.state.auth.platform.type);
      if (platform.getUserPageURL !== undefined) {
        return platform.getUserPageURL();
      }
      return '';
    }
  }

  get channelId() {
    if (this.isLoggedIn()) {
      return this.state.auth.platform.channelId;
    }
  }

  get isPremium() {
    if (this.isLoggedIn()) {
      return this.state.auth.platform.isPremium;
    }
  }

  async showLogin() {
    if (this.isLoggedIn()) await this.logOut();
    this.onboardingService.start({ isLogin: true });
  }


  private async login(service: IPlatformService, rawAuth: IPlatformAuth) {
    const isPremium = await service.isPremium(rawAuth.platform.token);
    const auth = { ...rawAuth, platform: { ...rawAuth.platform, isPremium } };
    this.LOGIN(auth);
    this.userLogin.next(auth);
    this.setRavenContext();
  }

  async logOut() {
    // Attempt to sync scense before logging out
    this.appService.startLoading();

    // TODO niconico専用なので抽象化する
    getPlatformService('niconico').logout();

    await this.sceneCollectionsService.save();

    /* DEBUG
    await this.sceneCollectionsService.safeSync();
    */
    this.userLogout.next();

    this.LOGOUT();
    electron.remote.session.defaultSession.clearStorageData({ storages: ['cookies'] });
    this.appService.finishLoading();
  }

  /**
   * Starts the authentication process.  Multiple callbacks
   * can be passed for various events.
   */
  startAuth({
    platform,
    onAuthClose,
    onAuthFinish,
  }: {
    platform: TPlatform,
    onAuthClose: (...args: any[]) => any,
    onAuthFinish: (...args: any[]) => any,
  }) {
    const service = getPlatformService(platform);
    console.log('startAuth service = ' + JSON.stringify(service));

    const authWindow = new electron.remote.BrowserWindow({
      ...service.authWindowOptions,
      alwaysOnTop: false,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        nativeWindowOpen: true,
        sandbox: true
      }
    });

    authWindow.webContents.on('did-navigate', async (e, url) => {
      const parsed = this.parseAuthFromUrl(url);
      console.log('parsed = ' + JSON.stringify(parsed)); // DEBUG

      if (parsed) {
        // OAuthの認可が確認できたとき
        await this.login(service, parsed);

        onAuthFinish();
        authWindow.close();
      } else {
        // 未ログイン時のログイン画面、または認可画面のとき
        authWindow.show();
      }
    });

    authWindow.once('close', () => {
      onAuthClose();
    });

    addClipboardMenu(authWindow);

    authWindow.setMenu(null);
    authWindow.loadURL(service.authUrl);
  }

  /**
   * ユーザアイコンなどの情報だけ更新する
   * FIXME: validateLoginが成功した後にHTTPエラーが返ってくると説明なしにウィンドウが出てしまう
   */
  private updatePlatformUserInfo() {
    if (!this.isLoggedIn()) return;

    this.startAuth({
      platform: this.platform.type,
      onAuthFinish: () => {},
      onAuthClose: () => {},
    });
  }

  updatePlatformToken(token: string) {
    this.SET_PLATFORM_TOKEN(token);
  }

  updatePlatformChannelId(id: string) {
    this.SET_CHANNEL_ID(id);
  }

  /**
   * Parses tokens out of the auth URL
   */
  private parseAuthFromUrl(url: string) {
    const query = URI.parseQuery(URI.parse(url).query) as Dictionary<string>;

    if (
      query.token &&
      query.platform_username &&
      query.platform_token &&
      query.platform_id &&
      query.oauth_token
    ) {
      return {
        apiToken: query.oauth_token,
        platform: {
          type: query.platform,
          username: query.platform_username,
          token: query.platform_token,
          id: query.platform_id,
          userIcon: query.platform_user_icon,
        }
      } as IPlatformAuth;
    }

    return false;
  }

  /**
   * Registers the current user information with Raven so
   * we can view more detailed information in sentry.
   */
  async setRavenContext() {
    if (!this.isLoggedIn()) return;
    Raven.setUserContext({ username: this.username, id: this.platformId });
    Raven.setExtraContext(await this.getUserExtraContext());
  }

  async getUserExtraContext() {
    try{
      const [graphics, cpu, osInfo, osUuid] = await Promise.all([
        systemInfoGraphics(),
        systemInfoCpu(),
        systemInfoOsInfo(),
        systemInfoUuid(),
      ]);

      return {
        cacheId: this.questionaireService.uuid,
        platform: this.platform ? this.platform.type : 'not logged in',
        cpuModel: nodeCpus()[0].model,
        cpuCores: `physical:${cpu.physicalCores} logical:${cpu.cores}`,
        gpus: graphics.controllers,
        os: `${osInfo.distro} ${osInfo.release}`,
        osUuid: osUuid.os,
        memTotal: nodeTotalMem(),
        memAvailable: nodeFreeMem(),
        memUsage: nodeMemUsage(),
      };
    } catch (err) {
      return {
        cacheId: this.questionaireService.uuid,
        platform: this.platform ? this.platform.type : 'not logged in',
        cpuModel: nodeCpus()[0].model,
        cpuCores: `logical:${nodeCpus().length}`,
        os: nodeOsRelease(),
        memTotal: nodeTotalMem(),
        memAvailable: nodeFreeMem(),
        memUsage: nodeMemUsage(),
        exceptionWhenGetSystemInfo: err,
      };
    }
  }

  async updateStreamSettings(programId: string): Promise<IStreamingSetting> {
    return await getPlatformService(this.platform.type).setupStreamSettings(programId);
  }

  isNiconicoLoggedIn() {
    return this.isLoggedIn() && this.platform && this.platform.type === 'niconico';
  }
}

/**
 * You can use this decorator to ensure the user is logged in
 * before proceeding
 */
export function requiresLogin() {
  return (target: any, methodName: string, descriptor: PropertyDescriptor) => {
    const original = descriptor.value;

    return {
      ...descriptor,
      value(...args: any[]) {
        // TODO: Redirect to login if not logged in?
        if (UserService.instance.isLoggedIn()) {
          return original.apply(target, args);
        }
      }
    };
  };
}
