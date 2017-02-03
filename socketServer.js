var websocket,
_onRequest, _onMessage, _onClose,
_onNoConnections, _onConnectionLost,
_count, _connections, _server, _cache,
shared;

websocket = require("websocket");

_count = 0;
_connections = {};
_cache = {};
_reverseCache = {};

/**
 * Cleans up a closed connection.
 * @param id of the connection.
 */
_onClose = function(id, reasonCode, desc) {
    var message = {};
    delete _connections[id];
    console.log("Connection " + id + " Lost");
    if (!Object.keys(_connections).length) {
        console.log("All connections closed...");
        _onNoConnections && _onNoConnections();
    }
    if (!_cache[id]) {
        return;
    }
    message[_cache[id].is_dm ? "dm_remove" : "player_remove"] = _cache[id];
    shared.broadcastJSON(message);
    _onConnectionLost(_cache[id]);
    delete _cache[id];
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
     * @param {function} onConnectionLost Called when any connection is lost.
     * @param {function} onNoConnections Called when all connections are lost. 
     * @returns new socket server.
     */
    setUpServer : function(webServer, onConnectionLost, onNoConnections) {
        _server = new websocket.server({ httpServer: webServer});
        _server.on("request", _onRequest);
        _onConnectionLost = onConnectionLost
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
