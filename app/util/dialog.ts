import { remote } from 'electron';

/**
 * promisified version of electron.remote.dialog.showMessageBox
 */
export function showMessageBox(
  options: Electron.MessageBoxOptions,
  browserWindow: Electron.BrowserWindow = remote.getCurrentWindow()
): Promise<{ response: number; checkboxChecked: boolean }> {
  return new Promise(done => {
    // undefinedを直接渡すとremoteがエラーを吐くので渡し分ける
    if (browserWindow) {
      remote.dialog.showMessageBox(browserWindow, options, (response, checkboxChecked) =>
        done({ response, checkboxChecked })
      );
    } else {
      remote.dialog.showMessageBox(options, (response, checkboxChecked) =>
        done({ response, checkboxChecked })
      );
    }
  });
}
