const cp = require('child_process');

module.exports = function (options) {
  options = options || {};
  options.stdio = 'inherit';
  return new Promise(function(resolve, reject) {
    const proc = cp.spawn(options.cmd, options.args, options.opts);
    proc.on('close', (exitCode) => {
      if (exitCode !== 0) reject(new Error(`exited with code: ${exitCode}`));
      else resolve();
    });
  });
};
