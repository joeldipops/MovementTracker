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
    bool_or(P.WebSessionId IS NOT NULL) AS IsDmSet
FROM WebSession S
    LEFT OUTER JOIN (
        SELECT 
            WebSessionId 
        FROM Player
        WHERE PlayerType = 'dm'
    ) P
    ON P.WebSessionId = S.WebSessionId
GROUP BY S.WebSessionId, S.CreatedTimeStamp
ORDER BY S.CreatedTimeStamp DESC
LIMIT 1
    ;`,

    createPlayer: `
SELECT CreatePlayer($1, $2, $3, $4, $5) AS PlayerId;
    `,

    updatePlayer: `
SELECT UpdatePlayer($1, $2, $3, $4, $5) AS PlayerId;
    `,

    deletePlayer: `
DELETE FROM Player
WHERE PlayerId = $1
    ;`,
    
    getPlayers: `
SELECT 
    P.PlayerId,
    P.PlayerName,
    P.PlayerType,
    P.Colour,
    PC.CharacterName,    
    R.SizeCode AS Size
FROM Player P
    INNER JOIN PlayerCharacter PC
    ON PC.PlayerId = P.PlayerId
    
    INNER JOIN Race R
    ON R.RaceId = PC.RaceId
WHERE WebSessionId = $1
    AND ($2 IS NULL OR PlayerType = $2)
    ;`
};
