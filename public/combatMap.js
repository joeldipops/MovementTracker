(function combatMapScript() {
    var _mapEvents, _mapEl, _mobs, _mobIndex,
        isSameMob, toggleConditions, getTerrainsJson, getMobsJson;

    _mapEl = document.getElementById("map");
    _mapEvents = [];
    _mobs = {};
    _mobIndex = {};

    // Prevent annoying zooming
    onEvent(_mapEl, "touchstart", function() {
        var el = document.head.querySelector("meta[name='viewport']");
        el.setAttribute("content", "user-scalable=0");
    });

    onEvent(_mapEl, "touchend", function() {
        setTimeout(function() {
            var el = document.head.querySelector("meta[name='viewport']");
            el.setAttribute("content", "user-scalable=1");
        }, 2000);
    });

    /**
     * Converts the terrains on the map into a format that can be consumed as json.
     * @returns {object} the hash of terrains.
     */
    getTerrainsJson = function() {
        var terrains, result;
        terrains = _mapEl.querySelectorAll(".terrain[data-x]:not([data-type='normal'])");
        result = {};
        for (i = 0; i < terrains.length; i++) {
            x = terrains[i].getAttribute("data-x");
            y = terrains[i].getAttribute("data-y");
            result[x + "," + y] = {
                type : terrains[i].getAttribute("data-type"),
                x : x,
                y: y
            };
        }

        return result;
    };
    
    /**
     * Converts the mobs on the map into a format that can be consumed as json.
     * @returns {object} the hash of mobs.
     */
    getMobsJson = function() {
        var result = {};
        for (k in _mobIndex) {
            if (!_mobIndex.hasOwnProperty(k)) {
                continue;
            }
            key = _mobIndex[k].x + "," + _mobIndex[k].y;
            if (!result[key]) {
                result[key] = [];
            }

            result[key].push(pageContext.getMobWithId(k));
        }
        return result;
    };

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
    };

    /**
     * Displays a mob as having the given conditions or removes them.
     * @param {string} id Identifies the mob.
     * @param {string|array of string} conditions lists all the conditions to add or remove.
     * @param {boolean} isToAdd true to add the conditions, false to remove them.
     */
    toggleConditions = function(id, conditions, isToAdd) {
        var i, fnName;
        el = _mapEl.querySelector("[data-id='" + id + "']");
        if (!el) {
            return;
        }

        if (typeof conditions === "string") {
            conditions = [conditions];
        }

        fnName = isToAdd ? "add" : "remove";

        for (i = 0; i < conditions.length; i++) {
            switch(conditions[i]) {
                case MovementTracker.CONDITIONS.down:
                    el.classList[fnName]("down");
                    break;
                defaults:
                    break;
            }
        }
    };

    /**
     * Renders the map, but moves any mobs and deletes any terrains that no longer fit
     */
    pageContext.resizeMap = function(data, template) {
        var k, oldHeight, oldWidth, mob, mobsData, offset, isOffMap, key;

        if (!(isNatural(data.width)) && isNatural(data.height)) {
            return ;
        }

        oldHeight = parseInt(_mapEl.getAttribute("data-height")) || 0;
        oldWidth = parseInt(_mapEl.getAttribute("data-width")) || 0;

        mobsData = getMobsJson();

        if (data.width < oldWidth || data.height < oldHeight) {
            // see if any mobs have fallen off the edge of the map, and squeeze them back on.
            for (k in _mobIndex) {
                if (!_mobIndex.hasOwnProperty(k)) {
                    continue;
                }

                mob = pageContext.getMobWithId(k);
                offset = MovementTracker.MOB_SIZES[mob.size] ? MovementTracker.MOB_SIZES[mob.size].tiles - 1 : 0;

                if (mob.x + offset > data.width) {
                    isOffMap = true;
                    mob.x = Math.max(data.width - offset, 0);
                }
                if (mob.y + offset > data.height) {
                    isOffMap = true;
                    mob.y = Math.max(data.height - offset, 0);
                }

                if (isOffMap) {
                    key = mob.x + "," + mob.y;
                    mobsData[key] = mobsData[key] || [];
                    mobsData[key].push(mob);
                    isOffMap = false;
                }
            }
        }

        data.mobs = mobsData;
        data.terrains = getTerrainsJson();

        return pageContext.renderMap(data, template);
    };

    /**
     * Renders a grid according to data, setting each td as the html in template.
     * @param {object} data contains the width and height of the map.
     * @param {string} template a html template.
     */
    pageContext.renderMap = function(data, template) {
        var x, y, key, i,
            newTr, newTd, button;

        // Reset since it's a fresh render..
        _mobs = {};
        _mobIndex = {};

        _mapEl = _mapEl || document.getElementById("map");
    
        while(_mapEl.firstChild) {
            _mapEl.removeChild(_mapEl.firstChild);
        }

        _mapEl.setAttribute("data-width", data.width);
        _mapEl.setAttribute("data-height", data.height);

        for(y = 0; y < data.height + 1; y++) {
            newTr = document.createElement("tr");
            _mapEl.appendChild(newTr);
            for (x = 0; x < data.width + 1; x++) {
                if (y === 0 || x === 0) {
                   // Numbered headings along the top and left.
                    newTd = document.createElement("th");
                    if (x !== 0) {
                        newTd.setAttribute("scope", "column");
                        newTd.innerHTML = x * MovementTracker.UNITS_PER_TILE;
                    }
                    if (y !== 0) {
                        newTd.setAttribute("scope", "row");
                        newTd.innerHTML = y * MovementTracker.UNITS_PER_TILE;
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
     * @param {string} namespace Allows events to be unbound as a group.
     */
    pageContext.onMapEvent = function(selector, event, handler, namespace) {
        var target, i;
        target = _mapEl.querySelectorAll(selector);
        if (!target || !target.length) {
            return false;
        }

        // Ensure these will also get cleaned up on page change.
        for (i = 0; i < target.length; i++) {
            onEvent(target[i], event, handler, namespace);
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
        _mapEvents = [];
    };

    /**
     * Gets mobs partially or fully in a given cell.
     * @param {number} x co-ordinate of the cell.
     * @param {number} y co-ordinate of the cell.
     * @returns {object} The mob, if it exists.
     */
    pageContext.getMob = function(x, y) {
        if (_mobs[x]) {
            return _mobs[x][y] || [];
        }
        return [];
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
        if (isEqual(data.id, window.playerId)) {
            el.classList.add("isMyPc");
        }
        el.setAttribute("data-id", data.id);
        el.setAttribute("title", data.character_name);
        el.innerHTML = (data.character_name || "?")[0];
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
        el.style.backgroundColor = MovementTracker.TERRAIN_TYPES[type].colour;
    };

    /**
     * Sets the mob to be displayed with the given condition/s.
     * @param {string} id Identifies the mob.
     * @param {string|array of string} conditions The conditions the mob should have.
     */
    pageContext.addCondition = function(id, conditions) {
        toggleConditions(id, conditions, true);
    };

    /**
     * Sets the mob to no longer be displayed with the given condition/s.
     * @param {string} id Identifies the mob.
     * @param {string|array of string} conditions The conditions the mob should not have.
     */
    pageContext.removeCondition = function(id, conditions) {
        toggleConditions(id, conditions, false);
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
        result.terrains = getTerrainsJson();

        //Find all the mobs.
        result.mobs = getMobsJson();

        return result;
    };
})();
