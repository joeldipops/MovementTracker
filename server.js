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
server.use(restify.bodyParser());
server.get(/public\/.*/, getStaticFile);
server.get("/", getIndex);
server.get("/page/home", getIndex);
server.get("/page/play", getPlayPage);
server.get("/page/ready", getReadyPage);
server.get("/page/dm_console", getDmConsolePage);
server.put(/session\/[0-9]+\/player\/[0-9]+\/ready/, readyPlayer);
server.put(/session\/[0-9]+\/player\/[0-9]+\/move/, movePlayer);
server.put(/session\/[0-9]+\/player\/[0-9]+\/remove/, removePlayerFromCombat);
server.post(/session\/[0-9]+\/player\/[0-9]+\/react/, useReaction);
server.put(/session\/[0-9]+\/player(\/[0-9]+)?/, putPlayer);
server.put(/session\/[0-9]+\/turn\/[0-9]+/, broadcastTurn);
server.get(/session\/[0-9]+\/turn/, getCurrentTurn);

server.get(/session\/[0-9]+\/players/, getPlayerList);
server.post("session", postSession);
server.put(/session\/[0-9]+\/map\/add/, addTerrain);
server.get(/session\/[0-9]+\/map/, downloadMap);
server.put(/session\/[0-9]+\/map/, uploadMap);
server.del(/session\/[0-9]+\/map/, resetMap);


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
    socketServerControl.broadcastJSON({ map_update : req.body });
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
    var dbParams, query, path, sessionId;

    path = url.parse(req.url).pathname;
    sessionId = getEntityId("session", path);
    playerId = getEntityId("player", path) || req.body.player_id ||
        (req.body.socket_id && socketServerControl.cache(req.body.socket_id) && socketServerControl.cache(req.body.socket_id).player_id);

    dbParams = [
        sessionId,
        req.body.socket_id,
        req.body.player_name,
        req.body.character_name,
        req.body.player_type,
        req.body.colour,
        req.body.speed
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
            id : result.rows[0].playerid,
            socket_id : req.body.socket_id,
            player_type : req.body.player_type,
            colour: req.body.colour,
            size : req.body.size || "medium",
            speed : {
                walk : req.body.speed
            }
        });
        if (!playerId) {
            switch(req.body.player_type) {
                case "dm": messageType="dm_add"; break;
                case "player": messageType="player_add"; break;
                default: messageType="spectator_add";
            }
            message[messageType] = {
                player_name: req.body.player_name,
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

function useReaction(req, res) {
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
    });
    res.writeHead(200);
    res.end();
};

function removePlayerFromCombat(req, res) {
    var id = getEntityId("player", req);
    socketServerControl.broadcastJSON({
        "player_remove" : {
            id : id,
            from_combat: true
        }
    });
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
    var path, sessionId, params, cached;
    path = url.parse(req.url).pathname;
    sessionId = getEntityId("session", path);
    params = getParams(req);

    db.runQuery(queries.getPlayers, [sessionId, JSON.parse(params.player_type || null)], function(result) {
        var i, body;
        if (!result) {
            return serveError(res);
        }
        body = { players : [] };
        for (i = 0; i < result.rows.length; i++) {
            cached = socketServerControl.cache(result.rows[i].socketid);

            body.players.push({
                player_id: result.rows[i].playerid,
                player_name: result.rows[i].playername,
                character_name: result.rows[i].charactername,
                player_type: result.rows[i].playertype,
                colour: result.rows[i].colour,
                size: result.rows[i].size,
                speed: {
                    walk : result.rows[i].speed
                },
                initiative: cached && cached.initiative
            });
        }

        res.writeHead(200, { "Content-Type" : "application/json" });

        res.write(JSON.stringify(body));
        res.end();
    });
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
                socketServerControl.broadcastJSON(body);
                return serveJSON(res, body);
            });
        } else {
            res.writeHead(200);
            res.end();
        }
    });
}

function removePlayer(data) {
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

function getDmConsolePage(req, res) {
    var content = fs.readFileSync("template/dmSetup.html");
    return serveHtml(res, content);
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
