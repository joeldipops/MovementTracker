var postgres, config;
postgres = require("pg");
config = require("./config.js");

module.exports = {
    runQuery : function(sql, params, done) {
        if (!done) { done = function() {}; }
        postgres.connect(config.DB_CONNECTION_STRING, function(err, client, close) {
            var i, regex, value;
            if (err) {
                console.error(JSON.stringify(err));
                return done(null);
            }

            // pg.js parameterisation is too limited - can't use the same parameter in two places
            if (params) {
                for(i = 0; i < params.length; i++) {
                    value = params[i];
                    if (typeof params[i] === "string") {
                        value = `'${value}'`;
                    }
                    if (params[i] == null) {//yes, we want == here incase of null or void 0 etc.
                        value = "NULL";
                    }
                    
                    regex = new RegExp("\\$" + (i+1), "g");
                    sql = sql.replace(regex, value);
                }
            }
            client.query(sql, [], function(err, result) {
                close();
                if (err) {
                    console.log("SQL: " + sql);
                    console.log("Params: " + JSON.stringify(params));
                    console.error(JSON.stringify(err));
                    return done(null);
                }
                done(result);
            });
        });
    } 
};
