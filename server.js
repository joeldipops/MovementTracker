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

// TODO - Change to POST
server.post("/page/setup", postSetup); 

server.post(/reset\/[0-9]+/,postReset); 

/** 
 * Convenience method to clear out db for testing.
 */
function resetSession(done) {
    db.runQuery("DELETE FROM WebSession;", [], done || function(){});
};
socketServerControl.setUpServer(server, resetSession); 

function postReset(req, res) {
    var path, sessionId;
    path = url.parse(req.url).path;
    sessionId = path.substring(path.lastIndexOf("/")+1, path.length);
    db.runQuery(queries.deleteSession, [sessionId], function(result) {
        if (!result) {
            res.writeHead(500);
            res.end();
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
                    });
                    return serveHtml(res, fs.readFileSync("template/dmSetup.html"), "Setup Game");       
                } else {
                    return serveHtml(res, fs.readFileSync("template/characterSetup.html"), "Setup Character");                
                }   
            });
        } else {
            if (isDm) {
                if(result.rows[0].isdmset) {
                    // There's already a DM.
                    res.writeHead(409);
                    res.end();
                } else {
                    // Only one can be DM, so broadcast to remove the option for others.
                    socketServerControl.broadcastJSON({ 
                        dm_set : true,
                        session_id : result.rows[0].websessionid
                    });
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
            res.writeHead(404)
            res.write(path + " not found");
            return res.end();
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
    var content, html;
    db.runQuery(queries.getCurrentSession, null, function(result) {
        if (!result.rows.length || !result.rows[0].isdmset ) {
            content = fs.readFileSync("template/index.html");
        } else {
            content = fs.readFileSync("template/characterSetup.html");
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
}

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
}  

server.listen(config.PORT, function() {
    console.log("Listening on port " + config.PORT);
});
