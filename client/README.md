# node-http-through-client

## 启动
```
//eg:
node client -a test:123456 -c myproxy -H http://127.0.0.1:8080 -w ws://127.0.0.1:10001
```

```
options.js 默认配置信息
module.exports = {
    "wss": "ws://127.0.0.1:10001", //WebSocket服务端地址
    "auth": "test:123456", //验证用户名，可在服务端配置
    "cname": "proxy" + ~~(1 + Math.random() * 1000 %50000), //随机分配连接名称 连接名称不可重复
    "host": "http://127.0.0.1" //转发目标地址
};

```