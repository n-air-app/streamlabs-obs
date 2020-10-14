import test from 'ava';
import { useSpectron, focusMain, focusChild } from '../helpers/spectron/index';
import { setFormInput, checkFormInput } from '../helpers/spectron/forms';
import { dialogDetail, dialogDismiss } from '../helpers/spectron/dialog';
import { TcpProxy } from '../helpers/tcp-proxy';

useSpectron();

test('Streaming to custom streaming server', async t => {
  const streamingServerURL = process.env.NAIR_TEST_STREAM_SERVER;
  const streamingKey = process.env.NAIR_TEST_STREAM_KEY;

  if (!(streamingServerURL && streamingKey)) {
    console.warn(
      'テスト用配信情報が不足しています。配信テストをスキップします。\n' +
      `NAIR_TEST_STREAM_SERVER: ${process.env.NAIR_TEST_STREAM_SERVER}\n` +
      `NAIR_TEST_STREAM_KEY   : ${process.env.NAIR_TEST_STREAM_KEY}`
    );
    t.pass();
    return;
  }

  const app = t.context.app;

  await focusMain(t);
  await app.client.click('[data-test="OpenSettings"]');

  await focusChild(t);
  await app.client.click('[data-test="Settings"] [data-test="SideMenu"] [data-test="Stream"]');

  await setFormInput(
    t,
    '[data-test="Form/Text/server"]',
    streamingServerURL
  );
  await setFormInput(
    t,
    '[data-test="Form/Text/key"]',
    streamingKey
  );
  await app.client.click('[data-test="Done"]');

  await focusMain(t);
  await app.client.click('[data-test="StartStreamingButton"]');

  await app.client.waitForExist('[data-test="StartStreamingButton"][data-test-status="live"]', 10 * 1000);
  t.pass();
});

async function sleep(time) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, time);
  })
}

test('Disconnect while streaming(reconnect: on)', async t => {
  const streamingServerURL = process.env.NAIR_TEST_STREAM_SERVER;
  const streamingKey = process.env.NAIR_TEST_STREAM_KEY;

  if (!(streamingServerURL && streamingKey)) {
    console.warn(
      'テスト用配信情報が不足しています。配信テストをスキップします。\n' +
      `NAIR_TEST_STREAM_SERVER: ${process.env.NAIR_TEST_STREAM_SERVER}\n` +
      `NAIR_TEST_STREAM_KEY   : ${process.env.NAIR_TEST_STREAM_KEY}`
    );
    t.pass();
    return;
  }

  const rtmpPort = 1935;
  const url = new URL(streamingServerURL);
  const serverHostname = url.hostname;

  const proxy = new TcpProxy(serverHostname, rtmpPort);
  const listenPort = await proxy.listen();

  url.hostname = 'localhost';
  url.port = listenPort;
  const streamingServerProxyURL = url.href;
  console.log('Streaming Proxy URL: ', streamingServerProxyURL); // DEBUG
  console.log('proxy to: ', serverHostname); // DEBUG

  const app = t.context.app;

  await focusMain(t);
  await app.client.click('[data-test="OpenSettings"]');

  await focusChild(t);

  const allowReconnection = true; ///< 再接続
  await checkFormInput(
    t,
    '[data-test="Form/Bool/reconnection"]',
    allowReconnection
  );

  await app.client.click('[data-test="Settings"] [data-test="SideMenu"] [data-test="Stream"]');

  await setFormInput(
    t,
    '[data-test="Form/Text/server"]',
    streamingServerProxyURL
  );
  await setFormInput(
    t,
    '[data-test="Form/Text/key"]',
    streamingKey
  );
  await app.client.click('[data-test="Done"]');

  await focusMain(t);
  await app.client.click('[data-test="StartStreamingButton"]');

  await app.client.waitForExist('[data-test="StartStreamingButton"][data-test-status="live"]', 10 * 1000);

  proxy.close();

  await app.client.waitForExist('[data-test="StartStreamingButton"][data-test-status="reconnecting"]', 10 * 1000);

  t.pass();
});

test('Disconnect while streaming(reconnect: off)', async t => {
  const streamingServerURL = process.env.NAIR_TEST_STREAM_SERVER;
  const streamingKey = process.env.NAIR_TEST_STREAM_KEY;

  if (!(streamingServerURL && streamingKey)) {
    console.warn(
      'テスト用配信情報が不足しています。配信テストをスキップします。\n' +
      `NAIR_TEST_STREAM_SERVER: ${process.env.NAIR_TEST_STREAM_SERVER}\n` +
      `NAIR_TEST_STREAM_KEY   : ${process.env.NAIR_TEST_STREAM_KEY}`
    );
    t.pass();
    return;
  }

  const rtmpPort = 1935;
  const url = new URL(streamingServerURL);
  const serverHostname = url.hostname;

  const proxy = new TcpProxy(serverHostname, rtmpPort);
  const listenPort = await proxy.listen();

  url.hostname = 'localhost';
  url.port = listenPort;
  const streamingServerProxyURL = url.href;
  console.log('Streaming Proxy URL: ', streamingServerProxyURL); // DEBUG
  console.log('proxy to: ', serverHostname); // DEBUG

  const app = t.context.app;

  await focusMain(t);
  await app.client.click('[data-test="OpenSettings"]');

  await focusChild(t);

  const allowReconnection = false; ///< 再接続
  await checkFormInput(
    t,
    '[data-test="Form/Bool/reconnection"]',
    allowReconnection
  );

  await app.client.click('[data-test="Settings"] [data-test="SideMenu"] [data-test="Stream"]');

  await setFormInput(
    t,
    '[data-test="Form/Text/server"]',
    streamingServerProxyURL
  );
  await setFormInput(
    t,
    '[data-test="Form/Text/key"]',
    streamingKey
  );
  await app.client.click('[data-test="Done"]');

  await focusMain(t);
  await app.client.click('[data-test="StartStreamingButton"]');

  await app.client.waitForExist('[data-test="StartStreamingButton"][data-test-status="live"]', 10 * 1000);

  proxy.close();
  await sleep(1 * 1000);
  t.deepEqual(await dialogDetail(t), 'disconnectedError');
  await dialogDismiss(t, 'OK');
  t.pass();
});
