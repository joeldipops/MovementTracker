-- Destroy all connections (Extremely satifying)
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE datname = 'DungeonsAndDragons'
  AND pid <> pg_backend_pid();

DO
$$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_user
        WHERE usename = 'dungeonsanddragonsapp'
    )
    THEN
        DROP OWNED BY DungeonsAndDragonsApp;
    END IF;
END
$$;

DROP DATABASE IF EXISTS DungeonsAndDragons;
DROP ROLE IF EXISTS DungeonsAndDragonsApp;

CREATE ROLE DungeonsAndDragonsApp
    WITH LOGIN
    PASSWORD '_';

CREATE DATABASE DungeonsAndDragons
    WITH OWNER DungeonsAndDragonsApp;

-- Has to be lowercase for some reason.
\c dungeonsanddragons

ALTER DEFAULT PRIVILEGES
    IN SCHEMA public
    GRANT ALL ON TABLES
    TO DungeonsAndDragonsApp;
ALTER DEFAULT PRIVILEGES
    IN SCHEMA public
    GRANT ALL ON SEQUENCES
    TO DungeonsAndDragonsApp;
ALTER DEFAULT PRIVILEGES
    IN SCHEMA public
    GRANT ALL ON FUNCTIONS
    TO DungeonsAndDragonsApp;

CREATE TYPE playerType
    AS ENUM ('player', 'dm', 'spectator');

CREATE TYPE creatureSize
    AS ENUM ('tiny', 'small', 'medium', 'large', 'huge', 'colossal');


CREATE TABLE WebSession (
    WebSessionId serial NOT NULL,
    CreatedTimeStamp timestamp WITHOUT TIME ZONE NOT NULL
        CONSTRAINT DF_WebSession_CreatedTimeStamp
        DEFAULT (now() AT TIME ZONE 'utc'),

    CONSTRAINT PK_WebSession PRIMARY KEY (WebSessionId)
);

CREATE TABLE Map (
    MapId serial NOT NULL,
    Name text NOT NULL,
    Data text NOT NULL,

    CONSTRAINT PK_Map PRIMARY KEY (MapId)
);

CREATE TABLE Race (
    RaceId serial NOT NULL,
    Name text NOT NULL,
    Code text NOT NULL,
    SizeCode creatureSize NOT NULL
        CONSTRAINT DF_Race_SizeCode
        DEFAULT ('medium'),
    
    CONSTRAINT PK_Race PRIMARY KEY (RaceId)
);

CREATE TABLE Player (
    PlayerId serial NOT NULL,
    WebSessionId integer NOT NULL,
    SocketId integer NOT NULL,
    PlayerName text NOT NULL,
    PlayerType playerType NOT NULL
        CONSTRAINT DF_Player_IsDm
        DEFAULT ('player'),
    Colour text NULL
        CONSTRAINT CK_Player_Colour
        CHECK ((PlayerType = 'player' AND Colour IS NOT NULL) OR PlayerType <> 'player'),

    CONSTRAINT PK_Player PRIMARY KEY (PlayerId),
    CONSTRAINT FK_Player_WebSession
        FOREIGN KEY (WebSessionId)
        REFERENCES WebSession (WebSessionId)
        ON DELETE CASCADE
);

CREATE TABLE PlayerCharacter (
    CharacterId serial NOT NULL,
    PlayerId integer NOT NULL,
    RaceId integer NOT NULL,
    CharacterName text NULL,
    Speed integer NOT NULL
        CONSTRAINT DF_PlayerCharacter_Speed
        DEFAULT (0),

    CONSTRAINT PK_PlayerCharacter PRIMARY KEY (CharacterId),
    CONSTRAINT FK_PlayerCharacter_Player
        FOREIGN KEY (PlayerId)
        REFERENCES Player (PlayerId)
        ON DELETE CASCADE,
        
    CONSTRAINT FK_PlayerCharacter_Race
        FOREIGN KEY (RaceId)
        REFERENCES Race (RaceId)
);

INSERT INTO Race (Name, Code)
VALUES ('Human', 'human');

CREATE FUNCTION CreatePlayer(
    SessionId integer,
    SocketId integer,
    PlayerName text,
    CharacterName text,
    PlayerType playerType,
    Colour text,
    Speed integer
)
    RETURNS integer AS
$BODY$
    DECLARE
        _playerId integer;
BEGIN
    INSERT INTO Player (WebSessionId, SocketId, PlayerName, PlayerType, Colour)
    VALUES (SessionId, SocketId, PlayerName, PlayerType, Colour)
    RETURNING PlayerId INTO _playerId;

    -- If it's a player, add character record too.
    IF PlayerType = 'player'
    THEN
        INSERT INTO PlayerCharacter(PlayerId, RaceId, CharacterName, Speed)
        SELECT
            _playerId,
            RaceId,
            CharacterName,
            Speed
        FROM Race
        WHERE Code = 'human';
    END IF;

    RETURN _playerId;
END;
$BODY$ LANGUAGE plpgsql;

CREATE FUNCTION UpdatePlayer(
    PlayerId integer,
    SessionId integer,
    SocketId integer,
    PlayerName text,
    PlayerType playerType,
    Colour text,
    Speed integer
)
    RETURNS integer AS
$BODY$
BEGIN
    UPDATE Player Pl
    SET
        WebSessionId = coalesce(SessionId, P.WebSessionId),
        PlayerName = coalesce(PlayerName, P.PlayerName),
        PlayerType = coalesce(PlayerType, P.PlayerType),
        Colour = coalesce(Colour, P.Colour)
    FROM Player P
    WHERE Pl.PlayerId = PlayerId;

    IF PlayerType = 'player'
    THEN
        UPDATE PlayerCharacter PC
        SET
            CharacterName = coalesce(CharacterName, P.CharacterName),
            Speed = coalesce(Speed, P.Speed)
        FROM PlayerCharacter P
        WHERE P.PlayerId = PlayerId;
    END IF;

    RETURN PlayerId;
END;
$BODY$ LANGUAGE plpgsql;
