(function constants() {
    if (!window.MovementTracker) {
        window.MovementTracker = {};
    }
    window.MovementTracker.UNITS_PER_TILE = 5;
    window.MovementTracker.DEFAULT_WALK_SPEED = 30;
    window.MovementTracker.SCRIPT_LOAD_TIMEOUT = 5000;

    window.MovementTracker.CONDITIONS = {
        down : "down",
        poisoned: "poisoned",
        frightened: "frightened",
        charmed: "charmed"
    };

    window.MovementTracker.TERRAIN_TYPES = {
        normal: {
            text : "Normal",
            colour : "rgba(0,0,0,0)",
            speeds: ["walk", "fly"]
        },
        climbable: {
            text: "Climbable",
            colour: "#DDAAAA",
            speeds: ["climb", "fly", "walk+1"]
        },
        swimable: {
            text: "Swimable",
            colour: "#0000FF",
            speeds: ["swim", "fly", "walk+1"]
        },
        impassable: {
            text: "Impassable",
            colour: "#000000",
            speeds: []
        }
    };

    window.MovementTracker.MOVEMENT_TYPES = {
        walk : {
            text : "WALK",
            factor: 1
        },
        swim: {
            text : "SWIM",
            factor: 0
        },
        climb: {
            text : "CLIMB",
            factor: 0
        },
        fly : {
            text : "FLY",
            factor: 0
        },
        burrow: {
            text : "DIG",
            factor: 0
        }
    };

    window.MovementTracker.MOB_SIZES = {
        tiny : { text: "Tiny", tiles: 1, rank : 1 },
        small : { text: "Small", tiles: 1, rank : 2 },
        medium: { text: "Medium", tiles: 1, rank: 3 },
        large : { text : "Large", tiles: 2, rank: 4 },
        huge : { text : "Huge", tiles: 3, rank: 5},
        colossal: { text: "Colossal", tiles: 4, rank: 6 }
    };
    
    window.MovementTracker.RACIAL_TRAITS = {
        human : { "walk" : 30 }
    };
})();
