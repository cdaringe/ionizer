var _ = require('lodash');
var fs = Promise.promisifyAll(require('fs'));
var rimraf = Promise.promisify(require('rimraf'));

module.exports = {
    rmdir: function(dir) {
        return rimraf(dir);
    },

    mkdir: function(dir) {
        var mkdir = function() {
            return fs.mkdirAsync(dir);
        };
        return mkdir().catch(function(err) {
            if (err === 'EEXIST' || err.code === 'EEXIST') {
                return;
            }
            throw err;
        });
    },

    assertFilePresent: function(path) {
        var stat = fs.statSync(path);
        if (stat instanceof Error) {
            throw stat;
        }
    },

    assertFileNotPresent: function(path) {
        var stat;
        try {
            stat = fs.statSync(path);
        } catch(err) {
            if (err.code !== 'ENOENT') {
                throw err;
            }
            return;
        }
        var err = new ReferenceError([
            'file present when file should not be present:',
            path
        ].join(' '));
        err.code = 'EFILEBOGUS'
        throw err;
    },

};
