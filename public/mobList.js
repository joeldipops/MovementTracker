registerInterface(function mobListScript() {
    var public, onReceiveMessage, onClose, bindInputEvents,
        addMob, removeMob, addDM, removeDM, startNextTurn, getNext, liToData,
        _template, _listEl, _subscribers, _events, _orderIndex, _eventIndex;

    public = {};

    _listEl = document.querySelector("#social .initiativeList");
    _subscribers = {};
    _events = [];
    _eventIndex = {};
    _orderIndex = 1;

    _template = document.querySelector("#template-initiativeListItem").innerHTML;

    /**
     * Cleans up bound events.
     */
    onClose = function() {
        window.socket.removeEventListener("message", onReceiveMessage);
        _subscribers = {};
        _eventIndex = {};
        for (i = 0; i < _events.length; i++) {
            _events[i]();
        }
        _events = [];
    };

    /**
     * Ensures click etc events will fire for each item in the list.
     * @param {HTMLElement} The list item with buttons to bind.
     * @param {string} namespace Optional id to namespace events, so they can be cleaned up without affecting other events.
     */
     bindInputEvents = function(li, id) {
         var buttons, handler, i;
         buttons = li.querySelectorAll("button");
         handler = fireEvent.bind({}, li);

         // Unbind existing events for this id
         if (id && _eventIndex[id]) {
            for (i = 0; i < _eventIndex[id].length; i++) {
                _events[_eventIndex[id][i]]();
            }
             delete _eventIndex[id];
         }

         // Bind new events, add them to the index, and add the unbinder to be cleaned up later.
         for (i = 0; i < buttons.length; i++) {
             buttons[i].addEventListener("click", handler);
             if (id) {
                _eventIndex[id] = _eventIndex[id] || [];
                _eventIndex[id].push(_events.length);
             }
             _events.push(buttons[i].removeEventListener.bind(buttons[i], "click", handler));
         }
     };

    /**
     * Extracts all the data about a mob stored as data-atrributes on the list item.
     * @param {HTMLElement} li The list item.
     * @returns {object} The data as an object.
     */
    liToData = function(li) {
        var k, result;
        result = {};
        result = {};
        result.id = li.getAttribute("data-id");
        result.size = li.getAttribute("data-size");
        result.mob_type = li.getAttribute("data-mobType");
        result.colour = li.style.color;
        result.character_name = li.querySelector(".mobName").innerHTML;
        result.potential = parseInt(li.getAttribute("data-potential"));
        if (li.hasAttribute("data-initiative")) {
            result.initiative = parseInt(li.getAttribute("data-initiative"));
        }

        result.order = parseInt(li.getAttribute("data-order"));
        result.speed = {};

        for (k in MovementTracker.MOVEMENT_TYPES) {
            if (!MovementTracker.MOVEMENT_TYPES.hasOwnProperty(k)) {
                continue;
            }
            result.speed[k] = parseInt(li.getAttribute("data-{type}".replace("{type}", k)));
        }
        return result;
    };

    /**
     * Calls subscribing callbacks.
     * @param {HTMLElement} li parentNode of the clicked element.
     * @param {DOMElement} event that occured.
     */
    fireEvent = function(li, event) {
        var name, data, i;
        if (typeof event === "string") {
            name = event;
        } else {
            name = event.currentTarget.getAttribute("name");
        }
        if (_subscribers[name] && _subscribers[name].length) {
            data = liToData(li);
            for (i = 0; i < _subscribers[name].length; i++) {
                _subscribers[name][i](data);
            }
        }
     };

    /**
     * Handles messages received through the web socket.
     * @param {object} event that occured.
     */
    onReceiveMessage = function(event) {
        var data, el;
        data = JSON.parse(event.data);
        if (data["player_add"]) {
            addMob(data["player_add"]);
        }
        if (data["player_update"]) {
            addMob(data["player_update"], { isUpdate : true });
        }
        if (data["player_remove"]) {
            removeMob(data["player_remove"]);
        }
        if (data["dm_add"]) {
            addDM(data["dm_add"]); 
        }
        if (data["dm_remove"]) {
            removeDM();
        }
        if (data["session_id"]) {
            refreshList();
        }
        if (data["turn_start"]) {
            startNextTurn(data["turn_start"]);
        }
        if (data["session_end"]) {
            // Kaboom
            window.location.reload();
        }
    };

    /**
     * Sets the name of the DM in the display.
     * @param {object} data describing dm.
     */
    addDM = function(data) {
        var el = document.querySelector("#social > h2");
        el.innerHTML = "DM is " + data.player_name;
    };

    /**
     * Reverts the dm display if they leave.
     */
    removeDM = function(data) {
        var el = document.querySelector("#social > h2");
        el.innerHTML = "Waiting for DM";
    };

    /**
     * Removes a mob from the list.
     * @param {object} data describes the mob.
     */
    removeMob = function(data, fromCombat) {
        var li, id;
        fromCombat = fromCombat || data.from_combat;
        id = isNaN(data.player_id) ? data.id : data.player_id;
        li = _listEl.querySelector("li[data-id='" + id + "']");
        if (!li) {
            return;
        }
        if (fromCombat) {
            // DM will keep players in list unless forced.
            // But should still ignore them when calculating next player.
            if (li.hasAttribute("data-initiative")) {
                li.removeAttribute("data-initiative");
            }
        } else {
            li.parentElement.removeChild(li);
        }
    };

    /**
     * Removes all mobs from the list.
     */
    removeAll = function() {
        while (_listEl.firstChild) {
            _listEl.removeChild(_listEl.firstChild);
        }
        _orderIndex = 1;
    };

    /**
     * Adds a mob to the list, by correct sort order.
     * @param {object} data describing the player
     * @param {object} flags consiting of
     ** {boolean} isUpdate true if updating a player already in the list.
     ** {boolean} isTurn true if it's this players turn.
     ** {boolean} isInCombat true if the player is located on the map.
     */
    addMob = function(data, flags) {
        var list, li, otherLi, fragment,
            inserted, i, extant, init, potentialInit;
        flags = flags || {};

        potentialInit = data.initiative || data.potential;

        if (!isNaN(data.player_id)) {
            data.id = data.player_id
        }
        // Don't add same player more than once.
        li = _listEl.querySelector("li[data-id='" + data.id + "']");
        if (!li) {
            // probably would be faster to manipulate the template than the element...
            fragment = document.createDocumentFragment();
            fragment.appendChild(document.createElement("span"));
            fragment.firstElementChild.insertAdjacentHTML("beforeend", _template);
            li = fragment.firstElementChild.firstElementChild;
        } else if (!flags.isUpdate) {
            // Just update the initiative and get out.
            if (flags.isInCombat && !li.hasAttribute("data-initiative")) {
                li.setAttribute("data-initiative", potentialInit);
            }
            return;
        } else {
            inserted = true;
        }

        li.setAttribute("data-id", data.id);
        li.setAttribute("data-mobType", data.mob_type || (isNaN(data.player_id) ? "npc" : "pc"));

        if (data.speed) {
            for (i in data.speed) {
                if (!data.speed.hasOwnProperty(i)) {
                    continue;
                }
                li.setAttribute("data-" + i, data.speed[i]);
            }
        }
        if (data.colour) { li.style.color = "#" + data.colour; }
        if (data.size) { li.setAttribute("data-size", data.size); }
        if (data.character_name) { li.querySelector(".mobName").innerHTML = data.character_name; }
        if (isEqual(window.playerId, data.id)) {
            li.setAttribute("data-isMyPc", "isMyPc");
        } else {
            li.removeAttribute("data-isMyPc");
        }

        // Add mobs in initiative order.
        if (!isNaN(potentialInit)) {
            inserted = false;
            li.parentNode.removeChild(li);
            li.querySelector(".initiativeScore").innerHTML = potentialInit;
            li.setAttribute("data-potential", potentialInit);
            if (flags.isInCombat) {
                li.setAttribute("data-initiative", potentialInit);
            }

            if (!data.order) {
                data.order = _orderIndex;
                _orderIndex++;
            }
            li.setAttribute("data-order", data.order);

            extant = _listEl.querySelectorAll("li.mob");
            for (i = 0; i < extant.length; i++) {
                init = parseInt(extant[i].getAttribute("data-potential"));
                if (potentialInit > init) {
                    _listEl.insertBefore(li, extant[i]);
                    inserted = true;
                    break;
                } else if (potentialInit === init) {
                    // If same initiative, use the order property.
                    init = extant[i].getAttribute("data-order");
                    if (data.order < init) {
                        _listEl.insertBefore(li, extant[i]);
                        inserted = true;
                        break;
                    }
                }
            }
        }

        // If initiative not set, just append to the end.
        if (!inserted) {
            _listEl.appendChild(li);
        }

        if (flags.isTurn) {
            otherLi = _listEl.querySelector(".currentTurn");
            if (otherLi) {
                otherLi.classList.remove("currentTurn");
            }
            li.classList.add("currentTurn");
        }
        bindInputEvents(li, data.id);
    };

    /**
     * Clears the list of names and gets a fresh list from the server.
     */
    refreshList = function() {
        return sendHttpRequest("session/" + window.sessionId + "/players", "GET", null, { isPersistent : true })
        .then(function(result){
            var i, players;
            result = JSON.parse(result.responseText);
            if (!result || !result.players) {
                throw "No players";
            }

            removeAll();

            players = result.players;
            for (i = 0; i < players.length; i++) {
                switch (players[i].player_type) {
                    case "dm": addDM(players[i]); break;
                    case "player": addMob(players[i]); break;
                    default: break;
                }
            }
        })
        .catch(function(err) {
            console.error(JSON.stringify(err));
        });
    };
    
    /**
     * Sets the display for the next turn of combat.
     */
    startNextTurn = function(data) {
        var li = _listEl.querySelector(".currentTurn");
        if (li) {
            li.classList.remove("currentTurn");
        }
        li = _listEl.querySelector("[data-id='" + data.id + "']");
        li.classList.add("currentTurn");
        fireEvent(li, "turn_start");
    };

    /**
     * Returns the li of the next turn.
     * @returns {HTMLElement} the list of the mob who has the next turn.
     */
    getNext = function() {
        // TODO: 0HP mobs.
        var el;
        if(!(el = _listEl.querySelector(".currentTurn ~ [data-initiative]"))) {
            // Will select the first that actually has init.
            el = _listEl.querySelector("[data-initiative]");
        }
        return el;
    };

    if(window.sessionId) {
        refreshList();
    }

    window.socket.addEventListener("message", onReceiveMessage);
    public.addMob = addMob;
    public.removeMob = removeMob;
    public.refreshList = refreshList;

    /**
     * Removes any NPCs from the list, but keeps players.
     */
    public.clearNpcs = function() {
        var i, list;
        list = _listEl.querySelectorAll("[data-mobType='npc']");
        for (i = 0; i < list.length; i++) {
            removeMob({
                id : list[i].getAttribute("data-id")
            });
        }
    };

    /**
     * Finds who has the next turn according to the initiative order.
     * @returns {string} id of the mob who is next.
     */
    public.getNext = function() {
        var next;
        if (next = getNext()) {
            return next.getAttribute("data-id");
        }
        return null;
    };

    /**
     * Gets full data on the mob whose turn it is.
     * @returns {object} The mob.
     */
    public.getCurrent = function() {
        var el;
        if(!(el = _listEl.querySelector(".currentTurn"))) {
            return null;
        }
        return public.getMobData(el.getAttribute("data-id"));
    }

    /**
     * Subscribes to an event triggered by some operation or interation on the list.
     * @param {string} event The name of the event.
     * @param {function} handler The callback.
     */
    public.onListEvent = function(event, handler) {
        if (!_subscribers[event]) {
            _subscribers[event] = [];
        }

        _subscribers[event].push(handler);
    };

    /**
     * Removes a handler from the list of subscribers.
     * @param {string} event to unsubsribe from.
     * @param {function} handler to remove.
     */
    public.offListEvent = function(event, handler) {
        var i;
        if (!_subscribers[event]) {
            return;
        }

        if((i = _subscribers[event].indexOf(handler)) >= 0) {
            _subscribers[event].splice(i, 1);
        }
    };

    /**
     * Enable or disable a button.
     * @param {string} id Id of the mob with the button.
     * @param {boolean} isOn Whether the button should be set as enabled or disabled.
     */
    public.toggleReaction = function(id, isOn) {
        var el = _listEl.querySelector("[data-id='"+ id +"']");
        if (isOn) {
            el.removeAttribute("data-reacted");
        } else {
            el.setAttribute("data-reacted", "");
        }
    };

    /**
     * @param {string} id Of the mob.
     * @returns {object} data on the mob contained in the list or null if the mob doesn't exist.
     */
    public.getMobData = function(id) {
        var result, el;
        el = _listEl.querySelector("[data-id='"+ id +"']");
        if (!el) {
            return null;
        }
        return liToData(el);
    };

    /**
     * Gets the ids of each NPC in the current combat.
     * @returns {array of string} The ids.
     */
    public.listNpcIds = function() {
        var result, els, i;
        els = _listEl.querySelectorAll("[data-mobType='npc']");
        result = [];
        for (i = 0; i < els.length; i++) {
            result.push(els[i].getAttribute("data-id"));
        }
        return result;
    };

    /**
     * Puts the initiative order back to the beginning.
     */
    public.resetTurns = function() {
        var i, els;
        els = _listEl.getElementsByClassName("currentTurn");
        for (i = 0; i < els.length; i++) {
            els[i].classList.remove("currentTurn");
        }
    }

    /**
     * Reorders the list based on initiative.
     */
    public.orderList = function() {
        var listItems, temp, i, ordered, comparator;
        listItems = _listEl.querySelectorAll("li.mob");
        // Convert node list in to array.
        temp = [];
        for (i = 0; i < listItems.length; i++) {
            temp.push(listItems[i]);
        }
        listItems = temp;

        ordered = [];
        while(listItems.length > 0) {
            if (!ordered.length) {
                ordered.push(listItems[0]);
            } else {
                comparator = parseInt(listItems[0].getAttribute("data-initiative"));
                i = 0;
                while(
                    i < ordered.length
                    && comparator <= parseInt(ordered[i].getAttribute("data-initiative"))
                ) {
                    // <= preferences earlier entries.
                    i++;
                }
                ordered.splice(i, 0, listItems[0]);
            }
            listItems.shift();
        }

        while(_listEl.firstElementChild) {
            _listEl.removeChild(_listEl.firstElementChild);
        }
        for(i = 0; i < ordered.length; i++) {
            _listEl.appendChild(ordered[i]);
        }
    };

    return public;
});