var websocket,
_onRequest, _onMessage, _onClose,
_onNoConnections,
_count, _connections, _server, _cache,
shared;

websocket = require("websocket");

_count = 0;
_connections = {};
_cache = {};

/**
 * Cleans up a closed connection.
 * @param id of the connection.
 */
_onClose = function(id, reasonCode, desc) {
    delete _connections[id];
    console.log("Connection " + id + " Lost");
    if (!Object.keys(_connections).length) {
        console.log("All connections closed...");
        _onNoConnections && _onNoConnections();
    }
};

/**
 * Tracks a new connection.
 * @param req The connection request.
 */
_onRequest = function(req) {
    var id = _count++;
    _connections[id] = req.accept("echo-protocol", req.origin);
    console.log("Connection " + id + " Accepted");
    _connections[id].on("close", _onClose.bind({}, id));
    shared.sendJSON(id, { socket_id : id });
};

    
shared = {
    /**
     * Sets up a socket server to listen for connection requests.
     * @param webServer associated http server.
     * @param {function} onNoConnections Called when all connections are lost. 
     * @returns new socket server.
     */
    setUpServer : function(webServer, onNoConnections) {
        _server = new websocket.server({ httpServer: webServer});
        _server.on("request", _onRequest);
        _onNoConnections = onNoConnections;
        return _server;
    },
    /**
     * Sends a message string to all clients.
     * @param {string} message The message.
     * @param {array of number} excluding List of client ids that should not receive the message.     
     */
    broadcastMessage : function(message, excluding) {
        var i;
        for (i in _connections) {
            if (!_connections.hasOwnProperty(i)) {
                continue;
            }
            // ignore excluded connections.
            if (excluding && excluding.indexOf(i) >= 0) {
                continue;
            }            
            
            _connections[i].sendUTF(message);
        }
    },
    /**
     * Sends an object to all clients as JSON.
     * @param {object} json The object.
     * @param {array of number} excluding List of client ids that should not receive the message.
     */
    broadcastJSON : function(json, excluding) {
        return this.broadcastMessage(JSON.stringify(json), excluding);
    },
    
    /**
     * Sends an object to a given list of clients.
     * @param {number|array of number} ids Client ids to send to. 
     * @param {object} json The object.
     */
    sendJSON: function(ids, json) {
        var i;
        if (!Array.isArray(ids)) {      
            ids = [ids];
        }
        for (i = 0; i < ids.length; i++) {
            _connections[ids[i]].sendUTF(JSON.stringify(json));
        }
    },
    
    /**
     * Caches data against a connection.
     * @param {number} id of the connection.
     * @param {object|undefined} hash to add to the cache.
     * @returns {object} the cached object.
     */
    cache: function(id, data) {
        if (data) {
            _cache[id] = Object.assign(_cache[id] || {}, data);
        }
        return _cache[id];
    }
};

module.exports = shared;
