
import { ipcRenderer, remote } from 'electron';

export function relaunch({ clearCacheDir }: { clearCacheDir?: boolean } = {}) {
  const originalArgs: string[] = remote.process.argv.slice(1);
  // キャッシュクリアしたいときだけつくようにする
  const args = clearCacheDir
    ? originalArgs.concat('--clearCacheDir')
    : originalArgs.filter(x => x !== '--clearCacheDir');
  ipcRenderer.send('restartApp', args);
}

export function quit() {
  ipcRenderer.send('quitApp');
}
