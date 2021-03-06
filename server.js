var restify, url, fs, qs, mustache,
config, db, queries,
server, body;

restify = require("restify");
url = require("url");
fs = require("fs");
qs = require("querystring");
mustache = require("mustache");

config = require("./config.js");
db = require("./db.js");
queries = require("./db/queries.js");
socketServerControl = require("./socketServer.js"); 

body = fs.readFileSync("template/container.html");

server = restify.createServer();
server.use(restify.plugins.bodyParser());
server.get(/public\/.*/, getStaticFile);
server.get("/", getIndex);
server.get("/page/home", getIndex);
server.get("/page/play", getPlayPage);
server.get("/page/ready", getReadyPage);
server.put(/session\/[0-9]+\/player\/[0-9]+\/ready/, readyPlayer);
server.put(/session\/[0-9]+\/player\/[0-9]+\/move/, movePlayer);
server.put(/session\/[0-9]+\/player\/[0-9]+\/remove/, removePlayerFromCombat);
server.put(/session\/[0-9]+\/player(\/[0-9]+)?/, putPlayer);
server.put(/session\/[0-9]+\/turn\/[0-9]+/, broadcastTurn);
server.get(/session\/[0-9]+\/turn/, getCurrentTurn);

server.get(/session\/[0-9]+\/players/, getPlayerList);
server.post("session", postSession);
server.post("session\/[0-9]+\/broadcast/", broadcastMessage);
server.put(/session\/[0-9]+\/map\/add/, addTerrain);
server.get(/session\/[0-9]+\/map/, downloadMap);
server.put(/session\/[0-9]+\/map/, uploadMap);
server.del(/session\/[0-9]+\/map/, resetMap);

server.get("maps", getSavedMaps);
server.get(/map\/[0-9]+/, getMap);
server.put("maps", saveMap);
server.post("maps", saveMap);


server.get(/session(\/[0-9]+)?$/, getSession);
server.del(/session\/[0-9]+/,deleteSession);

/**
 * Convenience for clearing out db after testing.
 */
function resetSession(done) {
    db.runQuery(`
DELETE FROM Player;
DELETE FROM WebSession;
    `, [], typeof done === "function" ? done : function(){});
};

socketServerControl.setUpServer(server, removePlayer, resetSession);
process.on("SIGINT", function () {
    console.log("Terminating...");
    try {
        console.log("Closing server...");
        server.close();
        console.log("Cleaning up data...");
        resetSession(process.exit.bind(process, 0));
    } catch (error) {
        console.error("Error in shutdown...");
        console.error(JSON.stringify(error));
        process.exit(70); // internal software error;
    }
});

/**
 * Caches the entire map and then broadcasts to all.
 */
function uploadMap(req, res) {
    var sessionId, message;
    sessionId = getEntityId("session", req);
    socketServerControl.cache(`map-${sessionId}`, req.body);
    socketServerControl.broadcastJSON({
        combat_start: true,
        map_update : req.body
    });
    res.writeHead(200);
    res.end();
};

function addTerrain(req, res) {
    var sessionId, message;
    socketServerControl.broadcastJSON({ terrain_update : req.body }, [req.body.socket_id]);
    res.writeHead(200);
    res.end();
};

/**
 * Removes the current map and forces everyone back to the "ready" screen.
 */
function resetMap(req, res) {
    var sessionId;
    sessionId = getEntityId("session", req);
    socketServerControl.clear(`map-${sessionId}`);
    socketServerControl.broadcastJSON({ combat_end : true });
    res.writeHead(200);
    res.end();
}

/**
 * Downloads the latest map.
 */
function downloadMap(req, res) {
    var sessionId;
    sessionId = getEntityId("session", req);
    return serveJSON(res, socketServerControl.cache(`map-${sessionId}`));
}

/**
 * Sends message to all clients in the session.
 */
function broadcastMessage(req, res) {
    socketServerControl.broadcastJSON(req.body.message, [req.body.socket_id]);

    res.writeHead(200);
    res.end();
};

/**
 * Notifies all that the next turn has started.
 */
function broadcastTurn(req, res) {
    var sessionId, mobId, message;
    path = url.parse(req.url).pathname;
    sessionId = getEntityId("session", path);
    mobId = getEntityId("turn", path);
    message = socketServerControl.cache(`currentTurn-${sessionId}`, {
        "turn_start" : { id : mobId }
    });
    socketServerControl.broadcastJSON(message);

    res.writeHead(200);
    res.end();
};

/**
 * Returns the id of the player whose turn it is.
 */
function getCurrentTurn(req, res) {
    var sessionId = getEntityId("session", req);
    return serveJSON(res, socketServerControl.cache(`currentTurn-${sessionId}`));
};

/**
 * Creates or updates a player.
 */
function putPlayer(req, res) {
    var dbParams, query, path, sessionId, cached, playerName;

    path = url.parse(req.url).pathname;
    sessionId = getEntityId("session", path);
    playerId = getEntityId("player", path) || req.body.player_id ||
        (req.body.socket_id && socketServerControl.cache(req.body.socket_id) && socketServerControl.cache(req.body.socket_id).player_id);

    playerName = req.body.player_name || req.body.character_name;

    dbParams = [
        sessionId,
        req.body.socket_id,
        playerName,
        req.body.character_name,
        req.body.player_type,
        req.body.colour,
        req.body.speed ? req.body.speed.walk : null
    ];

    if(playerId) {
        query = queries.updatePlayer;
        dbParams.unshift(playerId);
    } else {
        query = queries.createPlayer;
    }

    db.runQuery(query, dbParams, function(result) {
        var player, message, messageType;
        message = {};
        if (!result) {
            return serveError(res);
        }
        player = socketServerControl.cache(req.body.socket_id, {
            player_id : result.rows[0].playerid,
            character_name: req.body.character_name,
            session_id: sessionId,
            id : result.rows[0].playerid,
            socket_id : req.body.socket_id,
            player_type : req.body.player_type,
            colour: req.body.colour,
            size : req.body.size || "medium",
            speed : req.body.speed,
            player_name : playerName
        });
        cached = {};
        cached[req.body.socket_id] = true;
        socketServerControl.cache(`currentPlayerList-${sessionId}`, cached);
        if (!playerId) {
            switch(req.body.player_type) {
                case "dm": messageType="dm_add"; break;
                case "player": messageType="player_add"; break;
                default: messageType="spectator_add";
            }
            message[messageType] = {
                player_name: playerName,
                character_name: req.body.character_name,
                player_id: player.player_id,
                session_id: sessionId,
                colour: player.colour,
                size: player.size,
                speed : player.speed
            };
            socketServerControl.broadcastJSON(message);
        }
        return serveJSON(res, player);
    });
};

/**
 * Sets and broadcasts the player's current initiative.
 */
function readyPlayer(req, res) {
    var playerId = getEntityId("player", req);
    socketServerControl.cache(req.body.socket_id, { initiative : req.body.initiative});
    socketServerControl.broadcastJSON({
        "player_update" : {
            player_id : playerId,
            initiative : req.body.initiative
        }
    });
    res.writeHead(200);
    res.end();
};

/**
 * Notifies all users that the player has moved.
 */
function movePlayer(req, res) {
    var id = getEntityId("player", req);
    socketServerControl.broadcastJSON({
        "player_move" : {
            id : id,
            x : req.body.x,
            y : req.body.y,
            character_name : req.body.character_name,
            colour: req.body.colour
        }
    }, [req.body.socket_id]);
    res.writeHead(200);
    res.end();
};

function removePlayerFromCombat(req, res) {
    var id = getEntityId("player", req);
    socketServerControl.broadcastJSON({
        "player_remove" : {
            id : id,
            from_combat: true
        }}, [req.body.socket_id]
    );
    res.writeHead(200);
    res.end();
}

function getSession(req, res) {
    db.runQuery(queries.getCurrentSession, null, function(result) {
        if (!result) {
            return serveError(res);
        }
        if (!result.rows[0]) {
            return serveError(res, "", 404);
        }
        return serveJSON(res, {
            session_id : result.rows[0].websessionid,
            is_dm_set : result.rows[0].isdmset
        });
    });
};

/**
 * Resets the session
 */
function deleteSession(req, res) {
    var path, sessionId;
    path = url.parse(req.url).pathname;
    sessionId = getEntityId("session", path);
    socketServerControl.broadcastJSON({"session_end" : true});
    socketServerControl.blowUpCache();
    db.runQuery(queries.deleteSession, [sessionId], function(result) {
        if (!result) {
            return serveError(res);
        } else {
            res.writeHead(200);
            res.end();
        }
    });
};

function getPlayerList(req, res) {
    var path, sessionId, params, cached, item, body;
    path = url.parse(req.url).pathname;
    sessionId = getEntityId("session", path);
    params = getParams(req);

    body = { players : [] };
    cached = socketServerControl.cache(`currentPlayerList-${sessionId}`);
    for (var k in cached) {
        if (!cached.hasOwnProperty(k)) {
            continue;
        }
        item = socketServerControl.cache(k);
        // No longer exists, clean it up.
        if (!item) {
            delete cached[k];
            continue;
        }
        if (params.player_type && params.player_type !== item.player_type) {
            continue;
        }
        body.players.push(item);
    }
    return serveJSON(res, body);
};

/**
 * Creates a session if one doesn't exist.
 */
function postSession(req, res) {
    db.runQuery(queries.getCurrentSession, null, function(result) {
        if (!result) {
             return serveError();
        }

        if (!result.rows.length) {
            db.runQuery(queries.createSession, null, function(result) {
                var body;
                if (!result || !result.rows[0]) {
                    return serveError();
                }
                body = { session_id: result.rows[0].websessionid };
                socketServerControl.broadcastJSON(body, [req.body.socket_id]);
                return serveJSON(res, body);
            });
        } else {
            res.writeHead(200);
            res.end();
        }
    });
}

function removePlayer(data) {
    var cached, map, k, i, mob, indices;
    // remove the player from the cache
    cached = socketServerControl.cache(`currentPlayerList-${data.session_id}`);
    delete cached[data.socket_id];

    // and from the map's list of mobs.
    map = socketServerControl.cache(`map-${data.session_id}`);

    if (map && map.mobs) {
        indices = [];
        // k is the map co-ordinate.
        for (k in map.mobs) {
            if (!map.mobs.hasOwnProperty(k)) {
                continue;
            }

            // Iterate backwards so splicing an earlier element won't move a later one
            // in the unexpected case that the same mob appears twice t the same co-ord.
            for (i = map.mobs[k].length - 1; i >= 0 ; i--) {
                if (map.mobs[k][i].id.toString() === data.id.toString()) {
                    indices.push({ k : k, i : i});
                }
            }
        }

        for (i = 0; i < indices.length; i++) {
            // Remove the element;
            map.mobs[indices[i].k].splice(indices[i].i, 1);
        }
    }

    db.runQuery(queries.deletePlayer, [data.player_id], function() {});
};

/**
 * Serves a static file in the public directory.
 */
function getStaticFile(req, res) {
    var path, regex, extension;
    path = "." + url.parse(req.url).pathname;

    fs.readFile(path, function(err, data) {
        if (err) {
            return serveError(res, path + " not found", 404);
        }
        res.writeHead(200, { "Content-Type" : estimateContentType(path) });
        res.write(data);
        return res.end();
    });
}

function getPlayPage(req, res) {
    var content = fs.readFileSync("template/combat.html");
    return serveHtml(res, content);
};

function getReadyPage(req, res) {
    var content = fs.readFileSync("template/ready.html");
    return serveHtml(res, content);
};

/**
 * Gets the list of saved maps.
 */
function getSavedMaps(req, res) {
    db.runQuery(queries.getMaps, null, function(result) {
        var i, body;
        if (!result) {
            return serveJSON(res, {});
        }
        body = [];
        for (i = 0; i < result.rows.length; i++) {
            body.push({
                name : result.rows[i].name,
                map_id : result.rows[i].mapid,
                data : result.rows[i].data
            })
        }
        return serveJSON(res, body);
    });
};

/**
 * Gets a pre-made map from the database.
 */
function getMap(req, res) {
    var mapId = getEntityId("map", req);
    db.runQuery(queries.getMap, [mapId], function(result) {
        var body;
        if (!result || !result.rows[0]) {
            return serveError(res, "Not Found", 404);
        }
        body = {
            map_id : result.rows[0].mapid,
            name : result.rows[0].name,
            data : JSON.parse(result.rows[0].data)
        };
        return serveJSON(res, body);
    });
};

/**
 * Creates or updates a pre-made map in the database.
 */
function saveMap(req, res) {
    var callback, dataString;

    // Check that  request came through the correct channel.  PUTs should be guaranteed idempotent
    if (req.getRoute().method === "PUT" && !req.body.map_id) {
        return serveError(res, "map_id property is required", 400);
    }

    dataString = JSON.stringify(req.body.data);

    callback = function(result) {
        var id = (result.rows && result.rows[0] && result.rows[0].mapid) || req.body.map_id;
        return serveJSON(res, {
            map_id : id,
            data : req.body.data,
            name : req.body.name
        });
    };

    if (req.body.map_id) {
        db.runQuery(queries.updateMap, [req.body.map_id, req.body.name, dataString], callback);
    } else {
        db.runQuery(queries.saveNewMap, [req.body.name, dataString], callback);
    }
};

/**
 * Serves the index page.
 */
function getIndex(req, res) {
    var content, html, sessionScript;
    db.runQuery(queries.getCurrentSession, null, function(result) {
        socialContent = fs.readFileSync("template/social.html");
        if (!result.rows.length) {
            content = fs.readFileSync("template/index.html");
        } else {
            // Ensure all browsers are on the same session. (For now)
            sessionScript = `
<script type="application/javascript">window.sessionId = ${result.rows[0].websessionid};</script>
            `;
            content = sessionScript + fs.readFileSync("template/index.html");
        }
        
        html = mustache.render(body.toString(), {
            bootstrap: sessionScript || "",
            content: content,
            social: socialContent
        });
       return serveHtml(res, html);
    });
};

/**
 * Takes a request and returns the querystring or json body as a hash.
 * @param req The request object..
 * @returns {object} The querystring parameters.
 */
function getParams(req) {
    return qs.parse(url.parse(req.url).query);
}

/**
 * Selects the mime type of a file to be served based on its name.
 * @param {string} fileName The name of the file including extension.
 * @returns {string} The mime type.
 */
function estimateContentType(fileName) {
    var ext = fileName.match(/.+\.(.*)/)[1];
    if (!ext) {
        return "";
    }
    switch(ext) {
        case "html": return "text/html";
        case "css": return "text/css";
        case "js": return "application/javascript";
        default: return "text/plaintext";
    }
};

/**
 * Sends a html response
 * @param res The response object to manipulate.
 * @param {string} content The body content of the html document.
 * @param {string} pageName The title of the html page. 
 */
function serveHtml(res, content) {
    res.writeHead(200, { "Content-Type" : "text/html" });
    res.write(content);
    return res.end();
};

function serveJSON(res, content) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.write(JSON.stringify(content) || "{}");
    return res.end();
};

/**
 * Sends an error response
 * @param {ServerResponse} response object.
 * @param {string} message Error message
 * @param {number|undefined} code HTTP Status code. Defaults to 500
 */
function serveError(res, message, code) {
    res.writeHead(code || 500, { "Content-Type" : "text/plaintext" });
    res.write(message || "");
    return res.end();
};

/**
 * Extracts the entity id from the url
 * @param {string} entityName the name of the entity as it appears in the url.
 * @param {string|object} path The url path or the request containing it.
 */
function getEntityId(entityName, path) {
    if (typeof path !== "string") {
        path = url.parse(path.url).pathname;
    }
    var regex, result;
    regex = new RegExp("^.*\/" + entityName + "\/([0-9]+)\/?.*$")

    result = regex.exec(path);
    if (!result) {
        return;
    }
    return parseInt(result[1], 10);
};

server.listen(config.PORT, function() {
    console.log("Listening on port " + config.PORT);
});
