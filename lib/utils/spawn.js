var _ = require('lodash');
var child_process = require('child_process');

module.exports = function (options) {
    options = options || {};
    var stdout = (options.stdout && process.stdout) ? process.stdout : [];
    var stderr = (options.stderr && process.stderr) ? process.stderr : [];

    return new Promise(function(resolve, reject) {
        var error = null;
        var proc = child_process.spawn(options.cmd, options.args, options.opts);

        proc.stdout.on('data', function(data) {
            if (_.isArray(stdout)) {
                stdout.push(data.toString());
            } else {
                stdout.write(data.toString());
            }
        });

        proc.stderr.on('data', function(data) {
            if(_.isArray(stderr)) {
                stderr.push(data.toString());
            } else {
                stderr.write(data.toString());
            }
        });

        proc.on('error', function(processError) {
            return error = error || processError;
        });

        proc.on('close', function(exitCode, signal) {
            var stdoutStr = _.isArray(stdout) ? stdout.join('') : '';
            var stderrStr = _.isArray(stderr) ? stderr.join('') : '';
            if (exitCode !== 0) {
                error = error || new Error("Process exited with code: " + exitCode);
                error.stdout = stdoutStr;
                error.stderr = stderrStr;
            }

            var results = {
                stderr: stderrStr, stdout: stdoutStr,
                code: exitCode
            };

            if (error) {
                reject(error);
            } else {
                resolve(results);
            }
        });
    });
};
