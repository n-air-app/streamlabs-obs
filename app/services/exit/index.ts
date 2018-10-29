import { Service } from 'services/service';
import { ipcRenderer, remote } from 'electron';

export class ExitService extends Service {

  relaunch({ clearCacheDir }: { clearCacheDir?: boolean } = {}) {
    const originalArgs: string[] = remote.process.argv.slice(1);

    // キャッシュクリアしたいときだけつくようにする
    const args = clearCacheDir
      ? originalArgs.concat('--clearCacheDir')
      : originalArgs.filter(x => x !== '--clearCacheDir');

    ipcRenderer.send('restartApp', args);
  }

  quit() {
    ipcRenderer.send('quitApp');
  }

}
