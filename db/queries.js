module.exports = {
    createSession : "\
INSERT INTO WebSession (IsDmSet) \
VALUES ($1)\
RETURNING WebSessionId\
    ;",
    deleteSession: "\
DELETE FROM WebSession \
WHERE WebSessionId = $1\
    ;",
    setDm: "\
UPDATE WebSession \
SET IsDmSet = $2 \
WHERE WebSessionId = $1\
    ;",
    getCurrentSession: "\
SELECT \
    WebSessionId, \
    IsDmSet \
FROM WebSession \
ORDER BY CreatedTimeStamp DESC \
LIMIT 1 \
    ;"
};
    
