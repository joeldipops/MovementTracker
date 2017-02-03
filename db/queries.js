module.exports = {

    createSession : `
INSERT INTO WebSession
VALUES (DEFAULT)
RETURNING WebSessionId
    ;`,

    deleteSession: `
DELETE FROM WebSession
WHERE WebSessionId = $1
    ;`,

    getCurrentSession: `
SELECT
    S.WebSessionId,
    bool_or(P.IsDm)
FROM WebSession S
    LEFT OUTER JOIN Player P
    ON P.WebSessionId = S.WebSessionId
GROUP BY S.WebSessionId, S.CreatedTimeStamp
ORDER BY S.CreatedTimeStamp DESC
LIMIT 1
    ;`,

    createPlayer: `
INSERT INTO Player (WebSessionId, PlayerName, CharacterName, IsDm)
VALUES ($1, $2, $3, $4)
RETURNING PlayerId
    ;`,

    updatePlayer: `
UPDATE Player Pl
SET
    WebSessionId = coalesce($2, P.WebSessionId),
    PlayerName = coalesce($3, P.PlayerName),
    CharacterName = coalesce($4, P.CharacterName),
    IsDm = coalesce($5, P.IsDm)
FROM Player P
WHERE Pl.PlayerId = $1
RETURNING Pl.PlayerId
    ;`,

    deletePlayer: `
DELETE FROM Player
WHERE PlayerId = $1
    ;`,
    
    getPlayers: `
SELECT 
    PlayerId,
    PlayerName,
    CharacterName,
    IsDm
FROM Player
WHERE WebSessionId = $1
    AND ($2 IS NULL OR IsDm = $2)
    ;`
};
