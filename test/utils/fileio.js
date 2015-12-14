var _ = require('lodash');
var rimraf = require('rimraf');
var fs = require('fs');

module.exports = {
    rmdir: function(dir) {
        return rimraf.sync(dir);
    },

    mkdir: function(dir) {
        return fs.mkdirAsync(dir)
        .catch(function(err) {
            if (err.code === 'EEXIST') {
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
        err.code = 'EFILEBOGUS';
        throw err;
    },

};
