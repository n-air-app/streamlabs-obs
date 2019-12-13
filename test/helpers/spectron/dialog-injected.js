const electron = require('electron');

(() => {
  let currentCb;
  let currentOpts;

  electron.dialog.showMessageBox = function showMessageBox(win, opts, cb) {
    currentCb = cb;
    currentOpts = opts;
  };

  electron.ipcMain.on('__SPECTRON_FAKE_MESSAGE_BOX', (e, buttonLabel) => {
    currentOpts.buttons.forEach((button, index) => {
      if (button === buttonLabel) currentCb(index);
    });
  });
  electron.ipcMain.on('__SPECTRON_FAKE_MESSAGE_BOX_GET_MESSAGE', e => {
    e.returnValue = currentOpts.message;
  });
  electron.ipcMain.on('__SPECTRON_FAKE_MESSAGE_BOX_GET_DETAIL', e => {
    e.returnValue = currentOpts.detail;
  });
})();
