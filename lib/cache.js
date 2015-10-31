var path = require('path');
var os = require('os');
var md5 = require('./hash').md5;
var fs = require('fs');
var winston = require('winston');

/**
 * Returns the path to the quick-build cache for a given nodeModules folder
 * @param {string} modulesDir
 * @return {string} /path/to/quick-build-cache
 */
var getPackageCachePath = function(modulesDir) {
    var pathHash = md5(path.resolve(modulesDir));
    return path.resolve(os.tmpdir(), 'ionizer-cache-' + pathHash);
};

/**
 * Returns the quick-build cache
 * @param {string} modulesDir
 * @return {Promise} resolves => quick-build cache
 */
var getCachedBuildVersions = function(modulesDir) {
    if (!modulesDir) {
        throw new ReferenceError('modulesDir missing');
    }
    var cachePath = getPackageCachePath(modulesDir);
    return fs.readFileAsync(cachePath, 'utf8')
    .then(function(cache) {
        return JSON.parse(cache);
    })
    .catch(function(err) {
        if (err && err.code === 'ENOENT') {
          // no existing cache. upsert it to disk in a hot moment
          return [];
        }
    });
}

/**
 * Filters a list of file names to include only those that point to folders
 * within the provided src folder
 * @param {array} fnames list of file or folder names
 * @param {string} modulesDir
 * @return {Promise} resolves => ['names', 'of', 'folders']
 */
function filterFsFolders(fnames, modulesDir) {
    var stats = fnames.map(function(file) {
        return fs.statAsync(path.join(modulesDir, file));
    });
    return Promise.all(stats)
    .then(function(stats) {
        return stats.map(function(stat, ndx)  {
            if (stat.isDirectory()) {
                return {
                    package: fnames[ndx],
                    stat: stat
                };
            }
        }).filter(function(f) { return f; });
    })
    .catch(function(err) {
        winston.error('unable to read folders in node_modules directory: ' + modulesDir);
        throw err;
    });
}

/**
 * Returns all of the folders in the provided node_modules,
 * and `stat` objects for each
 * @param {string} modulesDir
 * @return {Promise} resolves => [{ name: 'folder-name', stat: Stat}]
 */
function getInstalledModules(modulesDir) {
    return fs.readdirAsync(modulesDir)
    .then(function(nm) {
        var contents = nm.filter(function(name) {
            return !name.match(/^\./); // ignore hidden
        });
        return filterFsFolders(contents, modulesDir);
    });
}

/**
 * Updates an array of pkgs to match their latest ctime values
 * @param {array} pkgs in cache meta format
 * @return {Promise}
 */
function refreshCtimes(pkgs, modulesDir) {
    if (!Array.isArray(pkgs)) {
        throw new ReferenceError('expected array of packages');
    }
    if (typeof modulesDir !== 'string') {
        throw new ReferenceError('expected string modulesDir');
    }
    var updateCtimes = function(pkg) {
        if (!pkg.ctime) {
            throw new ReferenceError('all packages must begin with a base ctime');
        }
        return fs.statAsync(path.resolve(modulesDir, pkg.package))
        .then(function(stat) {
            pkg.ctime = stat.ctime.toISOString();
            return pkg;
        });
    };
    var updated = pkgs.map(updateCtimes);
    return Promise.all(updated);
}

/**
 * Creates or updates the quick-rebuild cache
 * @param {string} modulesDir
 * @param {array=} cache values [{ package: ..., nodeVersion: ..., ctime: ... }]
 * @return {Promise} resolves => cache
 */
function upsertCache(modulesDir, cache) {
    cache = cache || [];
    var verb = cache.length ? 'updated' : 'built';
    var cachePath = getPackageCachePath(modulesDir);
    return fs.writeFileAsync(cachePath, JSON.stringify(cache))
    .then(function() { winston.info('ionizer: cache ' + verb + ' (' + cachePath + ')'); })
    .then(function() { return cache; });
}

/**
 * Deletes a cache
 * @param {string} modulesDir
 * @return {Promise}
 */
function downsertCache(modulesDir) {
    var cachePath = getPackageCachePath(modulesDir);
    return fs.unlinkAsync(cachePath)
    .then(function() { winston.info('ionizer: cache cleared'); return; });
}

module.exports = {
    downsertCache: downsertCache,
    getCachedBuildVersions: getCachedBuildVersions,
    getInstalledModules: getInstalledModules,
    getPackageCachePath: getPackageCachePath,
    upsertCache: upsertCache,
    refreshCtimes: refreshCtimes,
    getInstalledModules: getInstalledModules,
};
