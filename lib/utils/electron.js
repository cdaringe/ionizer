var winston = require('winston');
var path = require('path');
var fs = require('fs');
var spawn = require('./spawn.js');

module.exports = {
    getPath: function() {
        var epbpath = path.resolve(__dirname, '../../node_modules', 'electron-prebuilt', 'path.txt');
        var ePath;
        try {
            ePath = fs.readFileSync(epbpath, 'utf8');
            return ePath;
        } catch (err) {
            // no prebuilt found
            winston.warn([
                'no electron-prebuilt found, attempting to build against',
                'global electron'
            ].join(' '));
        }
        try {
            ePath = require('child_process').spawnSync('which', ['electron'])
                .stdout.toString().match(/.*[a-zA-Z]/)[0];
        } catch (err) {
            debugger;
            winston.error('no local or global electron found');
            process.exit(1);
        }
        return ePath;
    },

    version: function(electronPath) {
        var args = [ '--version' ];
        var result;

        return spawn({
            cmd: electronPath,
            args: args,
        })
        .then(function(result) {
            var ver = (result.stdout + result.stderr).replace(/\n/g, '');
            if (!ver.match(/^v\d+\.\d+\.\d+/)) { // eg v0.35.4
                throw new Error('Failed to check Electron\'s version: ' + ver);
            }
            return ver.replace('v', '');
        });
    },

    moduleVersion: function(electronPath) {
        var ePath = typeof electronPath === 'object' ? electronPath.electronPath : electronPath;
        var args = [ '-e', 'console.log(process.versions.modules)' ];
        var env = { ATOM_SHELL_INTERNAL_RUN_AS_NODE: '1' };
        var result;

        if (!ePath) {
            throw new ReferenceError('missing `electronPath`');
        }

        return spawn({
            cmd: ePath,
            args: args,
            opts: { env: env }
        })
        .then(function(result) {
            var ver = (result.stdout + result.stderr).replace(/\n/g, '');
            if (!ver.match(/^\d+$/)) {
                throw new Error('Failed to check Electron\'s module version number: ' + ver);
            }
            return ver;
        })
        .catch(function(err) {
            winston.error('@TODO - known to have issue with global electron. debug!')
            throw err;
        });
    },

};
