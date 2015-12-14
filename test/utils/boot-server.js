var app = require('ampersand-app');
var httpServer = require('http-server');

// build a server to server header files
server = httpServer.createServer({
    root: process.cwd(),
    robots: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true'
    }
});
server.listen(9009);

app.server = server;
consumers = 0;
app.incrimentConsumer = function() { consumers += 1; };
app.decrimentConsumer = function() {
    consumers -= 1;
    if (!consumers) {
        console.log('server closing, no more consumes');
        server.close();
    }
};
