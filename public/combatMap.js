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
        var x, y,
            newTr, newTd, button;
            
        _mapEL = _mapEl || document.getElementById("map");
    
        while(_mapEL.nextChild) {
            _mapEL.removeChild(_mapEL.nextChild);
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
                        newTd.innerHTML = x;
                    }
                    if (y !== 0) {
                        newTd.setAttribute("scope", "row");
                        newTd.innerHTML = y;
                    }
                    newTr.appendChild(newTd);                    
                } else {
                    // Main cells.
                    newTr.insertAdjacentHTML("beforeend", template);
                    button = newTr.lastElementChild.querySelector("button");
                    button.setAttribute("data-x", x);
                    button.setAttribute("data-y", y);
                    button.setAttribute("data-type", "normal");
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
     * @param {object} mob data describing the mob.
     */
    pageContext.setMob = function(x, y, mob) {
         if (!_mobs[x]) {
             _mobs[x] = {};
         }
         if (!_mobs[x][y]) {
             _mobs[x][y] = [];
         }
         
         mob.x = x;
         mob.y = y;
         _mobs[x][y].push(mob);
         _mobIndex[mob.id] = { x : x, y : y };
    };
    
    /**
     * Remove record of a mob from the cache.
     */
    pageContext.removeMob = function(mob) {
        var array, i;
        
        if (!(mob.x && mob.y)) {
            mob = pageContext.getMobWithId(mob.id);
        }
        delete _mobIndex[mob.id];
        if (!mob || !(mob.x && mob.y)) {
            return;
        }

        array = pageContext.getMobs(mob.x, mob.y);
        for (i = 0; i < array.length; i++) {
            if (isSameMob(array[i], mob)) {
               break;
            }
        }
        array.splice(i, 1);
    }
})();
