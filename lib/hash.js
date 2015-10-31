var crypto = require('crypto');

module.exports = {
    /**
     * md5 hash an input string
     * @return {string}
     */
    md5: function(str) {
        return crypto.createHash('md5').update(str).digest("hex");
    }
};
