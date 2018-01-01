registerInterface(function() {
    function mainCombatScript(combatMap, mobList, dmControls) {
        var updateMap, triggerNextTurn, renderMenu, resetMenu, unlockMenu, attemptMove, getDistance, subtractMovement, getSpeedPriority,
            onMessageReceived, onTurnStart, onMyTurnStart, onReactionUsed, onReactionComplete, onCombatStart, onPlayStart, onSetupStart,
            onDashChange, onTerrainClick, onPlayerMove, onMoveSelected, onReactClick, onDoneClick,
            addMob, relocateMob, removeMob, renderOverlay, toggleMob, isTileFreeForMob, 
            _template, _reactTemplate, _menuEl,
            U;
        
        U = MovementTracker.utils;

        _reactTemplate = mainEl.querySelector("#template-reactionAlert").innerHTML
        _template = mainEl.querySelector("#template-combatCell").innerHTML;
        _menuEl = document.getElementById("controls");

        /**
        * Renders the map then adds all combatants to the initiative list.
        * @param {object} data data from a GET session/map endpoint.
        * @param {string} turnMobId id of the mob whose turn it is if any.
        */
        updateMap = function(data, turnMobId) {
            var k, i;
            combatMap.renderMap(data, _template);
            mobList.clearNpcs();
            for (k in data.mobs) {
                for (i = 0; i < data.mobs[k].length; i++) {
                    mobList.addMob(data.mobs[k][i], {
                        isUpdate: true,
                        isTurn: U.isEqual(data.mobs[k][i].id, turnMobId),
                        isInCombat: true
                    });
                }
            }
        };

        /**
         * DM has a tab menu that must be shown and hidden when moving through turns
         */
        unlockMenu = function() {
            var tab;
            if (tab = _menuEl.querySelector("#turnControlsTab")) {
                tab.classList.remove("hiddenTab");
                _menuEl.querySelector("#dmControlTabs").setAttribute("data-tabs", 4);
                tab.checked = true;
            }
        };

        /**
        * Sets the controls for this stage of the app.
        */
        renderMenu = function(template) {
            var template, k;
            while(_menuEl.firstElementChild) {
                _menuEl.removeChild(_menuEl.firstElementChild);
            }

            template = template || document.getElementById("template-controls").innerHTML;
            _menuEl.insertAdjacentHTML("beforeend", template);

            onEvent("[name='dashAction']", "change", onDashChange);
            onEvent("[name='dashBonus']", "change", onDashChange);
        };

        /**
        * Paints the map with areas the mob can and can't reach in a straight line from where they are.
        * @param {object} mob The mob.
        */
        renderOverlay = function(mob) {
            if (!mob) {
                mob = combatMap.getTurn();
            }

            combatMap.removeClass("reachable");
            combatMap.removeClass("unreachable");

            combatMap.forEach(function(cell) {
                var loc, current;
                loc = combatMap.getMobWithId(mob.id);
                current = combatMap.getCell(loc.x, loc.y);

                if (attemptMove(current, cell, mob)) {
                    // Set timeout allows for a smoother ux
                    setTimeout(function() {cell.classList.add("reachable");}, 0);
                } else {
                    setTimeout(function() {cell.classList.add("unreachable");}, 0);
                }
            }, true);
        };

        /**
        * Sets up the map to allow movement during a turn.
        */
        onMoveSelected = function(data) {
            combatMap.removeMapEvents();
            combatMap.onMapEvent("td > .terrain", "click", onTerrainClick.bind({}, data), "turn");
            renderOverlay(data);
        };

        /**
        * If player chooses to user her/his action/bonus to dash, adjust the remaining speed.
        */
        onDashChange = function() {
            var el, els, i, base, max,
                dashChecked, bonusChecked;
            els = _menuEl.querySelectorAll("input[name='movementType']");
            dashChecked = !!_menuEl.querySelector("[name='dashAction']:checked");
            bonusChecked = !!_menuEl.querySelector("[name='dashBonus']:checked");
            for (i = 0; i < els.length; i++) {
                el = els[i];
                base = parseInt(el.getAttribute("data-base"));
                used = parseInt(el.getAttribute("data-used"));
                total = base;

                if (dashChecked) {
                    total += base;
                }
                if (bonusChecked) {
                    total += base;
                }

                total -= parseInt(el.getAttribute("data-used"));

                if (total < 0) {
                    total = 0;
                }

                el.setAttribute("data-remaining", total);
                el.parentNode.querySelector("[for='" + el.id + "'] + [name='remaining']").innerHTML = total;
            }
            renderOverlay();
        };

        /**
        * Sets the menu up for user at the start of a turn.
        * @param {object} data describes the mob about to take a turn.
        */
        resetMenu = function(data) {
            var template, temp, el, list, i;
            template = document.getElementById("template-movementOption").innerHTML;
            el = _menuEl.querySelector(".ctrl-speedOptions");
            while(el.firstElementChild) {
                el.removeChild(el.firstElementChild);
            }

            list = _menuEl.querySelectorAll(":checked")
            for (i = 0; i < list.length; i++) {
                list[i].checked = false;
            }

            // Add the speeds we have access to.
            for (k in MovementTracker.MOVEMENT_TYPES) {
                if (!MovementTracker.MOVEMENT_TYPES.hasOwnProperty(k)) {
                    continue;
                }
                // We don't have this speed.
                if (!data.speed[k]) {
                    continue;
                }

                temp = template.replace(/{type}/g, k)
                    .replace(/{text}/g, MovementTracker.MOVEMENT_TYPES[k].text)
                    .replace(/{remaining}/g, data.speed[k]);
                el.insertAdjacentHTML("beforeend", temp);
            }
            // Auto select walk.
            el.querySelector("[name='movementType'][value='walk']").checked = true;
            onEvent("[name='movementType']", "click", onMoveSelected.bind({}, data), "turn");
            onEvent("[name='done']", "click", onDoneClick.bind({}, data), "turn");
        }

        /**
         * When a mob has finished a turn or reaction.
         * @param {object} data The mob that finished their turn.
         */
        onDoneClick = function(data) {
            if (document.body.hasAttribute("data-isMyTurn")) {
                return triggerNextTurn();
            } else if (document.body.hasAttribute("data-isMyReaction")) {
                sendHttpRequest("session/" + window.sessionId + "/broadcast", "POST", {
                    message : { player_reacted : { id : data.id } }
                });
                document.body.removeAttribute("data-isMyReaction");
                combatMap.removeClass("reachable");
                combatMap.removeClass("unreachable");
                combatMap.removeMapEvents();

                if (el = _menuEl.querySelector("#turnControlsTab")) {
                    el.checked = false;
                    el.classList.add("hiddenTab");
                    _menuEl.querySelector("#dmControlTabs").setAttribute("data-tabs", 3);
                }
            }
        };

        /**
        * Determines who has the next turn and broadcasts to everyone.
        * @returns {Promise} resolves when turn has been updated at the backend.
        */
        triggerNextTurn = function() {
            var id;
            if (id = mobList.getNext()) {
                combatMap.removeMapEvents();
                return sendHttpRequest("session/" + window.sessionId + "/turn/" + id, "PUT");
            } else {
                return newPromise();
            }
        };

        /**
        * Set up for the start of combat.
        */
        onCombatStart = function() {
            var i, ids;
            if (document.body.hasAttribute("data-isDm")) {
                ids = mobList.listNpcIds();
                for (i = 0; i < ids.length; i++) {
                    mobList.toggleReaction(ids[i], true);
                }
            } else {
                mobList.toggleReaction(window.playerId, true);
            }
        };

        /**
        * Reset the UI when each new turn starts
        * @param {object} data the mob whose turn it is.
        */
        onTurnStart = function(data) {
            var message, el;
            offEvents("turn");
            combatMap.removeMapEvents();

            combatMap.removeClass("reachable");
            combatMap.removeClass("unreachable");

            message = "<h1>" + data.character_name + "'s Turn</h1>";
            if (data.mob_type === "npc" && document.body.hasAttribute("data-isDm")) {
                // DM's turn for NPCs
                onMyTurnStart(data);
            } else if (U.isEqual(data.id, window.playerId)) {
                // Player's turn.
                onMyTurnStart(data);
                message = "<h1>Your Turn</h1>";
            } else {
                // Switch off for everyone else.
                document.body.removeAttribute("data-isMyTurn");

                // Switch off DM's TURN tab.
                if (el = _menuEl.querySelector("#turnControlsTab")) {
                    el.checked = false;
                    el.classList.add("hiddenTab");
                    _menuEl.querySelector("#dmControlTabs").setAttribute("data-tabs", 3);
                }
            }
            combatMap.setTurn(data.id);
            showAlert(message, 1000);
        };
        mobList.onListEvent("turn_start", onTurnStart);

        /**
        * Determines the order in which various speeds should be used up in a movement.
        * @param {string} terrain The type of terrain to move through.
        * @returns {Array of string}  Array of possible speeds from first to last.
        */
        getSpeedPriority = function(terrain) {
            var priority, result, i;

            terrain = terrain.split("+")[0];

            priority = _menuEl.querySelector("[name='movementType']:checked");
            priority = priority ? priority.value : null;
            if (!priority) {
                return MovementTracker.TERRAIN_TYPES[terrain].speeds;
            }

            result = clone(MovementTracker.TERRAIN_TYPES[terrain].speeds);

            // Find the index of priority and move it to the start the start.
            for (i = 0; i < result.length; i++) {
                // account for any modifers like "walk|2"
                if (result[i].split("|")[0] === priority) {
                    priority = result[i];
                    break;
                }
            }
            // Can't use this movement for this terrain.
            if (i >= result.length) {
                return result;
            }
            result.splice(i, 1);
            result.unshift(priority);

            return result;
        };

        /**
        * Calculates whether the mob can reach the given point this turn, then moves them.
        * @param {HTMLElement} current tile the mob is currently on.
        * @param {HTMLElement} candidate tile the mob tries to reach.
        * @param {object} mob Specifiy a mob to move.  If empty will just simulate the move to check if it can be done.
        * @param {boolean} makeAttempt True if mob should move if able, false if just a simulation.
        * @returns {boolean} true if point can be reached.
        */
        attemptMove = function(current, candidate, mob, makeAttempt) {
            var distance, els, speeds, total, startDistance, speedOrder, speedType, modifier, difficult,
                i, j, k, x, y, value;

            els = _menuEl.querySelectorAll("[name='movementType']");
            speeds = {};
            for (i = 0; i < els.length; i++) {
                value = parseInt(els[i].getAttribute("data-remaining"));
                if (value) {
                    speeds[els[i].getAttribute("value")] = value;
                }
            }
            // No movement left.
            if (!Object.keys(speeds).length) {
                return false;
            }

            x = parseInt(candidate.getAttribute("data-x"));
            y = parseInt(candidate.getAttribute("data-y"));

            if (!isTileFreeForMob(x, y, mob)) {
                return false;
            }

            distance = getDistance(
                x, y,
                parseInt(current.getAttribute("data-x")),
                parseInt(current.getAttribute("data-y"))
            );
            // Can't pass the impassable.
            if (distance["impassable"]) {
                return false;
            }
            total = 0;

            // For each type of terrain
            for (k in distance) {
                if (!distance.hasOwnProperty(k)) {
                    continue;
                }

                difficult = parseFloat(k.split("+")[1], 10) || 0;

                speedOrder = getSpeedPriority(k);
                // Use the best speed we have first (eg. swimming for water)
                for (i = 0; i < speedOrder.length; i++) {
                    startDistance = distance[k];
                    if (distance[k] <= 0) {
                        break;
                    }
                    value = (speedOrder[i] || []).split("+");
                    speedType = value[0];

                    // + 1 for using walk to swim or climb.
                    // + 1 for difficult terrain.
                    modifier = 1;
                    modifier += difficult;
                    modifier += parseFloat(value[1], 10) || 0;

                    if (!speeds[speedType]) {
                        continue;
                    }

                    if ((distance[k] * modifier) < speeds[speedType]) {
                        // made the distance with speed to spare.
                        speeds[speedType] -= distance[k] * modifier;
                        distance[k] = 0;
                    } else if ((distance[k] * modifier) > speeds[speedType]) {
                        // used up all of this speed trying to make the distance.
                        distance[k] -= Math.floor(speeds[speedType] / modifier);
                        speeds[speedType] = 0;
                    } else {
                        // Used all of this speed, but made the distance.
                        distance[k] = 0;
                        speeds[speedType] = 0;
                    }

                    // Adjust all speeds by distance already moved.
                    for (j in speeds) {
                        if (!speeds.hasOwnProperty(j) || j === speedType) {
                            continue;
                        }
                        speeds[j] -= (startDistance - distance[k]);
                        speeds[j] = speeds[j] >= 0 ? speeds[j] : 0;
                    }

                    if (distance[k] === 0) {
                        break;
                    }
                }
                // If we couldn't complete the distance with all our speeds, then it's not in range.
                if (distance[k]) {
                    return false;
                }
            }
            if (makeAttempt) {
                subtractMovement(speeds);
                moveMob(mob, candidate);
            }
            return true;
        };

        /**
        * Calculates the distance between two points.
        * @param {number} x1 current horizontal position.
        * @param {number} y1 current "vertical" position.
        * @param {number} x2 candidate horizontal position.
        * @param {number} y2 candidate "vertical" position
        * @returns {object} Distanced travelled through each type of terrain.
        */
        getDistance = function(x1, y1, x2, y2) {
            var distance, m, c, i, k, factor, visited,
                x, y, result, cell;

            result = {};

            // Vertical line
            if (x1 === x2) {
                if (y1 === y2) {
                    return result;
                }
                for (
                    y = ((y1 < y2) ? y1 : y2) + 1;
                    y <= ((y1 < y2) ? y2 : y1);
                    y++
                ) {
                    cell = combatMap.getCell(x1, y);
                    cell = cell.classList.contains("difficult")
                        ? cell.getAttribute("data-type") + "+1"
                        : cell.getAttribute("data-type")
                    ;

                    if (!result[cell]) {
                        result[cell] = 0;
                    }
                    result[cell] += MovementTracker.UNITS_PER_TILE;
                }
                return result;
            }

            // A bigger factor will give a more accurate result but take longer to process.
            // TODO: See if I can't make any performance improvements when calculating and rendering the shading.
            factor = MovementTracker.UNITS_PER_TILE * 2;

            x1 *= factor;
            x2 *= factor;
            y1 *= factor;
            y2 *= factor;

            // Find the line between the two points,
            m = (y2 - y1)/(x2 - x1);
            c = y1 - (m * x1);

            visited = {};

            // Find proportion of terrains the line passes through.
            for (
                i = (x1 < x2 ? x1 : x2) + 1;
                i <= (x1 < x2 ? x2 : x1);
                i++
            ) {
                y = Math.floor((m * i + c) / factor);
                x = Math.floor(i / factor);

                cell = combatMap.getCell(x, y);
                if (!cell) {
                    continue;
                }
                cell = cell.classList.contains("difficult")
                    ? cell.getAttribute("data-type") + "+1"
                    : cell.getAttribute("data-type")
                ;

                if (!result[cell]) {
                    result[cell] = 0;
                }

                result[cell]++;
            }

            // Find the actual distance travelled with pythagoras.
            distance = (Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)) / factor) * MovementTracker.UNITS_PER_TILE;

            for (k in result) {
                if (!result.hasOwnProperty(k)) {
                    continue;
                }
                result[k] = Math.round(distance * (result[k] / Math.abs(x2 - x1)));
            }
            return result;
        };

        /**
        * Determines if a tile is within range and changes the colour if so.
        * @param {MouseEvent} event The event containing the element that was clicked.
        */
        onTerrainMouseOver = function(mob, event) {
            var loc, current, speedEl;

            combatMap.removeClass("reachable");
            combatMap.removeClass("unreachable");
            loc = combatMap.getMobWithId(mob.id);
            current = combatMap.getCell(loc.x, loc.y);

            if (attemptMove(current, event.currentTarget, mob)) {
                event.currentTarget.classList.add("reachable");
            } else {
                event.currentTarget.classList.add("unreachable");
            }
        };

        /**
        * Selects a tile for movement on a click.
        * Moves mob to new location on a double click.
        * @param {object} mob The mob to move.
        * @param {MouseEvent} event click event containing element that was clicked.
        */
        onTerrainClick = function(mob, event) {
            var distance, loc;
            if (!event.currentTarget.classList.contains("selected")) {
                // Update which tile is selected.
                combatMap.removeClass("selected");
                event.currentTarget.classList.add("selected");
            } else {
                loc = combatMap.getMobWithId(mob.id);
                attemptMove(combatMap.getCell(loc.x, loc.y), event.currentTarget, mob, true);
            }
            event.preventDefault();
        };

        /**
        * Updates your remaining movement after any move.
        * @param {object} speeds How much of each speed is left.
        */
        subtractMovement = function(speeds) {
            var el, k;
            for (k in speeds) {
                el = _menuEl.querySelector("[name='movementType'][value='"+ k  +"']");
                el.setAttribute(
                    "data-used",
                    parseInt(el.getAttribute("data-used")) + (parseInt(el.getAttribute("data-remaining")) - speeds[k])
                );
                el.setAttribute("data-remaining", speeds[k]);
                el.parentNode.querySelector("[for='"+ el.id + "'] + [name='remaining']").innerHTML = speeds[k];
            }
        };

        /**
        * Moves a mob to a new location
        * @param {object} mob The mob to move.
        * @param {HTMLElement} location The tile to move to.
        * @param {boolean} silent If true, don't notify other users.
        * @returns {number} The distance moved.
        */
        moveMob = function(mob, location, silent) {
            var x1, y1, x, y, distance;
            mob = combatMap.getMobWithId(mob.id) || mob;
            x1 = mob.x;
            y1 = mob.y;
            combatMap.removeMob(mob);

            mobList.addMob(arguments[0], { isInCombat : true });

            x = parseInt(location.getAttribute("data-x"));
            y = parseInt(location.getAttribute("data-y"));

            combatMap.setMob(x, y, mob);

            // Notify all of the move.
            if (!silent) {
                sendHttpRequest(
                    "session/" + window.sessionId + "/player/" + mob.id + "/move",
                    "PUT",
                    { x : x, y: y }
                );
            }

            // If you just moved, or you as the DM just moved an NPC, reclculate the overlay.
            if ((document.body.hasAttribute("data-isMyTurn") || document.body.hasAttribute("data-isMyReaction")) && (U.isEqual(mob.id, window.playerId) || (mob.mob_type === "npc" && document.body.hasAttribute("data-isDm")))) {
                renderOverlay(mob);
            }

            return getDistance(x1, y1, x, y);
        };

        /**
        * Sets up everything for the current player's turn.
        * @param {object} data Details of the mob whose turn it is.
        */
        onMyTurnStart = function(data) {
            var tab;

            document.body.setAttribute("data-isMyTurn", "isMyTurn");
            resetMenu(data);
            unlockMenu();
            mobList.toggleReaction(data.id, true);
            onMoveSelected(data);
        };

        /**
        * Updates the map when a player_move event is received.
        */
        onPlayerMove = function(data) {
            var newLocation = combatMap.getCell(data.x, data.y);
            data = mobList.getMobData(data.id);
            moveMob(data, newLocation, true);
        };

        /**
        * Handles messages received through the web socket.
        */
        onMessageReceived = function(event) {
            var data, fn;
            data = JSON.parse(event.data);
            if (data["map_update"]) {
                updateMap(data["map_update"]);
            }
            if (data["player_move"]) {
                onPlayerMove(data["player_move"]);
            }
            if (data["terrain_update"]) {
                fn = function(data) {
                    var x, y, size;
                    size = combatMap.getSize();
                    for (x = data.left; x < (data.left + data.width) && x <= size.width; x++) {
                        for(y = data.top; y < (data.top + data.height) && y <= size.height; y++) {
                            combatMap.setTerrain(x, y, data.type);
                        }
                    }
                };
                fn(data["terrain_update"]);
            }
            if (data["player_remove"]) {
                if (data["player_remove"].from_combat) {
                    toggleMob(mobList.getMobData(data["player_remove"].id), true);
                } else {
                    combatMap.removeMob(data["player_remove"]);
                }
            }
            if (data["player_react"]) {
                onReactionUsed(data["player_react"]);
            }
            if (data["player_reacted"]) {
                onReactionComplete(data["player_reacted"]);
            }
            if (data["combat_start"]) {
                onCombatStart();
            }
            // ignored by dm
            if (!document.body.hasAttribute("data-isDm")) {
                if (data["combat_end"]) {
                    replaceBody("ready");
                }
            }
        };

        toggleMob = function() {
            var inCombat = document.body.getAttribute("data-state") === "combat";
            if (data.mob_type == "npc" || !inCombat) {
                combatMap.removeMapEvents();
                combatMap.removeMob(data);
            }

            if (inCombat && data.mob_type === "pc") {
                combatMap.addCondition(data.id, MovementTracker.CONDITIONS.down);
            }

            mobList.removeMob(data, data.mob_type === "pc");

            if (!silent && inCombat) {
                sendHttpRequest(
                    "session/" + window.sessionId + "/player/" + data.id + "/remove",
                    "PUT"
                );
            }
        };

        /**
        * When ready to play, put the page in play mode if it's currently in setup mode.
        */
        onPlayStart = function() {
            document.body.setAttribute("data-state", "combat");
            return runAsync([
                // Get the current state of the map.
                sendHttpRequest("session/" + window.sessionId + "/map", "GET"),
                // Get the current turn.
                sendHttpRequest("session/" + window.sessionId + "/turn", "GET")
            ])
            .then(function(response) {
                var el, data, turnId;
                data = {
                    map :JSON.parse(response[0].responseText || null),
                    turn : JSON.parse(response[1].responseText || null)
                };
                if (data.map.width) {
                    updateMap(
                        data.map,
                        data.turn && data.turn.turn_start && data.turn.turn_start.id.toString()
                    );
                }

                public.renderMenu();
                if (el = _menuEl.querySelector("#dmControlTabs")) {
                    el.setAttribute("data-tabs", 4);
                    el = el.querySelector("[for='turnControlsTab']")
                    el.classList.remove("hidden");
                }
                if (document.body.hasAttribute("data-isDM")) {
                    onCombatStart();
                }
                mobList.onListEvent("react", onReactClick);
            })
            .catch(function() {
                debugger;
            });
        };

        /**
        * Allows the DM to instantly move the mob from one location to another.
        */
        relocateMob = function(data, event) {
            var mob;

            // Ensure mob appers correctly with initiative.
            mobList.addMob(data, { isUpdate : true, isInCombat: true });

            mob = combatMap.getMobWithId(data.id);
            if (mob) {
                combatMap.removeMob(mob);
                mob = void 0;
            } else if (data.mob_type !== "pc") {
                // Notify all of new mob's data.
                sendHttpRequest("session/" + window.sessionId + "/broadcast", "POST", {
                    message : { player_update : data }
                });
            }
            if (!addMob(clone(data), event) && mob) {
                // Weren't able to move because of terrain etc restrictions,
                // so put back where it was.
                combatMap.setMob(mob.x, mob.y, mob);
            }
        };

        /**
        * Checks if a mob can occupy a given location based on its size.
        * @param {number} x co-ordinate of the tile.
        * @param {number} y co-ordinate of the tile.
        * @param {string} size The code for the size.
        * @returns {boolean} true if can occupy, false otherwise.
        */
        isTileFreeForMob = function(x, y, mob) {
            var extant, size;
            extant = combatMap.getMob(x, y);
            size = MovementTracker.MOB_SIZES[mob.size];

            for (i = 0; i < (extant ? extant.length : 0); i++) {
                // Mob is already occupying the space so can occupy by definition.
                if (mob.id === extant[i].id) {
                    return true;
                }
                // "a creature cannot enter the same space of another unless they are two sizes smaller or larger.
                if (Math.abs(size.rank - MovementTracker.MOB_SIZES[extant[i].size].rank) <= 1) {
                    return false;
                }
            }
            return true;
        };

        /**
        * Adds a new MOB to the map.
        * @param {object} data describing the mob.
        * @param {DOMEvent} event The click event describing where to add the terrain.
        */
        addMob = function(data, event) {
            var x, y, mapSize, size,
                i, j, el, container, orig;

            orig = data;
            data = U.clone(data);
            // only use this ID the first time.
            delete orig.id

            if (!data.id) {
                data.id = (new Date()).valueOf().toString();
                delete data.order;
                mobList.addMob(data);
            }

            x = parseInt(event.currentTarget.getAttribute("data-x"));
            y = parseInt(event.currentTarget.getAttribute("data-y"));

            if (!isTileFreeForMob(x, y, data)) {
                return false;
            }

            size = MovementTracker.MOB_SIZES[data.size];

            mapSize = combatMap.getSize();
            maxX = mapSize.width;
            maxY = mapSize.height;

            for (i = x; i < x + size.tiles && i <= maxX; i++) {
                for (j = y; j < y + size.tiles && j <= maxY; j++) {
                    // Needs A LOT of design work on what to do with larger creatures & multiple 
                    // creatures on a tile...
                    combatMap.setMob(i, j, data);
                }
            }

            // Notify all
            if (document.body.getAttribute("data-state") === "combat") {
                sendHttpRequest(
                    "session/" + window.sessionId + "/player/" + data.id + "/move",
                    "PUT",
                    {
                        x : x, y: y,
                        character_name : data.character_name,
                        colour : data.colour
                    }
                );
            }
            return true;
        };

        /**
         * Notifies all players that a reaction has been used.
         */
        onReactClick = function(data) {
            sendHttpRequest(
                "session/" + window.sessionId + "/broadcast",
                "POST",
                { message : { player_react : { id : data.id } } }
            );
            mobList.toggleReaction(data.id, false);
            document.body.setAttribute("data-isMyReaction", "isMyReaction");
            resetMenu(data);
            unlockMenu();
            onMoveSelected(data);
        };

        /**
         * Displays a message that a reaction was used, and suspends event until reaction is complete.
         */
        onReactionUsed = function(data) {
            var mob, message;
            if (U.isEqual(data.id, window.playerId)) {
                message = "You React!";
            } else {
                mob = mobList.getMobData(data.id);
                message = mob.character_name + " Reacts!";
            }
            showAlert(_reactTemplate.replace("{message}", message), 1000);
            if (document.body.hasAttribute("data-isMyTurn")) {
                document.body.setAttribute("data-wasMyTurn", "wasMyTurn");
                document.body.removeAttribute("data-isMyTurn");

                // Switch off DM's TURN tab.
                if (el = _menuEl.querySelector("#turnControlsTab")) {
                    el.checked = false;
                    el.classList.add("hiddenTab");
                    _menuEl.querySelector("#dmControlTabs").setAttribute("data-tabs", 3);
                }

                offEvents("turn");
                combatMap.removeMapEvents();
            }
        };

        /**
         * After a mob has finished reacting, whoever's turn it was can continue.
         */
        onReactionComplete = function(data) {
            var self;
            if (document.body.hasAttribute("data-wasMyTurn")) {
                document.body.setAttribute("data-isMyTurn", "isMyTurn");
                document.body.removeAttribute("data-wasMyTurn");

                unlockMenu();

                self = mobList.getCurrent()
                onMoveSelected(self);
                onEvent("[name='done']", "click", onDoneClick.bind({}, self), "turn");
            }
        };

        var public = {
            onPlayStart : onPlayStart,
            renderMenu : renderMenu,
            onMessageReceived : onMessageReceived,
            relocateMob: relocateMob,
            toggleMob: toggleMob,
            onReactClick: onReactClick,
            triggerNextTurn: triggerNextTurn
        }

        return public;

    }; // end mainCombatScript

    return runAsync([
        loadExternalScript("map", "public/combatMap.js"),
        loadExternalScript("mobList", "public/mobList.js"),
    ], true)
    .then(mainCombatScript);
});
