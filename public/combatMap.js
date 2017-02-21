(function combatMapScript() {
    var _mapEvents, _mapEl, _mobs, _mobIndex, isIdEqual;

    _mapEvents = [];
    _mapEl = document.getElementById("map");
    _mobs = {};
    _mobIndex = {};

    /**
     * Compares mobs by id..
     * @param {object} first mob to compare.
     * @param {object} second mob to compare.
     * @returns {boolean} true if same id, false otherwise.
     */
    isSameMob = function(first, second) {
        if (!first || !second) {
            return false;
        }

        return first.id.toString() === second.id.toString();
    }

    /**
     * Renders a grid according to data, setting each td as the html in template.
     * @param {object} data contains the width and height of the map.
     * @param {string} template a html template.
     */
    pageContext.renderMap = function(data, template) {
        var x, y, key, i,
            newTr, newTd, button;
            
        _mapEL = _mapEl || document.getElementById("map");
    
        while(_mapEL.firstChild) {
            _mapEL.removeChild(_mapEL.firstChild);
        }

        _mapEl.setAttribute("data-width", data.width);
        _mapEl.setAttribute("data-height", data.height);

        for(y = 0; y < data.height + 1; y++) {
            newTr = document.createElement("tr");
            _mapEL.appendChild(newTr);
            for (x = 0; x < data.width + 1; x++) {
                if (y === 0 || x === 0) {
                   // Numbered headings along the top and left.
                    newTd = document.createElement("th");
                    if (x !== 0) {
                        newTd.setAttribute("scope", "column");
                        newTd.innerHTML = x * UNITS_PER_TILE;
                    }
                    if (y !== 0) {
                        newTd.setAttribute("scope", "row");
                        newTd.innerHTML = y * UNITS_PER_TILE;
                    }
                    newTr.appendChild(newTd);
                } else {
                    // Main cells.
                    newTr.insertAdjacentHTML("beforeend", template);
                    button = newTr.lastElementChild.querySelector(".terrain");
                    button.setAttribute("data-x", x);
                    button.setAttribute("data-y", y);

                    key = x + "," + y;

                    // Set any abnormal terrain on this cell.
                    if (data.terrains && data.terrains[key]) {
                        pageContext.setTerrain(x, y, data.terrains[key].type);
                    } else {
                        button.setAttribute("data-type", "normal");
                    }

                    // Place any mobs on this cell.
                    if (data.mobs && data.mobs[key]) {
                        for (i = 0; i < data.mobs[key].length; i++) {
                            pageContext.setMob(x, y, data.mobs[key][i]);
                        }
                    }
                }
            }
        }
    };

    /**
     * Selects the td element at the given co-ordinates.
     * @param {number} x horizontal co-ordinate.
     * @param {number} y vertical co-ordinate.
     * @returns {HTMLElement} the tr.
     */
    pageContext.getCell = function(x, y) {
        return _mapEl.querySelector("[data-x='{x}'][data-y='{y}']".replace("{x}", x).replace("{y}", y));
    };

    /**
     * Highlights a mob on their turn.
     * @param {string} id of the mob.
     */
    pageContext.setTurn = function(id) {
        var hasTurn;
        // End the previous turn.
        if (hasTurn = _mapEl.querySelector(".hasTurn")) {
            hasTurn.classList.remove("hasTurn");
        }
        if (hasTurn = _mapEl.querySelector("[data-id='" + id + "']")) {
            hasTurn.classList.add("hasTurn");
        }
    };

    /**
     * Adds an event in the context of the combat map that can be unbound easily.
     * @param {string} selector querySelectorAll parameter.
     * @param {string} event name of the event.
     * @param {function} handler event handler function.
     */
    pageContext.onMapEvent = function(selector, event, handler) {
        var target, i;
        target = _mapEl.querySelectorAll(selector);
        if (!target || !target.length) {
            return false;
        }

        // Ensure these will also get cleaned up on page change.
        for (i = 0; i < target.length; i++) {
            onEvent(target[i], event, handler);
            _mapEvents.push(target[i].removeEventListener.bind(target[i], event, handler));
        }
    };

    /**
     * Removes all events bound with onMapEvent.
     */
    pageContext.removeMapEvents = function() {
       var i;
       for(i = 0; i < _mapEvents.length; i++) {
           _mapEvents[i]();
       }
    };

    pageContext.terrainTypes = {
        normal: { text : "Normal", colour : "rgba(0,0,0,0)" },
        difficult : {text : "Difficult", colour : "#CCCCCC" },
        climbable: { text: "Climbable", colour: "#DDAAAA" },
        swimable: { text: "Swimable", colour: "#0000FF" },
        impassable: { text: "Impassable", colour: "#000000" }
    };

    pageContext.movementTypes = {
        walk : { text : "WALK", passableTerrain : ["normal, difficult, climbable"] },
        swim: { text : "SWIM", passableTerrain : ["swimable"] },
        fly : { text : "FLY", passableTerrain : ["normal, difficult, climable, swimmable"] }
    };

    // Not authoritative sizes.
    pageContext.mobSizes = {
        tiny : { text: "Tiny", tiles: 1, rank : 1 },
        small : { text: "Small", tiles: 1, rank : 2 },
        medium: { text: "Medium", tiles: 1, rank: 3 },
        large : { text : "Large", tiles: 1, rank: 4 },
        huge : { text : "Huge", tiles: 1, rank: 5},
        colossal: { text: "Colossal", tiles: 1, rank: 6 }
    };

    /**
     * Gets mobs partially or fully in a given cell.
     * @param {number} x co-ordinate of the cell.
     * @param {number} y co-ordinate of the cell.
     * @returns {object} The mob, if it exists.
     */
    pageContext.getMob = function(x, y) {
        if (_mobs[x]) {
            return _mobs[x][y];
        }
        return null;
    };

    /**
     * Gets mob on the map with a given id.
     * @param {number} id of the mob.
     * @returns {object} The mob.
     */
    pageContext.getMobWithId = function(id) {
        var i, array;

        if (!_mobIndex[id]) {
            return null;
        }

        array = pageContext.getMob(_mobIndex[id].x, _mobIndex[id].y);
        for (i = 0; i < array.length; i++) {
            if (isSameMob(array[i], { id : id})) {
                return array[i];
            }
        }
    };

    /**
     * Sets a mob as part of a given cell.
     * @param {number} x co-ordinate of the cell.
     * @param {number} y co-ordinate of the cell.
     * @param {object} data describing the mob.
     */
    pageContext.setMob = function(x, y, data) {
        var el;
        if (!data || !data.id) {
            return;
        }
        if (!_mobs[x]) {
            _mobs[x] = {};
        }
        if (!_mobs[x][y]) {
            _mobs[x][y] = [];
        }

        data.x = x;
        data.y = y;
        _mobs[x][y].push(data);
        _mobIndex[data.id] = { x : x, y : y };

        el = document.createElement("div");
        el.classList.add("mob");
        el.setAttribute("data-id", data.id);
        el.setAttribute("title", data.character_name);
        el.innerHTML = data.character_name[0];
        el.style.backgroundColor = data.colour || "#EEEEEE";
        container = pageContext.getCell(x, y);
        container.parentNode.appendChild(el);
    };

    /**
     * Updates a terrain on the map.
     * @param {number} x co-ordinate of the terrain.
     * @param {number} y co-ordinate of the terrain.
     * @param {string} type type-code of the terrain.
     */
    pageContext.setTerrain = function(x, y, type) {
        var el = pageContext.getCell(x, y);
        el.setAttribute("data-type", type);
        el.style.backgroundColor = pageContext.terrainTypes[type].colour;
    };

    /**
     * Removes a mob from the map
     */
    pageContext.removeMob = function(data) {
        var cell, mobEl, array, i;
        if (!data || !data.id) {
            return;
        }
        if (!(data.x && data.y)) {
            data = pageContext.getMobWithId(data.id);
        }
        if (!data || !(data.x && data.y)) {
            return;
        }
        delete _mobIndex[data.id];
        array = pageContext.getMob(data.x, data.y);
        for (i = 0; i < array.length; i++) {
            if (isSameMob(array[i], data)) {
                break;
            }
        }
        array.splice(i, 1);

        cell = pageContext.getCell(data.x, data.y);
        mobEl = cell.parentElement.querySelector(".mob[data-id='" + data.id + "']");
        if (mobEl) {
            mobEl.parentNode.removeChild(mobEl);
        }
    };
    
    /**
     * Ensures no element on the map has the given class.
     * @param {string} name of class to remove.
     */
    pageContext.removeClass = function(name) {
        var i, list;
        list = _mapEl.getElementsByClassName(name);
        for (i = 0; i < list.length; i++) {
            list[i].classList.remove(name);
        }
    };

    /**
     * Gets the width and height of the map.
     * @returns {object} with width and height properties.
     */
    pageContext.getSize = function() {
        return {
            height: parseInt(_mapEl.getAttribute("data-height")),
            width: parseInt(_mapEl.getAttribute("data-width"))
        };
    };

    /**
     * Converts map to a transmittable object.
     * @returns {object} The map as a json object.
     */
    pageContext.mapToJSON = function() {
        var result, k, i, x, y, key,
            width, height, terrains, mob;
        width = parseInt(_mapEl.getAttribute("data-width"));
        height = parseInt(_mapEl.getAttribute("data-height"));
        result = {
            width: width,
            height: height
        };

        // Find all the abnormal terrains.
        terrains = _mapEl.querySelectorAll(".terrain[data-x]:not([data-type='normal'])");
        result.terrains = {};
        for (i = 0; i < terrains.length; i++) {
            x = terrains[i].getAttribute("data-x");
            y = terrains[i].getAttribute("data-y");
            result.terrains[x + "," + y] = {
                type : terrains[i].getAttribute("data-type"),
                x : x,
                y: y
            };
        }

        //Find all the mobs.
        result.mobs = {};
        for (k in _mobIndex) {
            if (!_mobIndex.hasOwnProperty(k)) {
                continue;
            }
            key = _mobIndex[k].x + "," + _mobIndex[k].y;
            if (!result.mobs[key]) {
                result.mobs[key] = [];
            }

            result.mobs[key].push(pageContext.getMobWithId(k));
        }

        return result;
    };
})();
