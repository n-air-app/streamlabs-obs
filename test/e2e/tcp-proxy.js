// test for tcp-proxy.ts
import test from 'ava';
import { TcpProxy } from '../helpers/tcp-proxy';
import { clearTimeout } from 'timers';
const net = require('net');

test('TcpProxy', async t => {
    await new Promise((resolve) => {
        const server = net.createServer(socket => {
            socket.on('data', data => {
                t.deepEqual(data.toString(), 'TEST');
                resolve();
            })
        }).listen();
        server.on('listening', () => {
            const serverPort = server.address().port;
            const proxy = new TcpProxy('localhost', serverPort);
            proxy.listen().then(proxyPort => {
                const c = net.createConnection(proxyPort, 'localhost');

                c.on('ready', () => {
                    c.write('TEST');
                })
            });
        });
    })
});

test('TcpProxy close', async t => {
    await new Promise((resolveServer, reject) => {
        return new Promise((resolveClient) => {
            // 3 seconds timeout
            const TIMEOUT = 3 * 1000;
            const timer = setTimeout(() => {
                t.fail('timeout!');
                reject('TIMEOUT');
            }, TIMEOUT);

            const server = net.createServer(socket => {
                socket.on('end', () => {
                    socket.end();
                    resolveServer();
                })
            }).listen();
            server.on('listening', () => {
                const serverPort = server.address().port;
                const proxy = new TcpProxy(
                    'localhost',
                    serverPort,
                    () => {
                        t.deepEqual(proxy.connections.length, 1);

                        proxy.close();
                    }
                );
                proxy.listen().then(proxyPort => {
                    t.deepEqual(proxy.connections.length, 0);

                    const c = net.createConnection(proxyPort, 'localhost');
                    c.on('end', () => {
                        clearTimeout(timer);
                        resolveClient();
                    });

                });
            });
        });
    });
    t.pass();
});
