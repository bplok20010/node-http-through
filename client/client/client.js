/**
 * HTTP 网络穿透
 * author: NOBO.ZHOU
 */

'use strict';

const WebSocket = require('ws');
const http = require('http');
const querystring = require('querystring');
const program = require('commander');
const url = require('url');
const fs = require('fs');
const cfg = require('./options.js');

program
    .version('0.1.0')
    .option('-H, --host [type]', '代理转发接收地址如：http://127.0.0.1:80')
    .option('-c, --cname [type]', '连接名称，默认随机')
    .option('-a, --auth [type]', '用户验证信息:user:password')
    .option('-w, --wss [type]', 'WebSocket服务器地址')
    .parse(process.argv);

if (program.host) {
    cfg.host = program.host;
}

if (program.cname) {
    cfg.cname = program.cname;
}

if (program.auth) {
    cfg.auth = program.auth;
}

if (program.wss) {
    cfg.wss = program.wss;
}


var handler = {
        MSG: function(data) {
            console.log(data.text);
        },
        REQUEST: function(data) {
            var self = this;
            console.log(`+----------------收到请求:-----------------------------------`);
            console.log(`+- ID: ${data.resId}`)
            console.log(`+- ${data.method} ${data.protocol}//${data.host}:${data.port}${data.path}`)
            console.log(`+- Body Length:`)
            console.log(`+- ${(new Buffer(data.requestData).length)}`)
            console.log(`+----------------end-----------------------------------------`);
           
            //delete data.headers.host;

            var timer = null;

            const req = http.request({
                host: data.host,
                method: data.method,
                protocol: data.protocol,
                port: data.port,
                path: data.path,
                headers: data.headers
            }, function(res) {
                var size = 0;
                var chunks = [];

                res.on('data', function(chunk) {
                    size += chunk.length;
                    chunks.push(chunk);
                });

                res.on('end', function() {
                    if (timer) {
                        clearTimeout(timer);
                    }

                    var buffer = Buffer.concat(chunks, size);

                    function callback(text) {
                        var response = JSON.stringify({
                            type: 'RESPONSE',
                            statusCode: res.statusCode,
                            resId: data.resId,
                            responseData: buffer,
                            headers: res.headers
                        });
                        self.send(response);
                    }

                    console.log(`+----------------响应请求:-----------------------------------`);
                    console.log(`+- ID: ${data.resId}`)
                    console.log(`+- statusCode: ${res.statusCode}`)
                    console.log(`+- ${buffer.length}`)
                    console.log(`+----------------end-----------------------------------------`);

                    callback();
                });

            });

            req.on('error', function(e) {
                console.log('error:problem with request: ' + e);
                var response = JSON.stringify({
                    type: 'RESPONSE',
                    statusCode: 404,
                    responseData: new Buffer('转发目标服务未启动'),
                    resId: data.resId
                });
                self.send(response);
            });

            req.on('close', function(e) {
                console.log('close:problem with request: ' + e);
                var response = JSON.stringify({
                    type: 'RESPONSE',
                    statusCode: 404,
                    responseData: new Buffer('转发目标服务异常关闭'),
                    resId: data.resId
                });
                self.send(response);
            });

            req.end(new Buffer(data.requestData));

            if (data.timeout) {
                timer = setTimeout(function() {
                    req.abort();
                    timer = null;
                }, data.timeout * 1000);
            }

        }
    }

const authInfo = cfg.auth.split(':');
const pathInfo = url.parse(cfg.host);
pathInfo.port = pathInfo.port || 80;

if (!cfg.cname) {
    cfg.cname = authInfo[0];
}

var rtimer;

connect();

function connect() {
    const connStr = `${cfg.wss}/?user=${authInfo[0]}&pwd=${authInfo[1]}&conn_name=${cfg.cname}&host=${pathInfo.hostname}&port=${pathInfo.port}&protocol=${pathInfo.protocol}`;

    const ws = new WebSocket(connStr);

    var timer;

    ws.on('open', function() {
        if (rtimer) {
            clearTimeout(rtimer);
        }
        timer = setInterval(function() {
            //心跳包
            ws.send(JSON.stringify({
                type: 'HEATBEAT'
            }));
        }, 1000 * 10);
    });

    ws.on('message', function incoming(data, flags) {
        try {
            var MSG = JSON.parse(data);
            if (MSG.type in handler) {
                handler[MSG.type].call(ws, MSG);
            } else if ('HEATBEAT' == MSG.type) {
                //心跳包
            } else {
                console.error('unknow MSG.type:', MSG.type);
            }
        } catch (e) {
            console.log('消息解析失败!', e);
        }
    });

    ws.on('close', function(code, msg) {
        console.log(code, msg);
        if (timer) {
            clearInterval(timer);
        }
        if (code !== 3001) {// && code !== 3002
            console.log('连接被关闭，5s后尝试重连');
            setTimeout(function() {
                connect();
            }, 5000);
        }
    });

    ws.on('error', function(code, msg) {
        if (timer) {
            clearInterval(timer);
        }
        console.log('连接失败，5s后尝试重连', code);
        rtimer = setTimeout(function() {
            connect();
        }, 5000)
    });

}