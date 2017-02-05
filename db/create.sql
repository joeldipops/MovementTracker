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
    
CREATE TABLE WebSession (
    WebSessionId serial NOT NULL,
    CreatedTimeStamp timestamp WITHOUT TIME ZONE NOT NULL
        CONSTRAINT DF_WebSession_CreatedTimeStamp
        DEFAULT (now() AT TIME ZONE 'utc'),
        
    CONSTRAINT PK_WebSession PRIMARY KEY (WebSessionId)
);

CREATE TABLE Player (
    PlayerId serial NOT NULL,
    WebSessionId integer NOT NULL,
    PlayerName text NOT NULL,
    CharacterName text NULL,
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
    
