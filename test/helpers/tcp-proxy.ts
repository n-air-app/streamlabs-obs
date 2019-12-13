import { Socket, Server, createServer, connect } from 'net';

export class TcpProxyConnection {
    _local: Socket
    _remote: Socket

    constructor(local: Socket, remote: Socket) {
        this._local = local;
        this._remote = remote;
        local.pipe(remote).pipe(local);
    }

    end() {
        this._remote.unpipe();
        this._local.unpipe();
        this._remote.end();
        this._local.end();
        this._local.destroy();
        delete this._remote;
        delete this._local;
    }
}

export class TcpProxy {
    proxyServer: Server;
    connections: TcpProxyConnection[] = [];
    noMoreAccept: boolean = false;

    constructor(
        remoteHost: string,
        remotePort: number,
        onConnect?: (c: TcpProxyConnection) => void
    ) {
        this.proxyServer = createServer((socket: Socket) => {
            if (this.noMoreAccept) {
                socket.end();
                return;
            }

            const client = connect(remotePort, remoteHost);
            const connection = new TcpProxyConnection(socket, client);
            this.connections.push(connection);
            if (onConnect) {
                onConnect(connection);
            }
        });
    }

    /**
     * listen.
     * @param port listen port or 0(omit) to pick unused port automatically
     * @return Promise<number> bound port
     */
    listen(port: number = 0): Promise<number> {
        return new Promise(resolve => {
            this.noMoreAccept = false;
            this.proxyServer.listen(port, () => {
                resolve(this.proxyServer.address().port);
            });
        });
    }

    close() {
        this.noMoreAccept = true;
        this.connections.forEach(c => c.end());
        this.proxyServer.close();
        this.connections = [];
    }
}