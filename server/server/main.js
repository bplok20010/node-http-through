/**
 * HTTP 网络穿透
 * author: NOBO.ZHOU
 */
'use strict';
const SProxyServe = require('./server');
const SHttpServer = require('./http');
const cfg = require('./options');
const logger = require('./logger');
const fs = require('fs');

const PROXY_PORT = cfg.proxyPort;
const HTTP_PORT = cfg.httpPort;
const HOST_NAME = cfg.hostname;
const TARGET_HOST = cfg.targetHost;
const TARGET_PORT = cfg.targetPort;
const TARGET_PROTOCOL = cfg.targetProtocol;

var ProxyServer, HttpServer;

ProxyServer = new SProxyServe({
    authFunc: function(obj) {
        var users = JSON.parse(fs.readFileSync('./server/db_user.json'));

        for (var i = 0; i < users.length; i++) {
            var info = users[i];
            if (info.username === obj.username && info.password === obj.password) {
                return Promise.resolve();
            }
        }
        return Promise.reject();
    },
    port: PROXY_PORT
}, function() {
    logger.info(`WebSocket服务启动成功...端口： ${PROXY_PORT}`);
    HttpServer = new SHttpServer({
        port: HTTP_PORT
    }, function() {
        logger.info(`HTTP服务启动成功...端口：${HTTP_PORT}`);
        main();
    });
});

function main() {

    ProxyServer.on('connect', function(name, conn, pathInfo) {
        pathInfo.query.protocol = pathInfo.query.protocol || TARGET_PROTOCOL;
        pathInfo.query.host = pathInfo.query.host || TARGET_HOST;
        pathInfo.query.port = pathInfo.query.port || TARGET_PORT;
        //连接建立
        ProxyServer.sendMessage(conn, '服务器连接成功。\n系统为你分配的地址是：\nhttp://' +
            HOST_NAME + (HTTP_PORT == 80 ? '' : ':' + HTTP_PORT) +
            '/' +
            name + ' -> ' + `${pathInfo.query.protocol}//${pathInfo.query.host}` + (pathInfo.query.port == 80 ? '' : ':' + pathInfo.query.port)
        );
    });

    HttpServer.on('connect', function(resId, request) {
        const conn = ProxyServer.getConnect(request.connName);
        const connData = ProxyServer.getConnectData(request.connName);
        const req = request.req;
        const res = request.res;
        const pathInfo = request.pathInfo;
        //连接不存在
        if (!conn) {
            HttpServer.response404(request.res);
            return;
        }
        logger.info(`${request.connName}:${resId} ${req.method} ${pathInfo.target + pathInfo.search}`);
        //组装数据发送给client...
        req.headers = req.headers || {};
        req.headers['node-proxy-cname'] = request.connName;
        var META_DATA = {
            resId,
            method: req.method,
            headers: req.headers,
            path: pathInfo.target + pathInfo.search,
            host: connData.host || TARGET_HOST,
            port: connData.port || TARGET_PORT,
            protocol: connData.protocol || TARGET_PROTOCOL,
        };

        var size = 0;
        var chunks = [];

        req.on('data', function(chunk) {
            size += chunk.length;
            chunks.push(chunk);
        });

        req.on('end', function() {
            var buffer = Buffer.concat(chunks, size);
            META_DATA.requestData = buffer;

            ProxyServer.sendRequest(conn, META_DATA);
        });
    });

    ProxyServer.on('message', function(data, name, conn) {
        if (data.type == 'RESPONSE') {
            onClientResponse.call(conn, data, name);
        } else if (data.type == 'HEATBEAT') {
            //心跳
            conn.send(JSON.stringify({
                type: 'HEATBEAT'
            }));
        }
    });
}

function onClientResponse(data, name) {
    var resId = data.resId;
    const connData = HttpServer.clients[resId];
    const wsConnData = ProxyServer.getConnectData(name);
    if (connData) {
        var res = connData.res;
        res.writeHead(data.statusCode, data.headers);
        res.end(new Buffer(data.responseData));
        delete HttpServer.clients[resId];

        logger.info(`${name}:get ${resId} response.`);
    }
}