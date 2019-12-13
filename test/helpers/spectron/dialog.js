export async function dialogDismiss(t, buttonLabel) {
  await t.context.app.electron.ipcRenderer.send(
    '__SPECTRON_FAKE_MESSAGE_BOX',
    buttonLabel
  );
}

export async function dialogMessage(t) {
  return await t.context.app.electron.ipcRenderer.sendSync(
    '__SPECTRON_FAKE_MESSAGE_BOX_GET_MESSAGE'
  );
}

export async function dialogDetail(t) {
  return await t.context.app.electron.ipcRenderer.sendSync(
    '__SPECTRON_FAKE_MESSAGE_BOX_GET_DETAIL'
  );
}
