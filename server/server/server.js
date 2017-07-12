/**
 * HTTP 网络穿透
 * author: NOBO.ZHOU
 */
'use strict';
const url = require('url');
const EventEmitter = require('events').EventEmitter;
const WebSocket = require('ws');
const cryptoRandomString = require('crypto-random-string');
const cfg = require('./options');
const logger = require('./logger');

function onConnect(connName, conn) {
    var self = this;
    //消息监听
    conn.on('message', function incoming(data) {
        try {
            var MSG = JSON.parse(data);
        } catch (e) {
            self.emit('parseMessageError', data, connName, conn);
            return;
        }
        self.emit('message', MSG, connName, conn);
    });
}

class ProxyServe extends EventEmitter {
    constructor(opts, fn) {
        super();

        opts = opts || {};

        this.port = opts.port || cfg.proxyPort;

        this.authFunc = opts.authFunc || null;

        this.WebSocket = null;

        this.clients = {};

        this.clientData = {};

        this._cb = fn;

        this._init();
    }

    _init() {
        var self = this;
        const wss = new WebSocket.Server({
            port: this.port
        }, (wss) => {

            this.WebSocket = wss;

            if (this._cb) {
                this._cb();
                this._cb = null;
            }
        });


        wss.on('connection', function connection(ws) {
            const pathInfo = url.parse(ws.upgradeReq.url, true);

            logger.info('收到连接:' + ws.upgradeReq.url);

            let connName = pathInfo.query.conn_name;

            if (!connName) {
                connName = cryptoRandomString(10);
            }

            function callback() {
                //名称不合法
                if (!/[\w\.-]+/.test(connName)) {
                    self.emit('connError', {
                        code: 'INVAILNAME',
                        connName,
                        conn: ws
                    });
                    ws.close(3002, '连接名称格式无效:' + connName);
                    return;
                }
                //名称被占用。。。
                if (self.clients[connName]) {
                    self.emit('connError', {
                        code: 'NAMEINUSE',
                        connName,
                        conn: ws
                    });
                    ws.close(3002, '连接名称重复:' + connName);
                    return;
                }

                self.setConnect(connName, ws, pathInfo.query);

                ws.on('close', (code, msg) => {
                    self.emit('disconnect', connName, ws);
                    logger.info('服务关闭' + connName)
                    self.unsetConnect(ws);
                });

                self.emit('connect', connName, ws, pathInfo);

                onConnect.call(self, connName, ws, pathInfo);
            }

            if (self.authFunc) {
                self.authFunc({
                    username: pathInfo.query.user,
                    password: pathInfo.query.pwd
                }, ws.upgradeReq.url).then(callback, function(reaon) {
                    self.emit('authError', ws);
                    ws.close(3001, '用户验证失败');
                });
            } else {
                callback();
            }

        });

        wss.on('error', function(err) {
            self.emit('error', err);
        });
    }

    getConnect(name) {
        return this.clients[name];
    }

    getConnectData(name) {
        return this.clientData[name];
    }

    setConnect(name, conn, connData) {
        this.clientData[name] = connData;
        this.clients[name] = conn;
        return true;
    }

    unsetConnect(conn) {
        Object.keys(this.clients).forEach((name, i) => {
            if (this.clients[name] === conn) {
                delete this.clients[name];
                delete this.clientData[name];
            }
        });
    }

    sendMessage(conn, data) {
        var MSG = {
            type: 'MSG',
            text: data
        }
        conn.send(JSON.stringify(MSG));
    }

    sendRequest(conn, MSG) {
        MSG.type = 'REQUEST';
        conn.send(JSON.stringify(MSG));
    }

}

module.exports = ProxyServe;