var app = require('ampersand-app');
var _ = require('lodash');

// var httpServer = require('http-server');
//
// // build a server to server header files
// server = httpServer.createServer({
//     root: process.cwd(),
//     cors: true,
//     robots: true,
//     // headers: {
//     //   'Access-Control-Allow-Origin': '*',
//     //   'Access-Control-Allow-Credentials': 'true'
//     // }
// });
// server.listen(9009);

var hapi = require('hapi');

var server = new hapi.Server();
server.connection({ port: 9009 });
server.register(require('inert'), function (err) {
    server.route({
        method: 'GET',
        path: '/{param*}',
        handler: {
            directory: {
                path: './',
                listing: true,
                showHidden: true
            }
        }
    });
});

app.server = server;
consumers = 0;
app.incrimentConsumer = function() {
    if (!consumers) {
        server.start(function() {
            console.log('server running at: ' + server.info.uri);
        });
    }
    consumers += 1;
};
app.decrimentConsumer = function() {
    consumers -= 1;
    if (!consumers) {
        server.stop({ timeout: 0 }, function() {
            console.log('server closing, no more consumes');
        });
    }
};
