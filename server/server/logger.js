'use strict';
const log4js = require('log4js');

log4js.configure({
    appenders: [
        { type: 'console' }, //控制台输出
        /*
        {
            "category": "normal",
            "type": "dateFile",
            "filename": "./logs/date",
            "alwaysIncludePattern": true,
            "pattern": "-yyyy-MM-dd-hh.log"
        }
        */
    ]
});
var logger = log4js.getLogger('normal');
logger.setLevel('INFO');

module.exports = logger;