#!/usr/bin/env node
var ionizer = require('./main.js');
var installHeaders = ionizer.installHeaders;
var rebuild = ionizer.rebuild;
var shouldRebuild = ionizer.shouldRebuild;
var path = require('path');
var fs = require('fs');
var root = path.join(process.cwd());
var program = require('commander');
var winston = require('winston');
var spawnSync = require('child_process').spawnSync;
var electronPath;
var electronModuleVersion; // extracted from electron binary

var list = function(val) {
    return val.split(',');
};

program
.option('-q, --quick', '[optional] recommended. quick rebuilds, using cache')
.option('-e, --electron-path [/path/to/prebuilt]', [
    '[optional] electron binary to build with. first tests for',
    'electron-prebuilt binary, then falls back to global electron'
])
.option('-l, --limit [csv-of-packages]', 'limit rebuild to a specific package', list)
.option('-i, --ignore [csv-of-packages]', 'ignore specified packages from rebuilding', list)
.option('-f, --force', '[optional] force rebuilding modules, even if build would skip otherwise')
.option('-m, --modules-dir [/path/to/node_modules]', [
    '[optional] path to the node_modules directory to rebuild.',
    'assumes your project\'s current path as default'
].join(' '))
.option('-a, --arch [arch]', "[optional] override the target architecture to something other than your system's")
.option('--log-level [level]', '[optional] turn ionizer into a chatty cathy. debug/verbose/info/warning/error')
.parse(process.argv);

if (program.logLevel) {
    winston.level = program.logLevel === true ? 'verbose' : program.logLevel;
}

// guess electron binary path if none specified
if (!program.electronPath) {
    program.electronPath = require('./utils/electron.js').getPath();
}

winston.debug('electron-path:', program.electronPath);

// assume that we're going to rebuild the immediate parent's node_modules
if (!program.modulesDir) {
    try {
        program.modulesDir = path.resolve(root, 'node_modules');
    } catch (err) {
        winston.error('Unable to find projects node_modules directory, specify it via --modules-dir');
        process.exit(-1);
    }
}


// test if we must rebuild, then rebuild!
shouldRebuild(program.electronPath)
.then(function(result) {
    if (result.electronModuleVersion === undefined ||
        result.electronVersion === undefined ||
        result.shouldRebuild === undefined) {
        throw new ReferenceError('expected electronnVersion, electronModuleVersion, and shouldRebuild props');
    }
    if (!result.shouldRebuild && !program.force) {
        process.exit(0);
    }
    winston.debug('electron-version:', result.electronVersion);
    winston.debug('sys-node-version:', process.version);
    winston.debug('electron-modules-version:', result.electronModuleVersion);
    winston.debug('sys-node-modules-version:', process.versions.modules);
    return installHeaders({ electronPath: program.electronPath });
})
.then(function() {
    var opts = {
        arch: program.arch,
        electronPath: program.electronPath,
        modulesDir: program.modulesDir,
        targetVersion: program.targetVersion,
        quick: program.quick,
        limit: program.limit,
        force: program.force,
        ignore: program.ignore,
        logLevel: program.logLevel
    };
    return rebuild(opts);
})
.then(function() {
    winston.verbose('rebuild complete');
})
.catch(function(err) {
    winston.error(err);
    process.exit(1);
});
