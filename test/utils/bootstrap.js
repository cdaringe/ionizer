var path = require('path');
var globals = require(path.resolve(process.cwd(), './lib/utils/define-globals.js'))();
require('./env-setup-teardown.js'); // load test constants onto `app`
require('./boot-server.js');

var _ = require('lodash');
var app = require('ampersand-app');
var fs = require('fs');
var fileio = require('./fileio.js');

var getHeadersDir = function() {
    return path.resolve(process.cwd(), 'test/local_headers/');
};

var buildDistFolder = function(ver) {
    return fileio.mkdir(path.join(
        getHeadersDir(),
        'v' + ver
    ));
};


var getHeaderPath = function(ver) {
    return path.resolve(
        getHeadersDir(),
        'v' + ver,
        'node-v' + ver + '.tar.gz'
    );
};

var genHeaderFilename = function(ver) {
    return path.basename(getHeaderPath(ver));
};

var getHeaderUrl = function(ver, dir) {
    return [
        'https://gh-contractor-zcbenz.s3.amazonaws.com/atom-shell/dist/v',
        ver, '/', dir ? '' : genHeaderFilename(ver)
    ].join('');
};

var wgetHeaders = function(ver) {
    var spawn = require(path.join(process.cwd(), 'lib/spawn.js'));
    var argsHeaders = [ '-O', getHeaderPath(ver), getHeaderUrl(ver) ];
    var getHeaders = _.partial(spawn, {
        cmd: 'wget',
        args: argsHeaders
    });
    var argsHeadersShasum = [
        '-O',
        path.join(
            path.dirname(getHeaderPath(ver)),
            'SHASUMS256.txt'
        ),
        getHeaderUrl(ver, { dir: true }) + 'SHASUMS256.txt'
    ];
    var getHeadersShasum = _.partial(spawn, {
        cmd: 'wget',
        args: argsHeadersShasum
    });

    return Promise.resolve()
    .then(getHeaders)
    .then(getHeadersShasum);
};

var upsertHeaders = function(ver) {
    var headerPath = getHeaderPath(ver);
    return fs.statAsync(headerPath)
    .catch(function(err) {
        if (err.code === 'ENOENT') {
            // download headers if they aren't present
            return buildDistFolder(ver)
            .then(_.partial(wgetHeaders, ver));
        }
        throw err;
    });
};

var bootReady;
module.exports = function init(t) {
    if (bootReady) { return bootReady; }
    var assignBootReady = function() { bootReady = Promise.resolve(); };
    return Promise.resolve()
    .then(_.partial(fileio.rmdir, app.targetModulesDir))
    .then(_.partial(upsertHeaders, '0.25.2'))
    .then(_.partial(upsertHeaders, '0.27.2'))
    .then(_.partial(upsertHeaders, '0.31.2'))
    .then(_.partial(require('./env-setup-teardown.js').setup))
    .then(assignBootReady);
};
