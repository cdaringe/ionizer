var winston = require('winston');
winston.level = 'error';
var noop;
module.exports = noop || function() {
    var bluebirdify = require('bluebirdify');
    bluebirdify();
    bluebirdify.chirp();

    process.on('uncaughtException', function(err) {
        winston.error('.:: uncaught exception ::.');
        winston.error(err);
    });

    Promise.promisifyAll(require('fs'));

    noop = function(){};
};
