# node-http-through

> `node-http-through` 是一个内网穿透工具，能让外网的电脑访问到处于内网的电脑

## 场景：
微信开发测试时可以直接调用测试环境的接口

协同开发时,不同局域网下，A,B用户都都可相互调用对方的测试接口

...


## 待优化问题

由于公司二级域名需要申请，所以在分配地址的时候 本应该随机分配一个二级域名改成随机分配地址的方式如：`test1.proxy.com=>www.proxy.com/test1`，如果只是调试接口是没有问题，想直接访问网站可能有问题，这时headers的`node-proxy-cname`可能你会用到。

后续有时间再支持二级域名随机分配功能。
