var bootstrap = require('./utils/bootstrap.js'); // immediately registers globals, returns Promise
var _ = require('lodash');
var app = require('ampersand-app');
var fs = require('fs');
var path = require('path');
var pkgMock = require('mock-npm-install');
var spawn = require('../lib/utils/spawn.js');
var fileio = require('./utils/fileio.js');
var cacher = require('../lib/cache.js');
var ionizer = require('../lib/main.js');
var ePath = require('electron-prebuilt');
var electronUtil = require('../lib/utils/electron.js');
var testEnv =  require('./utils/env-setup-teardown.js');
var test = require('tape');

// bulk define local, cache-test constants
var targetHeaderDir = path.join(__dirname, 'testheaders');
var targetModulesDir = path.join(__dirname, 'node_modules');
var mockPkgDir = path.resolve(targetModulesDir, 'build-test-1');
var mockPkgBuiltFile = path.resolve(mockPkgDir, 'build-test-file');
var cachePath = cacher.getPackageCachePath(targetModulesDir);
var downsertTestCache = _.partial(cacher.downsertCache, targetModulesDir);
var rebuildQuickConfig = {
    modulesDir: app.targetModulesDir,
    headersDir: app.targetHeaderDir,
    quick: true,
};

var rebuildQuickConfigIgnore = _.assign({}, rebuildQuickConfig, { ignore: 'build-test-1' });
var mockPkg1;
var mockPkg2;

// bulk define simple helper functions to install, remove, and perform i/o
// on dummy pacakges installed and built in our test node_modules directory
var assertTestPkgBuiltFilePresent = _.partial(fileio.assertFilePresent, mockPkgBuiltFile);
var assertTestPkgBuiltFileNotPresent = _.partial(fileio.assertFileNotPresent, mockPkgBuiltFile);
var installMockPackage = function() {
    return pkgMock.install({
        nodeModulesDir: app.targetModulesDir,
        package: {
            name: 'build-test-1',
            scripts: {
                postinstall: [
                    'touch', mockPkgBuiltFile // `npm build` executes postinstall
                ].join(' ')
            }
        }
    });
};
var installMockPackage2 = function() {
    return pkgMock.install({
        nodeModulesDir: targetModulesDir,
        package: {
            name: 'build-test-2',
            scripts: { postinstall: [
                'touch', mockPkgBuiltFile + '-2',
            ].join(' ') } // `npm build` executes postinstall
        }
    });
};
var mkdirHeaders = _.partial(fileio.mkdir, targetHeaderDir);
var mkdirModules = _.partial(fileio.mkdir, targetModulesDir);
var removeTestPkgBuiltFile = _.partial(fs.unlinkSync, mockPkgBuiltFile);
var rmdirHeaders = _.partial(fileio.rmdir, targetHeaderDir);
var rmdirModules = _.partial(fileio.rmdir, targetModulesDir);
var testInstallMockPkg = function() {
    mockPkg1 = installMockPackage({ nodeModulesDir: targetModulesDir });
};
var testInstallMockPkg2 = function() { mockPkg2 = installMockPackage2({ nodeModulesDir: targetModulesDir }); };
var testRemoveMockPkg = function() {
    pkgMock.remove({ nodeModulesDir: targetModulesDir, name: mockPkg1.name });
};
var testParseCache = function() { return JSON.parse(fs.readFileSync(cachePath)); };
var testRebuildNativeQuick = _.partial(ionizer.rebuild, rebuildQuickConfig);
var testRebuildNativeQuickIgnore = _.partial(ionizer.rebuild, rebuildQuickConfigIgnore);

var testHeaderVer;

test('before - cache', { timeout: 1e6 }, function(t) {
    app.incrimentConsumer();
    Promise.resolve()
    .then(testEnv.teardown)
    .catch(_.noop)
    .then(bootstrap)
    .catch(t.fail)
    .then(t.end);
});

test('quick mode - basic', { timeout: 1e6 }, function(t) {
    t.plan(3);

    // exec test
    Promise.resolve()
    .then(testEnv.setup)
    .then(testInstallMockPkg)
    .then(testRebuildNativeQuick)
    .then(function assertFileStats() {
        // assert that mock package build process run successfully
        t.ok(fs.statSync(mockPkgBuiltFile), 'mock build file generated successfully');
        // assert that rebuild-cache built successfully
        t.ok(fs.statSync(cachePath), 'cache built successfully');
        return cacher.getCachedBuildVersions(targetModulesDir).then(function(cachedContent) {
            t.equal(
                cachedContent[0].nodeVersion,
                app.electronVersion,
                'cached version matches specified cache-to-version'
            );
        });
    })
    .then(downsertTestCache)
    .then(testEnv.teardown)
    .catch(t.fail)
    .then(t.end);

});

test('quick mode - pkg has multiple dependent pkgs, installed @ different times', { timeout: 1e6 }, function(t) {
    var mock1BuildCtime;

    t.plan(3);

    // exec test
    return Promise.resolve()
    .then(testEnv.setup)
    .then(testInstallMockPkg)
    .then(testRebuildNativeQuick)
    .then(function assertFileStats() {
        // assert that mock package build process run successfully
        t.ok(fs.statSync(mockPkgBuiltFile), 'mock package 1 build file generated');
        mock1BuildCtime = fs.statSync(mockPkgBuiltFile).ctime.toISOString();
    })
    .then(testInstallMockPkg2)
    .then(testRebuildNativeQuick)
    .then(function assertFileStats() {
        var mock1BuildCtimeSecondBuild = fs.statSync(mockPkgBuiltFile).ctime.toISOString();
        t.ok(fs.statSync(mockPkgBuiltFile + '-2'), 'mock package 2 build file generated');
        t.equal(mock1BuildCtime, mock1BuildCtimeSecondBuild, 'mock pkg 1 not rebuilt a second time after mock pkg 2 was installed/built');
    })
    .then(rmdirModules)
    .then(downsertTestCache)
    .catch(t.fail)
    .then(t.end);

});

test('quick mode - no rebuild post-cache', { timeout: 1e6 }, function(t) {
    var ctime_firstbuild;
    var setCtimeFirstBuild = function() {
        var cache = testParseCache();
        ctime_firstbuild = fs.statSync(mockPkgBuiltFile).ctime.toISOString();
        t.equal(ctime_firstbuild, cache[0].ctime, 'ctimes equal between file and cached version');
    };
    var ctime_secondbuild;
    var setCtimeSecondBuild = function() { ctime_secondbuild = fs.statSync(mockPkgBuiltFile).ctime.toISOString(); };
    var testCtimesEqual = function() {
        t.equal(ctime_firstbuild, ctime_secondbuild, 'built file not rebuilt if module was in cache');
    };

    t.plan(2);

    // assert that rebuild run again does not rebuild module after cached
    Promise.resolve()
    .then(testEnv.setup)
    .then(testInstallMockPkg)
    .then(testRebuildNativeQuick)
    .then(setCtimeFirstBuild)
    .then(testRebuildNativeQuick) // call rebuild again to assert cache no-build
    .then(setCtimeSecondBuild)
    .then(testCtimesEqual)
    .then(rmdirModules)
    .then(downsertTestCache)
    .catch(t.fail)
    .then(t.end);

});

test('quick mode - recache, rebuild post- package folder touch', { timeout: 1e6 }, function(t) {
    var ctime_oldfolder;
    var setOldFolderCtime = function() { ctime_oldfolder = fs.statSync(mockPkgDir).ctime.toISOString(); };
    var ctime_newfolder;
    var delay = function() { return Promise.delay(1500); };
    var setNewFolderCtime = function() { ctime_newfolder = fs.statSync(mockPkgDir).ctime.toISOString(); };
    var testDifferentCtimes = function() {
        t.notEqual(ctime_oldfolder, ctime_newfolder, 'ctimes different after folder modified');
    };
    var testBuildFileExists = function() {
        t.ok(fs.statSync(mockPkgBuiltFile), 'test file rebuilt after folder modified');
    };

    t.plan(2);

    // assert that module updates after node_modules/build-test folder modified
    Promise.resolve()
    .then(mkdirModules)
    .then(testInstallMockPkg)
    .then(setOldFolderCtime)
    .then(testRemoveMockPkg) // modify by remove + re-install
    .then(delay)
    .then(testInstallMockPkg)
    .then(setNewFolderCtime)
    .then(testDifferentCtimes)
    .then(testRebuildNativeQuick)
    .then(testBuildFileExists)
    .then(rmdirModules)
    .then(downsertTestCache)
    .catch(t.fail)
    .finally(t.end);

});

test('quick mode - ignore', { timeout: 1e6 }, function(t) {
    Promise.resolve()
    .then(mkdirModules)
    .then(testInstallMockPkg)
    .then(testRebuildNativeQuickIgnore)
    .then(assertTestPkgBuiltFileNotPresent)
    .then(rmdirModules)
    // .then(downsertTestCache) // no cache exists, so don't downsert!
    .catch(t.fail)
    .finally(t.end);

});

test('end - cache', function(t) {
    app.decrimentConsumer();
    t.end();
});
