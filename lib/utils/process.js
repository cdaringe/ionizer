var winston = require('winston');
var squishSquash = require('squish-squash');
var cp = require('child_process');
var path = require('path');
var _ = require('lodash');
module.exports = {
    squashNode: function(ePath) {
        if (!ePath) {
            throw new ReferenceError('missing electron path');
        }
        var oldNode = process.versions.modules;
        var link = squishSquash({ squash: 'node', cmdpath: ePath });
        debugger;
        var newNode = cp.spawnSync(
            'node',
            ['-e', 'console.log(process.versions.modules)'],
            { env: _.assign(process.env, { ATOM_SHELL_INTERNAL_RUN_AS_NODE: 1 }) }
        ).stdout.toString().replace('\n', '');
        winston.debug('electron/node path:', path.resolve(ePath));
        winston.verbose([
            'node pre-squash (' + oldNode + ')',
            'node post-squash (' + newNode + ')'
        ].join(' // '));
    }
};
