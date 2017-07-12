/**
 * HTTP 网络穿透
 * author: NOBO.ZHOU
 */
'use strict';
const EventEmitter = require('events').EventEmitter;
const http = require('http');
const url = require('url');
const cfg = require('./options');
const logger = require('./logger');


let _uuid = 1;

function uuid() {
    return _uuid++;
}

class HttpServer extends EventEmitter {
    constructor(opts, fn) {
        super();
        opts = opts || {};
        this.port = opts.port || cfg.httpPort;

        this.timeout = opts.timeout || cfg.timeout;

        this._cb = fn;

        this.clients = {};

        this._init();
    }

    _init() {
        var self = this;
        this.Http = http.createServer(function(req, res) {
            var pathInfo = self.parseUrl(req, res);
            var resId = uuid();

            if (!pathInfo) {
                return;
            }

            self.clients[resId] = {
                timeout: self.timeout,
                connName: pathInfo.connName,
                req,
                res,
                pathInfo
            };

            var timer;

            if (self.timeout) {
                timer = setTimeout(function() {
                    self.response408(res);
                    timer = null;
                }, self.timeout * 1000);
            }

            req.on('close', function() {
                if (timer) {
                    clearTimeout(timer);
                }
                self.emit('disconnect', resId, self.clients[resId]);
                delete self.clients[resId];
            });

            self.emit('connect', resId, self.clients[resId]);
        });

        this.Http.on('error', (err) => {
            this.emit('error', err);
        });

        this.Http.listen(this.port, () => {
            if (self._cb) {
                self._cb(self.Http);
            }
        });

    }

    parseUrl(req, res) {
        let pathInfo = url.parse(req.url, true);
        if (!/^\/([\w\.-]+)\/?/.test(pathInfo.pathname)) {
            this.response404(res);
            return;
        }
        const connName = RegExp.$1;

        pathInfo.connName = connName;

        pathInfo.target = pathInfo.pathname.replace('/' + connName, '') || '/';

        return pathInfo;
    }

    response404(res) {
        res.writeHead(404);
        res.end('404 Not Found');
    }

    response408(res) {
        res.writeHead(408);
        res.end('408 Request Timed-Out');
    }
}

module.exports = HttpServer;