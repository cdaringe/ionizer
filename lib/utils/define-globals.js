var winston = require('winston');
winston.level = 'error';
var noop;

var dieHard = function(err) {
    winston.error('.:: uncaught exception ::.');
    winston.error(err);
    process.exit(1);
};

module.exports = noop || function() {
    var bluebirdify = require('bluebirdify');
    bluebirdify();
    bluebirdify.chirp(dieHard);
    process.on('uncaughtException', dieHard);
    process.on('unhandledRejection', dieHard);

    Promise.promisifyAll(require('fs'));

    noop = function(){};
};
