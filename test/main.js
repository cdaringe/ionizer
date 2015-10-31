var bootstrap = require('./utils/bootstrap.js');
var fs = require('fs');
var _ = require('lodash');
var app = require('ampersand-app');
var path = require('path');
var pkgMock = require('mock-npm-install');
var test = require('tape');
var fileio = require('./utils/fileio.js');
var httpServer = require('http-server');
var ionizer = require('../lib/main.js');
var installHeaders = ionizer.installHeaders;
var rebuild = ionizer.rebuild;
var shouldRebuild = ionizer.shouldRebuild;
var ePath = require('electron-prebuilt');

var cp = Promise.promisify(require('ncp').ncp);

// test constants
var targetHeaderDir = app.targetHeaderDir;
var targetModulesDir = app.targetModulesDir;
var mockPkgDir = path.resolve(targetModulesDir, 'build-test-1');
var mockPkgBuiltFile = path.resolve(mockPkgDir, 'build-test-file');
var mockPkg1;

// test fn constants
var assertTestPkgBuiltFilePresent = _.partial(fileio.assertFilePresent, mockPkgBuiltFile);
var installMockPackage = function() {
    return pkgMock.install({
        nodeModulesDir: targetModulesDir,
        package: {
            name: 'build-test-1',
            scripts: { postinstall: [
                'touch', mockPkgBuiltFile
            ].join(' ') } // `npm build` executes postinstall
        }
    });
};
var testInstallHeaders = function(ver) {
    return installHeaders({
        electronVersion: ver,
        headersDir: targetHeaderDir,
        nodeDistUrl: 'http://localhost:9009/test/local_headers',
    });
};
var rmdirHeaders = _.partial(fileio.rmdir, targetHeaderDir);
var rmdirModules = _.partial(fileio.rmdir, targetModulesDir);
var mkdirHeaders = _.partial(fileio.mkdir, targetHeaderDir);
var mkdirModules = _.partial(fileio.mkdir, targetModulesDir);
var testInstallMockPkg = function() { mockPkg1 = installMockPackage({ nodeModulesDir: targetModulesDir }); };

var server;

test('before', { timeout: 60000 }, function(t) {
    t.plan(1);

    // build a server to server header files
    // @TODO serve headers from local vs. making external network requrests
    server = httpServer.createServer({
        root: process.cwd(),
        robots: true,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true'
        }
    });
    server.listen(9009);
    bootstrap
    .catch(function(err) {
        t.fail(err);
        process.exit(1);
    })
    .then(_.partial(t.pass, 'before ready'));
});

test('installHeaders', { timeout: 10000 }, function(t) {
    var end = _.partial(t.pass, 'end');
    var testHeaderVer = '0.25.2';
    var testHeadersInstalled = function() {
        return fs.statAsync(
            path.join(targetHeaderDir, '.node-gyp', testHeaderVer, 'common.gypi')
        )
        .then(function() {
            t.pass(testHeaderVer + ' header installed' );
        });
    };

    t.plan(2);

    Promise.resolve()
    .then(rmdirHeaders)
    .then(mkdirHeaders)
    .then(_.partial(testInstallHeaders, testHeaderVer))
    .then(testHeadersInstalled)
    .then(rmdirHeaders)
    .catch(t.fail)
    .finally(end);

});

test('rebuild', { timeout: 2000 }, function(t) {
    var end = _.partial(t.pass, 'end');
    var testHeaderVer = '0.31.2';
    var testHeadersInstalled = function() {
        return fs.statAsync(
            path.join(
                targetHeaderDir,
                '.node-gyp',
                testHeaderVer,
                'common.gypi'
            )
        )
        .then(_.partial(t.pass, testHeaderVer + ' header installed'));
    };

    t.plan(2);

    Promise.resolve()
    .then(mkdirModules)
    .then(testInstallMockPkg)
    .then(mkdirHeaders)
    .then(_.partial(testInstallHeaders, testHeaderVer))
    .then(testHeadersInstalled)
    .then(_.partial(rebuild, {
        electronVersion: testHeaderVer,
        modulesDir: targetModulesDir,
        headersDir: targetHeaderDir,
    }))
    .then(assertTestPkgBuiltFilePresent)
    .then(rmdirModules)
    .then(rmdirHeaders)
    .catch(t.fail)
    .finally(end);

});

test('shouldRebuild', { timeout: 20000 }, function(t) {
    var end = _.partial(t.pass, 'end');
    var pathDotText = path.join(
        path.dirname(require.resolve('electron-prebuilt')),
        'path.txt'
    );

    t.plan(2);

    Promise.resolve()
    .then(function() {
        return fs.readFileAsync(pathDotText, 'utf8');
    })
    .then(shouldRebuild)
    .then(function assertShouldRebuild(result) {
        t.ok(result, 'should rebuild modules');
        // t.skip('@TODO make this test meaningful!');
    })
    .catch(t.fail)
    .then(end);

});

test('end', { timeout: 3000 }, function(t) {
    server.close();
    t.end();
});

module.exports = {
    installHeaders: installHeaders
};
