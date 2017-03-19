(function constants() {
    if (!window.MovementTracker) {
        window.MovementTracker = {};
    }
    window.MovementTracker.UNITS_PER_TILE = 5;

    window.MovementTracker.TERRAIN_TYPES = {
        normal: {
            text : "Normal",
            colour : "rgba(0,0,0,0)",
            speeds: ["fly", "walk"]
        },
        difficult : {
            text : "Difficult",
            colour : "#CCCCCC",
            speeds: ["fly","walk|2"]
        },
        climbable: {
            text: "Climbable",
            colour: "#DDAAAA",
            speeds: ["fly", "climb", "walk|2"]
        },
        swimable: {
            text: "Swimable",
            colour: "#0000FF",
            speeds: ["fly", "swim", "walk|2"]
        },
        impassable: {
            text: "Impassable",
            colour: "#000000",
        }
    };

    window.MovementTracker.MOVEMENT_TYPES = {
        walk : {
            text : "WALK",
            factor: 1
        },
        swim: {
            text : "SWIM",
            factor: 0.5
        },
        climb: {
            text : "CLIMB",
            factor: 0.5
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
        large : { text : "Large", tiles: 1, rank: 4 },
        huge : { text : "Huge", tiles: 1, rank: 5},
        colossal: { text: "Colossal", tiles: 1, rank: 6 }
    };
    
    window.MovementTracker.RACIAL_TRAITS = {
        human : { "walk" : 30 }
    };
})();
