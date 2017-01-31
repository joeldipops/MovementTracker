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
server.post("/page/setup", postSetup);
server.put("/player", putPlayer);
server.get("/page/play", function(req, res) {res.end();});

server.post(/reset\/[0-9]+/,postReset); 


/** 
 * Convenience for clearing out db after testing.
 */
function resetSession(done) {
    db.runQuery(`
DELETE FROM Player;
DELETE FROM WebSession;
    `, [], done || function(){});
};

socketServerControl.setUpServer(server, resetSession); 
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
 * Creates or updates a player.
 */
function putPlayer(req, res) {
    var dbParams, query;
    dbParams = [
        req.body.session_id,
        req.body.player_name,
        req.body.character_name,
        !!req.body.is_dm    
    ];

    if(req.body.player_id) {
        query = queries.updatePlayer;
        dbParams.unshift(req.body.player_id);
    } else {
        query = queries.createPlayer;
    }

    db.runQuery(query, dbParams, function(result) {
        if (!result) {
            return serveError(res);
        }
        socketServerControl.cache(req.body.socket_id, { player_id : result.rows[0].playerid });
        res.writeHead(200);
        res.end();
    });   
};

/**
 * Resets the session
 */
function postReset(req, res) {
    var path, sessionId;
    path = url.parse(req.url).path;
    sessionId = path.substring(path.lastIndexOf("/")+1, path.length);
    db.runQuery(queries.deleteSession, [sessionId], function(result) {
        if (!result) {
            res.serveError(res);
        } else {
            res.writeHead(200);
            res.end();
        }
    });
};

/**
 * Serves the setup page.  If a DM has been chosen, set this and broadcast.
 */
function postSetup(req, res) {
    var params, isDm;
    params = getParams(req);
    isDm = !!parseInt(params.is_dm, 10);
    
    db.runQuery(queries.getCurrentSession, null, function(result) {
        if (!result.rows.length) {
            db.runQuery(queries.createSession, [isDm], function(result) {
                if (isDm) {
                    // Only one can be DM, so broadcast to remove the option for others.
                    socketServerControl.broadcastJSON({ 
                        dm_set : true,
                        session_id : result.rows[0].websessionid
                    }, [params.socket_id]);
                    return serveHtml(res, fs.readFileSync("template/dmSetup.html"), "Setup Game");       
                } else {
                    socketServerControl.broadcastJSON({ 
                        dm_set : false,
                        session_id : result.rows[0].websessionid
                    }, [params.socket_id]);                
                    return serveHtml(res, fs.readFileSync("template/characterSetup.html"), "Setup Character");                
                }   
            });
        } else {
            if (isDm) {
                if(result.rows[0].isdmset) {
                    // There's already a DM.
                    return serveError(res, "DM Set", 409);
                } else {
                    // Only one can be DM, so broadcast to remove the option for others.
                    socketServerControl.broadcastJSON({ 
                        dm_set : true,
                        session_id : result.rows[0].websessionid
                    }, [params.socket_id]);
                    return serveHtml(res, fs.readFileSync("template/dmSetup.html"), "Setup Game");               
                }
           } else {
               return serveHtml(res, fs.readFileSync("template/characterSetup.html"), "Setup Character");
           }
       }
    });
}

/**
 * Serves a static file in the public directory.
 */
function getStaticFile(req, res) {
    var path, regex, extension;
    path = "." + url.parse(req.url).path;
    
    fs.readFile(path, function(err, data) {
        if (err) {
            return serveError(res, path + " not found", 404);
        }
        res.writeHead(200, { "Content-Type" : estimateContentType(path) });
        res.write(data);
        return res.end();        
    });
}

/**
 * Serves the index page.
 */
function getIndex(req, res) {
    var content, html, sessionScript;
    db.runQuery(queries.getCurrentSession, null, function(result) {
        if (!result.rows.length) {
            content = fs.readFileSync("template/index.html");
        } else {
            // Ensure all browsers are on the same session. (For now)
            sessionScript = `
<script type="application/javascript">window.sessionId = ${result.rows[0].websessionid};</script>
            `;

            if (!result.rows[0].isdmset ) {
                content = fs.readFileSync("template/index.html");
            } else {
                content = fs.readFileSync("template/characterSetup.html");
            }
            content += sessionScript;
        }
        html = mustache.render(body.toString(), {
            content: content,
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

/**
 * Sends an error response
 * @param {ServerResponse} response object.
 * @param {string} message Error message
 * @param {number|undefined} code HTTP Status code. Defaults to 500
 */
function serveError(res, message, code) {
    res.writeHead(code || 500, { "Content-Type" : "text/plaintext" });
    res.write(message);
    return res.end();
};

server.listen(config.PORT, function() {
    console.log("Listening on port " + config.PORT);
});
