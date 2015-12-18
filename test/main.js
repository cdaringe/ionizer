var bootstrap = require('./utils/bootstrap.js');
var electronUtil = require('../lib/utils/electron.js');
var fs = require('fs');
var _ = require('lodash');
var app = require('ampersand-app');
var path = require('path');
var test = require('tape');
var fileio = require('./utils/fileio.js');
var ionizer = require('../lib/main.js');
var testEnv =  require('./utils/env-setup-teardown.js');

var cp = Promise.promisify(require('ncp').ncp);

test('before', { timeout: 20000 }, function(t) {
    app.incrimentConsumer();
    Promise.resolve()
    .then(bootstrap)
    .then(t.end);
});

test('installHeaders', function(t) {
    t.skip('header installation tested via setup/teardown'); // see env-setup-teardown.js
    t.end();
});

test('rebuild', { timeout: 20000 }, function(t) {
    var mockPkgBuiltFile = path.resolve(app.targetModulesDir, 'build-test-1', 'build-test-file');
    var assertTestPkgBuiltFilePresent = function() {
        fileio.assertFilePresent(mockPkgBuiltFile);
        t.pass('mock-package-rebuilt');
    };
    var installMockPackage = function() {
        return require('mock-npm-install').install({
            nodeModulesDir: app.targetModulesDir,
            package: {
                name: 'build-test-1',
                scripts: { postinstall: [
                    'touch', mockPkgBuiltFile
                ].join(' ') } // `npm build` executes postinstall
            }
        });
    };

    t.plan(1);

    Promise.resolve()
    .then(testEnv.setup)
    .then(installMockPackage)
    .then(_.partial(ionizer.rebuild, {
        electronVersion: app.electronVersion,
        modulesDir: app.targetModulesDir,
        headersDir: app.targetHeaderDir,
    }))
    .then(assertTestPkgBuiltFilePresent)
    .catch(t.fail)
    .finally(testEnv.teardown)
    .then(t.end);

});

test('shouldRebuild', { timeout: 20000 }, function(t) {
    t.plan(1);

    return Promise.resolve()
    .then(testEnv.setup)
    .then(electronUtil.getPath)
    .then(ionizer.shouldRebuild)
    .then(function assertShouldRebuild(result) {
        return t.ok(
            result.hasOwnProperty('shouldRebuild'),
            'shouldRebuild produces obj with shouldRebuild prop'
        );
    })
    .catch(t.fail)
    .finally(testEnv.teardown)
    .then(t.end);

});

test('end - main.js', function(t) {
    app.decrimentConsumer();
    t.end();
});
