(function combatMapScript() {
    var _mapEvents, _mapEl;
    

    _mapEvents = [];
    _mapEl = document.getElementById("map");    

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
        difficult : {text : "Difficult", colour : "#DDDDDD" },
        climbable: { text: "Climbable", colour: "#DDAAAA" },
        swimable: { text: "Swimable", colour: "#0000FF" },
        impassable: { text: "Impassable", colour: "#000000" }
    };
})();
