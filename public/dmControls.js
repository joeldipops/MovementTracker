registerInterface(function() {
    function dmControlsScript(main, map, mobList) {
        var _menuEl, _template,
            onMapSelected, onSetupStart, onClearClicked, onStartClicked, onResetClicked, onPositionClicked,
            onMapSizeChange, onUpdateMapClick, onMapSaveClick,
            toggleMob, addNpc, resetMap, setTurn, resetEvents, addTerrain, renderDmMenu, renderMpList,
            main_renderMenu, main_toggleMob;

        _menuEl = document.getElementById("controls");
        _template = mainEl.querySelector("#template-combatCell").innerHTML;

        /**
        * When the DM first hits this page, or clicks "Clear" put the menu in setup mode.
        */
        onSetupStart = function() {
            var el;
            document.body.setAttribute("data-state", "setup");
            if (el = _menuEl.querySelector("#dmControlTabs")) {
                el.setAttribute("data-tabs", 3);
                el = el.querySelector("[for='turnControlsTab']")
                el.classList.add("hidden");
            }

            main.renderMenu();
            resetMap();
            onEvent(window.socket, "message", main.onMessageReceived);
        };

        /**
         * When the DM selects an existing map from the menu, load it.
         */
        onMapSelected = function(event) {
            if (event.currentTarget.value === "0") {
                onMapSizeChange();
            } else {
                // Fetch the saved map & render it.
                sendHttpRequest("map/" + event.currentTarget.value, "GET", null, { interrupt : "onMapSelected" })
                .then(function(response) {
                    var k, i, mobs;
                    response = JSON.parse(response.responseText);
                    _menuEl.querySelector("[name='mapWidth']").value = response.data.width;
                    _menuEl.querySelector("[name='mapHeight']").value = response.data.height;
                    _menuEl.querySelector("[name='mapName']").value = response.name;

                    mobs = response.data.mobs;
                    for(k in mobs) {
                        if (!mobs.hasOwnProperty(k)) {
                            continue;
                        }
                        for (i = 0; i < mobs[k].length; i++) {
                            mobList.addMob(mobs[k][i]);
                        }
                    }
                    map.renderMap(response.data, _template);
                });
            }
        };

        /**
         * When the DM wants to save the current state of the map to the DB.
         * @returns {Promise} resolves when save is completed.
         */
        onSaveMapClick = function() {
            var data, id, select, name, promise;
            data = map.mapToJSON({ ignorePlayers: true });

            select = _menuEl.querySelector("#mapSelector");
            id = select.value;
            name = _menuEl.querySelector("[name='mapName']").value;

            if (!name) {
                // TODO - validation
                return rejectedPromise();
            }

            id = parseInt(id);

            if (id) {
                promise = sendHttpRequest("maps", "PUT", {
                    map_id : id,
                    name : name,
                    data : data
                });
            } else {
                promise = sendHttpRequest("maps", "POST", {
                    name : name,
                    data : data
                });
            }

            return promise.then(function(response) {
                // Keep the id of a newly saved map.
                if (!id) {
                    response = JSON.parse(response.responseText);
                    id = response.map_id;
                }
                return renderMapList();
            })
            .then(function() {
                // select the map you just saved.
                if (id) {
                    select.value = id;
                }
            })
            .catch(function() { debugger; });
        };

        /**
         * Moves the in-context mob to the next clicked location.
         */
        onPositionClicked = function(data) {
            map.removeMapEvents();
            if (!data.initiative && data.initiative !== 0) {
                mobList.addMob(data);
            }
            map.onMapEvent("td > button", "click", main.relocateMob.bind({}, data));
        };

        /**
         * Shows or hides an existing mob from the map.
         * Override the one in main to set onPositionClicked.
         * @param {object} data Describes the mob.
         * @param {boolean} silent Won't send a http request if true.
         */
        main_toggleMob = main.toggleMob;
        main.toggleMob = function(data, silent) {
            main_toggleMob(data, silent);
            if (data.mob_type === "pc") {
                onPositionClicked(data);
            }
        };

        /**
         * Renders controls in the menu container.
         */
        main_renderMenu = main.renderMenu;
        main.renderMenu = function(template) {
            var menu, el, i, select, option;
            main_renderMenu(document.getElementById("template-dmControls").innerHTML);

            renderMapList();

            // NPC creature sizes.
            el = _menuEl.querySelector("#mobOptions [name='npcSize']");
            for (i in MovementTracker.MOB_SIZES) {
                option = document.createElement("option");
                option.setAttribute("value", i);
                option.innerHTML = MovementTracker.MOB_SIZES[i].text;
                option.selected = (i === "medium");
                el.appendChild(option);
            }

            el = _menuEl.querySelector("#terrainOptions > ul[name='terrainTypes']");
            // Terrain type radio buttons.
            option = document.getElementById("template-terrainType").innerHTML;
            for (i in MovementTracker.TERRAIN_TYPES) {
                if (!MovementTracker.TERRAIN_TYPES.hasOwnProperty(i)) {
                    continue;
                }

                el.insertAdjacentHTML(
                    "beforeend",
                    option.replace(/{type}/g, i)
                    .replace(/{text}/g, MovementTracker.TERRAIN_TYPES[i].text)
                );
            }

            el = _menuEl.querySelector("#npcSpeed");
            option = document.getElementById("template-movementSetup").innerHTML;
            for (i in MovementTracker.MOVEMENT_TYPES) {
                if (!MovementTracker.MOVEMENT_TYPES.hasOwnProperty(i)) {
                    continue;
                }
                el.insertAdjacentHTML(
                    "beforeend",
                    option.replace(/{type}/g, i)
                    .replace(/{default}/g, MovementTracker.DEFAULT_WALK_SPEED * MovementTracker.MOVEMENT_TYPES[i].factor)
                    .replace(/{display}/g, MovementTracker.MOVEMENT_TYPES[i].text)
                );
            }

            // When add npc is clicked, we can select a cell to add them to.
            onEvent("button[name='addNpc']", "click", addNpc);

            // When position/location button is clicked for a mob, we can select a cell.
            mobList.onListEvent("position", onPositionClicked);

            // When in set up mode, deleting an NPC gets rid of it completely.
            mobList.onListEvent("toggleMob", toggleMob);

            // When clicked, sets this mob to have the current turn.
            mobList.onListEvent("setTurn", setTurn);

            // When terrain type is selected, we can add a terrain to a cell.
            onEvent("input[name='terrainType']", "change", function() {
                map.removeMapEvents();
                map.onMapEvent("td > button", "click", addTerrain);
            });

            onEvent("[name='mapWidth']", "change", onMapSizeChange);
            onEvent("[name='mapHeight']", "change", onMapSizeChange);
            onEvent("button[name='updateMap']", "click", onUpdateMapClick);

            onEvent("button[name='clear']", "click", onClearClicked.bind(null, false));

            onEvent("button[name='start']", "click", onStartClicked);

            onEvent("button[name='reset']", "click", onResetClicked);
            onEvent("[name='existingMap']", "change", onMapSelected);
            onEvent("[name='saveMap']", "click", onSaveMapClick);
        };

        /**
         * Shows the list of ssaved maps in the select control.
         */
        renderMapList = function() {
            var result;

            select = _menuEl.querySelector("#mapSelector");
            while(select.firstChild) {
                select.removeChild(select.firstChild);
            }

            result = sendHttpRequest("maps", "GET")
            .then(function(response) {
                var i;
                response = JSON.parse(response.responseText);

                for(i = 0; i < response.length; i++) {
                    option = document.createElement("option");
                    option.setAttribute("value", response[i].map_id);
                    option.innerHTML = response[i].name;
                    select.appendChild(option);
                }
            })
            // We can handle this one and continue "maps can't be loaded" whatever.
            .catch(function() {});

            option = document.createElement("option");
            option.setAttribute("value", "0");
            option.innerHTML = "&lt;New Map&gt;";
            select.appendChild(option);

            return result;
        };

        /**
         * Adds a new NPC based on the controls.
         */
        addNpc = function() {
            var name, init, size, k, data;
            name = document.querySelector("[name='npcName']").value;
            // Can't add NPC if missing info.
            if (!name) {
                return;
            }

            init = parseInt(document.querySelector("[name='npcInitiative']").value) || 0;

            data = {
                character_name : name,
                mob_type : "npc",
                potential : init,
                size : document.querySelector("[name='npcSize']").value,
                speed : {},
                id : (new Date()).valueOf().toString()
            };

            for (k in MovementTracker.MOVEMENT_TYPES) {
                if (!MovementTracker.MOVEMENT_TYPES.hasOwnProperty(k)) {
                    continue;
                }
                data.speed[k] = parseInt(document.querySelector("[name='npcSpeed-" + k + "']").value)
                if (!data.speed[k] && data.speed[k] !== 0) {
                    data.speed[k] = MovementTracker.DEFAULT_WALK_SPEED * MovementTracker.MOVEMENT_TYPES[k].factor;
                }
            }

            mobList.addMob(data);

            map.removeMapEvents();
            // the data that we bind the the map event
            map.onMapEvent("td > button", "click", main.relocateMob.bind(null, data));
        };

        /**
         * Generates a grid based on the user's request.
         */
        resetMap = function() {
            var width, height;
            width = parseInt(document.querySelector("[name='mapWidth']").value);
            height = parseInt(document.querySelector("[name='mapHeight']").value);
            onClearClicked(true);
            map.renderMap({
                width: width,
                height: height
            }, _template);
        };
        
        /**
         * Keeps the map up to date with any size changes.
         */
        onMapSizeChange = function() {
            if (document.body.getAttribute("data-state") === "setup") {
                resetMap();
            }
        };

        /**
         * Updates the map locally and notifies players
         */
        onUpdateMapClick = function() {
            var width, height, turn;
            width = parseInt(document.querySelector("[name='mapWidth']").value);
            height = parseInt(document.querySelector("[name='mapHeight']").value);
            map.resizeMap({
                width: width,
                height: height
            }, _template);

            turn = mobList.getCurrent();
            return sendHttpRequest("session/" + window.sessionId + "/broadcast", "POST", {
                message : { map_update : map.mapToJSON() }
            })
            .then(function() {
                // Ensure that current players turn continues.
                setTurn(turn);
            });
        };

        /**
         * Sets the current turn to that of a particular mob.
         * @param {object} data The mob data.
         * @returns {Promise} Resolves when http request is complete.
         */
        setTurn = function(data) {
            return sendHttpRequest("session/" + window.sessionId + "/turn/" + data.id, "PUT");
        };

        resetEvents = function() {
            closePage();
            mobList.offListEvent("position", onPositionClicked);
            mobList.offListEvent("toggleMob", toggleMob);
            mobList.offListEvent("setTurn", setTurn);
            mobList.offListEvent("react", main.onReactClicked);
            onEvent(window.socket, "message", main.onMessageReceived);
        };

        /**
         * Resets the map to a blank slate.
         */
        onClearClicked = function(isSilent) {
            var mapEl;
            map.removeMapEvents();
            mapEl = document.getElementById("map");
            mapEl.removeAttribute("data-width");
            mapEl.removeAttribute("data-height");
            while(mapEl.firstChild) {
                mapEl.removeChild(mapEl.firstChild);
            }
            if (!isSilent) {
                sendHttpRequest("session/" + window.sessionId + "/map", "DELETE");
                onSetupStart();
            }
        };

        /**
         * Uploads and broadcasts map, then takes you to the main screen.
         */
        onStartClicked = function() {
            var requestBody;
            requestBody = map.mapToJSON();
            resetEvents();
            sendHttpRequest("session/" + window.sessionId + "/map", "PUT", requestBody)
            .then(function() {
                return main.onPlayStart();
            })
            .then(function() {
                mobList.resetTurns();
                return main.triggerNextTurn();
            })
            .catch(function(res) {
                if(res.status) {
                    console.error(res.status, res.responseText);
                } else {
                    console.error(JSON.stringify(res));
                }
            });
        };

        /**
         * Deletes the session and goes back to the lobby page.
         */
        onResetClicked = function() {
            if (window.sessionId) {
                sendHttpRequest("session/" + window.sessionId, "DELETE")
                .then(function(res) {
                    replaceBody("home", document.documentElement);
                })
                .catch(function(res) {
                    console.error(res.status, res.responseText);
                });
            } else {
                replaceBody("home", document.documentElement);
            }
            document.body.removeAttribute("data-isDm");
            delete window.sessionId;
        };

        /**
        * Adds a terrain to the map.
        * @param {DOMEvent} event The click event describing where to add the terrain.
        */
        addTerrain = function(event) {
            var x, y, X, Y, width, height, type, isDifficult,
                el, maxX, maxY;

            x = parseInt(event.currentTarget.getAttribute("data-x"));
            y = parseInt(event.currentTarget.getAttribute("data-y"));
            width = parseInt(document.querySelector("[name='terrainWidth']").value);
            height = parseInt(document.querySelector("[name='terrainLength']").value);
            type = document.querySelector("[name='terrainType']:checked").value;
            isDifficult = document.querySelector("[name='isDifficult']").checked;

            mapSize = map.getSize();
            maxX = mapSize.width;
            maxY = mapSize.height;

            for (X = x; X < (x + width) && X <= maxX; X++) {
                for(Y = y; Y < (y + height) && Y <= maxY; Y++) {
                    map.setTerrain(X, Y, type, isDifficult);
                }
            }

            sendHttpRequest(
                "session/" + window.sessionId + "/map/add",
                "PUT",
                {
                    left: x,
                    top : y,
                    width: width,
                    height: height,
                    type: type
                }
            );
        };

        tearDown = function() {
            main.toggleMob = main_toggleMob;
            main.renderMenu = main_renderMenu;
        };

        return {
            onSetupStart : onSetupStart,
            resetEvents: resetEvents,
            tearDown: tearDown
        };
    }

    return runAsync([
        loadExternalScript("combat", "public/combat.js"),
        loadExternalScript("map", "public/combatMap.js"),
        loadExternalScript("mobList", "public/mobList.js")
    ], true)
    .then(dmControlsScript);
});

