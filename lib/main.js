'use strict';
require('./utils/define-globals.js')();
var pUtil = require('./utils/process.js');
var electronUtil = require('./utils/electron.js');
var path = require('path');
var _ = require('lodash');
var fs = require('fs');
var winston = require('winston');
var childProcess = require('child_process');
var spawn = require('./utils/spawn.js');
var os = require('os');
var cache = require('./cache');
var getCachedBuildVersions = cache.getCachedBuildVersions;
var getInstalledModules = cache.getInstalledModules;
var upsertCache = cache.upsertCache;
var refreshCtimes = cache.refreshCtimes;

var DEFAULT_IGNORE_PKGS = [
    'electron',
    'electron-prebuilt',
    'electron-rebuild',
    'ionizer'
];

var isVerbose = function(level) {
    return _.contains(['silly', 'debug', 'verbose'], level);
};

var checkForInstalledHeaders = function(opts) {
    if (!opts || !opts.electronVersion || !opts.headersDir) {
        throw new ReferenceError('expected electronVersion and headersDir');
    }
    var electronVersionGyp = path.join(opts.headersDir, '.node-gyp', opts.electronVersion, 'common.gypi');
    return fs.statAsync(electronVersionGyp)
    .then(function(stat) {
        if (!stat) {
            throw new Error('Canary file \'common.gypi\' doesn\'t exist');
        }
        return true;
    });
};

var generateBuildManifest = function(opts) {
    var installedPkgs = opts.installedPkgs;
    var cachedPkgs = opts.cachedPkgs;
    var toBuild = installedPkgs.filter(function(installedPkg) {
        // test if installed installedPkg has matching built pkg, per the cache.
        // include installedPkg in the `toBuild` list if
        //     - no matching built package in the cache
        //     - the module folder has changed since last build
        return opts.force || !cachedPkgs.some(function(cachedPkg) {
            return (
                cachedPkg.electronModuleVersion === opts.electronModuleVersion &&
                cachedPkg.package === installedPkg.package &&
                cachedPkg.nodeVersion === opts.electronVersion &&
                cachedPkg.ctime === installedPkg.stat.ctime.toISOString()
            );
        });
    });
    toBuild = toBuild.filter(function(pkg) { return !_.contains(DEFAULT_IGNORE_PKGS, pkg.package); });
    winston.verbose('packages to build, pre-limit application: ', _.pluck(toBuild, 'package'));

    // apply limit request
    if (opts.limit) {
        toBuild = toBuild.filter(function(pkg) { return _.contains(opts.limit, pkg.package); });
        winston.verbose('packages to build, post-limit application: ', _.pluck(toBuild, 'package'));
    }

    if (opts.ignore) {
        var ignore = Array.isArray(opts.ignore) ? opts.ignore : [opts.ignore];
        toBuild = toBuild.filter(function(pkg) { return !_.contains(ignore, pkg.package.trim()); });
    }

    return toBuild.map(function(pkg) {
        return {
            package: pkg.package,
            nodeVersion: opts.electronVersion,
            ctime: pkg.stat.ctime.toISOString(),
            electronModuleVersion: opts.electronModuleVersion
        };
    });
};

var getHeadersRootDirForVersion = function(version) {
    return path.resolve(__dirname, 'headers');
};

var spawnWithHeadersDir = function(cmd, args, headersDir, cwd) {
    var env = _.extend({}, process.env, { HOME: headersDir });
    if (process.platform === 'win32')  {
        env.USERPROFILE = env.HOME;
    }

    var opts = { env: env };
    if (cwd) {
        opts.cwd = cwd;
    }
    winston.debug(cmd, args.join(' '), 'home:', opts.env.HOME);
    return spawn({
        cmd: cmd,
        args: args,
        opts: opts
    })
    .catch(function(err) {
        if (err.stdout) {
            winston.error(err.stdout);
        }
        if (err.stderr) {
            winston.error(err.stderr);
        }
        throw err;
    });
};

/**
 * install nodejs headers.  generally used to install those headers required by
 * electron's underlying nodejs
 * @param {object}  opts
 * @param {string=} opts.electronPath path to the target electron version.
 *                                     if no path provided, guesses electronPath
 * @param {string=} opts.nodeDistUrl url to source headers from
 * @param {string=} opts.headersDir path where headers shall be installed
 * @param {string=} opts.arch arch to build against, defauts to process.arch
 */
var installHeaders = function(opts) {
    var nodeDistUrl = opts.nodeDistUrl || 'https://gh-contractor-zcbenz.s3.amazonaws.com/atom-shell/dist';
    var headersDir = opts.headersDir || getHeadersRootDirForVersion(opts.electronVersion);
    var electronVersion;


    var getElectronPath = function() {
        if (opts.electronPath) { return opts.electronPath; }
        return electronUtil.getPath();
    };

    return Promise.resolve()
    .then(getElectronPath)
    .then(electronUtil.version)
    .then(function(ver) {
        electronVersion = ver;
    })
    .then(function() {
        return checkForInstalledHeaders(_.assign({} , opts, {
            electronVersion: electronVersion,
            headersDir: headersDir,
        }));
    })
    .then(_.partial(winston.info, 'headers already installed'))
    .catch(function(err) {
        var cmd = 'node';
        var nodeGypPath;
        try {
            // npm2x support
            nodeGypPath = require.resolve('npm/node_modules/node-gyp/bin/node-gyp');
        } catch(err) { }
        if (!nodeGypPath) {
            try {
                nodeGypPath = require.resolve('node-gyp');
            } catch(err) {
                throw new ReferenceError('nodeGyp not found');
            }
        }
        var args = [
            nodeGypPath,
            'install',
            '--target=' + electronVersion,
            '--arch=' + (opts.arch || process.arch),
            '--dist-url=' + nodeDistUrl,
            isVerbose(opts.logLevel) ? '--verbose' : null
        ].filter(function(arg) { return arg; });

        winston.verbose('installing headers to:', headersDir);
        winston.verbose('installing headers from:', nodeDistUrl);
        return spawnWithHeadersDir(cmd, args, headersDir);
    });
};

var shouldRebuild = function(electronPath) {
    var result = {};
    var assignElectronVersion = function(ver) { result.electronVersion = ver; };
    var assignElectronModuleVersion = function(ver) { result.electronModuleVersion = ver; };

    if (!electronPath) {
        throw new ReferenceError([
            'expected path to electron binary, recieved:',
            toString(electronPath)
        ].join(' '));
    }

    return Promise.resolve()
    .then(_.partial(electronUtil.moduleVersion, electronPath))
    .then(assignElectronModuleVersion)
    .then(_.partial(electronUtil.version, electronPath))
    .then(assignElectronVersion)
    .then(function assessRebuild() {
        result.shouldRebuild = process.versions.modules != result.electronModuleVersion; // jshint ignore:line
        return result;
    });

};

var rebuildDefault = function(opts) {
    var cmd = 'node';
    var packages;
    if (opts.package) {
        packages = [ opts.package ];
    } else if (opts.limit) {
        packages = opts.limit;
    } else {
        packages = [];
    }
    var args = [
        require.resolve('npm/bin/npm-cli'), 'rebuild',
        packages.join(' '),
        '--runtime=electron',
        '--target=' + opts.electronVersion,
        '--arch=' + (opts.arch || process.arch),
        isVerbose(opts.logLevel) ? '--verbose' : null
    ].filter(function(arg) { return arg; });
    return spawnWithHeadersDir(cmd, args, opts.headersDir, opts.modulesDir);
};

var rebuildPackageSet = function(opts) {
    if (!opts || !opts.buildManifest || !opts.cachedPkgs || !opts.modulesDir) {
        throw new TypeError('expected opts in the form of { buildManifest: [...], cachedPkgs: [...] }, modulesDir: \'...\'');
    }
    if (!opts.buildManifest.length) {
        winston.info('ionizer: all builds up-to-date');
        return Promise.resolve();
    }

    // sequentially build each package
    var total = opts.buildManifest.length;
    var packages = opts.buildManifest.map(function(bld) { return bld.package; });
    var bulkBuildOps = _.assign({}, opts, { package: packages.join(' ')} );
    return rebuildDefault(bulkBuildOps)
    .then(function handlePackagesRebuilt() {
        winston.info('ionizer: updating build cache');
        return refreshCtimes(opts.buildManifest, opts.modulesDir);
    });
};

/**
 * Rebuilds modules one-by-one, conditionally, if they are not already built
 * per the cache table
 * @param {object} opts cli-ops
 * @return {Promise}
 */
var rebuildQuick = function(opts) {
    var installedPkgs;
    var cachedPkgs;

    if (!opts.modulesDir || !opts.electronVersion) {
        throw new ReferenceError('expected `electronVersion` and `modulesDir`');
    }

    return Promise.all([
        getInstalledModules(opts.modulesDir),
        getCachedBuildVersions(opts.modulesDir)
    ])
    .then(function(rslts) {
        installedPkgs = rslts[0];
        cachedPkgs = rslts[1];
    })
    .then(function() {
        return generateBuildManifest({
            cachedPkgs: cachedPkgs,
            electronModuleVersion: opts.electronModuleVersion,
            force: opts.force,
            limit: opts.limit,
            ignore: _.uniq([].concat(opts.ignore ? opts.ignore : []).concat(DEFAULT_IGNORE_PKGS)),
            installedPkgs: installedPkgs,
            electronVersion: opts.electronVersion,
        });
    })
    .then(function callRebuildPackageSet(buildManifest) {
        var rebuildOps = _.assign({}, opts, {
            buildManifest: buildManifest,
            modulesDir: opts.modulesDir,
            cachedPkgs: cachedPkgs,
        });
        return rebuildPackageSet(rebuildOps);
    })
    .then(function updateCache(builtPkgs) {
        if (!builtPkgs || !builtPkgs.length) {
            return Promise.resolve(cachedPkgs);
        }
        var builtPkgsByName = _.indexBy(builtPkgs, 'package');
        var cachedPkgsByName = _.indexBy(cachedPkgs, 'package');
        cachedPkgsByName =_.assign(cachedPkgsByName, builtPkgsByName);
        cachedPkgs = _.values(cachedPkgsByName).map(function(pkg) {
            pkg.nodeVersion = opts.electronVersion;
            return pkg;
        });
        return upsertCache(opts.modulesDir, cachedPkgs);
    });
};

var rebuild = function(opts) {
    opts = opts || {};
    opts.headersDir = opts.headersDir || getHeadersRootDirForVersion(opts.electronVersion);
    var assignElectronModuleVersion = function (r) { opts.electronModuleVersion = r; };
    var assignElectronVersion = function (r) { opts.electronVersion = r; };
    var rebuild = function() {
        if (opts.quick) {
            return rebuildQuick(opts);
        }
        return rebuildDefault(opts);
    };

    if (!opts.electronPath) {
        opts.electronPath = require('./utils/electron.js').getPath();
    }
    return Promise.resolve()
    .then(_.partial(electronUtil.version, opts.electronPath))
    .then(assignElectronVersion)
    .then(_.partial(checkForInstalledHeaders, opts))
    .then(_.partial(electronUtil.moduleVersion, opts))
    .then(assignElectronModuleVersion)
    .then(function() {
        // wrap in fn, not partial, for late binding
        return pUtil.squashNode(opts.electronPath);
    })
    .then(rebuild);
};

var setLogLevel = function(lvl) {
    if (!lvl) {
        throw new ReferenceError('empty log level value');
    }
    winston.level = lvl;
};

module.exports = {
    checkForInstalledHeaders: checkForInstalledHeaders,
    generateBuildManifest: generateBuildManifest,
    getHeadersRootDirForVersion: getHeadersRootDirForVersion,
    installHeaders: installHeaders,
    rebuild: rebuild,
    rebuildQuick: rebuildQuick,
    rebuildDefault: rebuildDefault,
    rebuildPackageSet: rebuildPackageSet,
    setLogLevel: setLogLevel,
    shouldRebuild: shouldRebuild,
    spawnWithHeadersDir: spawnWithHeadersDir,
};
