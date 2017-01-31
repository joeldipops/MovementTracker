module.exports = {
    createSession : `
INSERT INTO WebSession (IsDmSet)
VALUES ($1)
RETURNING WebSessionId
    ;`,
    deleteSession: `
DELETE FROM WebSession
WHERE WebSessionId = $1;
    `,
    setDm: `
UPDATE WebSession
SET IsDmSet = $2
WHERE WebSessionId = $1
    ;`,
    getCurrentSession: `
SELECT
    WebSessionId,
    IsDmSet
FROM WebSession
ORDER BY CreatedTimeStamp DESC
LIMIT 1
    ;`,
    createPlayer: `
INSERT INTO Player (WebSessionId, PlayerName, CharacterName, IsDm)
VALUES ($1, $2, $3, $4)
RETURNING PlayerId
    ;`,
    updatePlayer: `
UPDATE Player
SET
    WebSessionId = coalesce($2, P.WebSessionId),
    PlayerName = coalesce($3, P.PlayerName),
    CharacterName = coalesce($4, P.CharacterName),
    IsDm = coalesce($5, P.IsDm)
FROM Player P
WHERE PlayerId = $1
    ;`,
};
