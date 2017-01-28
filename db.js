var postgres, config;
postgres = require("pg");
config = require("./config.js");

module.exports = {
    runQuery : function(sql, params, done) {
        postgres.connect(config.DB_CONNECTION_STRING, function(err, client, close) {
            if (err) {
               console.error(JSON.stringify(err));
                return done(null);
            }
            client.query(sql, params, function(err, result) {
                close();
                if (err) {
                    console.error(JSON.stringify(err));
                    return done(null);
                }
                done(result);
            });
        });
    } 
};
