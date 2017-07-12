'use strict';

module.exports = {
    timeout: 120, //s
    proxyPort: 10001,//websocket服务端口
    httpPort: 10002,//http服务端口
    hostname: '127.0.0.1',//提示代理地址名称
    targetHost: '127.0.0.1',//转发目标IP
    targetPort: 80,//转发目标端口
    targetProtocol: 'http:'//转发目标协议
};