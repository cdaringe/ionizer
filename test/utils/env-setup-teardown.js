'use strict';
var app = require('ampersand-app');
var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var fileio = require('./fileio.js');
var ionizer = require(path.resolve(process.cwd(), 'lib/main.js'));
var electronUtil = require(path.resolve(process.cwd(), 'lib/utils/electron.js'));

app.targetHeaderDir = path.join(process.cwd(), 'test/testheaders');
app.targetModulesDir = path.join(process.cwd(), 'test/node_modules');

var exports = {
    _installHeaders: function(ver) {
        return ionizer.installHeaders({
            electronVersion: ver,
            headersDir: app.targetHeaderDir,
            // nodeDistUrl: 'http://localhost:9009/test/local_headers',
            logLevel: 'debug',
        });
    },

    _setAndTestHeaderVersion: function(ver) {
        var matches = ver.match(/^\d+\.\d+\.\d+/);
        if (!matches || !matches[0]) {
            throw new ReferenceError('version to install headers for extracted from electron binary');
        }
        app.electronVersion = matches[0];
    },

    _testHeadersInstalled: function() {
        return fs.statAsync(path.join(
            app.targetHeaderDir,
            '.node-gyp',
            app.electronVersion,
            'common.gypi'
        ));
    },

    setup: function() {
        if (!app.targetHeaderDir || !app.targetModulesDir) {
            throw new ReferenceError('targetHeaderDir and targetModulesDir must be loaded on app');
        }
        return Promise.resolve()
        .then(_.partial(fileio.mkdir, app.targetHeaderDir))
        .then(_.partial(fileio.mkdir, app.targetModulesDir))
        .then(electronUtil.version)
        .then(this._setAndTestHeaderVersion)
        .then(this._installHeaders)
        .then(this._testHeadersInstalled);
    },

    teardown: function() {
        return Promise.resolve()
        .then(_.partial(fileio.rmdir, app.targetHeaderDir))
        .then(_.partial(fileio.rmdir, app.targetModulesDir));
    }
};

exports.setup = _.bind(exports.setup, exports);
exports.teardown = _.bind(exports.teardown, exports);
exports._setAndTestHeaderVersion = _.bind(exports._setAndTestHeaderVersion, exports);
exports._installHeaders = _.bind(exports._installHeaders, exports);
exports._testHeadersInstalled = _.bind(exports._testHeadersInstalled, exports);

module.exports = exports;
