
module.exports = {
    "wss": "ws://127.0.0.1:10001",
    "auth": "test:123456",
    "cname": "proxy" + ~~(1 + Math.random() * 1000 %50000),
    "host": "http://127.0.0.1"
};