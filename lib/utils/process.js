module.exports = {
    squashNode: function(ePath) {
        var oldNode = process.versions.modules;
        squishSquash({ squash: 'node', cmdpath: ePath });
        var newNode = childProcess.spawnSync(
            'node',
            ['-e', 'console.log(process.versions.modules)'],
            { env: _.assign(process.env, { ATOM_SHELL_INTERNAL_RUN_AS_NODE: '1' }) }
        ).stdout.toString().replace('\n', '');
        winston.verbose([
            'node pre-squash (' + oldNode + ')',
            'node post-squash (' + newNode + ')'
        ].join(' // '));
    }
};
