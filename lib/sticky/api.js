'use strict';

var cluster = require('cluster'),
    debug = require('debug')('sticky:worker'),
    sticky = require('../sticky-session'),
    Master = sticky.Master;

exports.listen = listen;

function listen(server, port, options) {
    var master, closeCallback;

    if (cluster.isMaster) {
        master = new Master(options || {});
        master.listen(port);
        master.once('listening', function () {
            server.emit('listening');
        });
        return false;
    }

    // Override close callback to gracefully close server
    closeCallback = server.close;
    server.close = function close() {
        debug('closing gracefully');
        process.send({ type: 'close' });
        return closeCallback.apply(this, arguments);
    };

    process.on('message', function (message, socket) {
        if (!message.length || message[0] !== 'sticky:balance' || !socket) {
            return;
        }

        debug('incoming socket');

        if (message[1]) {
            socket.unshift(new Buffer(message[1], 'base64'));
        }

        server._connections++;
        socket.server = server;
        server.emit('connection', socket);
    });

    return true;
}
