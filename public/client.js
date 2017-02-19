var UNITS_PER_TILE, mainEl,
onEvent, closePage, newPromise, wait, pageContext;

UNITS_PER_TILE = 5;
pageContext = {};

var a = function() {
    var _pageEvents, _pendingPromises, _pendingTimeouts;
    _pageEvents = [];
    _pendingCancelFlags = [];
    _pendingTimeouts = [];

    /**
     * Keeps track of page-level events so they can be unbound later. 
     * @param {EventTarget|string} target to bind event or selector.
     * @param {string} event name of event.
     * @param {function} callback when event is fired.
     */
    onEvent = function(target, event, handler) {
        var i;
        if (typeof target === "string") {
            target = document.querySelectorAll(target);
        }
        if (!target.length) {
            target = [target];
        }
        for (i = 0; i < target.length; i++) {
            target[i].addEventListener(event, handler);
            _pageEvents.push(target[i].removeEventListener.bind(target[i], event, handler));
        }

    };

    /**
     * Cleans up a page when it is no longer needed.
     */
    closePage = function() {
       var i;
       for(i = 0; i < _pageEvents.length; i++) {
           _pageEvents[i]();
       }
       _pageEvents.length = 0;
       for (i = 0; i < _pendingCancelFlags.length; i++) {
           _pendingCancelFlags[i].value = true;
       }
       _pendingCancelFlags.length = 0;
       for (i = 0; i < _pendingTimeouts.length; i++) {
           clearTimeout(_pendingTimeouts[i]);
       }
       pageContext = {};
    };

    /**
     * Repeatedly calls a function until it succeeds.
     * Used when waiting for a resource to exist.
     * @param {function} callback, function must return truthy on success and falsy otherwise.
     */
    wait = function(callback) {
        if (!callback()) {
            _pendingTimeouts.push(setTimeout(wait.bind({}, callback), 50));
        }
    };

    /**
     * Makes a clone of an object.
     * @param {object} object
     * @param {boolean} full also copies the prototype etc. 
     * @returns {object} the clone.
     */
    clone = function(object, full) {
        var k, result;
        result = {};

        for (k in object) {
            if(!full && !object.hasOwnProperty(k)) {
                continue;
            }
            result[k] = object[k];
        }
        return result;
    };

    /**
     * Calls parse int with the default r value of 10
     * @param {string} value can be parsed into a number.
     * @param {number} r (optional) Just know it should be 10...
     * @returns {number} parsed value or NaN.
     */
    var parseInt = function(value, r) {
        return window.parseInt(value, r !== void 0 ? r : 10);
    };

    /**
     * Keeps track of pending promises so they can be rejected when no longer needed.
     * @param {function} callback The promise callback
     * @returns {Promise} a promise generated from the callback.
     */
    newPromise = function(callback) {
        var innerPromise, resultPromise, cancelFlag;
        // When cancelled, promise will no longer fire.
        cancelFlag = { value : false };
        _pendingCancelFlags.push(cancelFlag);

        innerPromise = new Promise(callback);
        resultPromise = new Promise(function(resolve, reject) {
            // Fire public promise in response to inner promise, unless cancelled.
            innerPromise
            .then(function() {
                if (!cancelFlag.value) {
                    resolve.apply(this, arguments);
                }
            })
            .catch(function() {
                if (!cancelFlag.value) {
                    reject.apply(this, arguments);
                }
            });
        });
        return resultPromise;
    };
}();

/**
 * Resolves the promise when all the the async work is resolved.
 * @param {Array of Promise} promises
 * @returns {Promise} callback argument is an indexed list of the results that matches the order passed in.
 */
var runAsync = function(promises) {
    return newPromise(function(resolve, reject) {
        var i, results, resolved;
        resolved = 0;
        results = {};

        // If no promises, resolve immediately.
        if (!promises.length) {
            setTimeout(resolve, 0);
            return;
        }

        for (i = 0; i < promises.length; i++) {
            // When all promises have resolved, resolve the whole thing.
            promises[i].then(function(index, result) {
                resolved++;
                results[index] = result;
                if (resolved == promises.length) {
                    resolve(results);
                }
            }.bind({},i))
            // If any fail, fail the whole thing.
                .catch(function(index, result) {
                results[index] = result;
                reject(results);
            }.bind({},i));
        }
    });
};

/**
 * Sends a http request and passes the results to a callback via promises.
 * @param {string} url The target of the request.
 * @param {string} method The HTTP method.
 * @param {object} data to send with the request (only json supported atm}
 * @param {object} options to override default behaviour.
 * @returns {Promise} promise that resolves or rejects when request returns.
 */
var sendHttpRequest = function(url, method, data, options) {
    var request, type, promise,
        onPromise, onHttpResponse;
    options = options || {};

    onPromise = function(resolve, reject) {
        request = new XMLHttpRequest();
        request.addEventListener("load", function() {
            if (this.status  === 200) {
                resolve(this);
            } else {
                reject(this);
            }
        });
        if (data && (method === "GET" || method === "DELETE")) {
            url += toQueryString(data);
        }
        request.open(method, url);
        if (data && (method === "PUT" || method === "POST")) {
            type = options.type || "application/json";
            request.setRequestHeader("Content-Type", type);
            data.session_id = window.sessionId;
            data.socket_id = window.socketId;
            data = JSON.stringify(data);
            request.send(data);
        } else {
            request.send();
        }
    };

    // Don't cancel promise on close.
    if (options.isPersistent) {
        return new Promise(onPromise);
    } else {
        return newPromise(onPromise);
    }
};

/**
 * Executes all js script tags within a given element.
 * @param {HTMLElement} container the element.that may contain script tags.
 */
var evaluateScripts = function(container) {
    var scripts, i;
    scripts = container.querySelectorAll("script[type='application/javascript']");
    for (i = 0; i < scripts.length; i++) {
        eval(scripts[i].innerHTML);
    }
}

/**
 * Gets a html document from the server and sets it as containers contents.
 * @param {string} pageName name of the requested page/document.
 * @param {HTMLElement} container element to replace contents.  defaults to <body>
 * @param {object} data to send along with the call.
 * @param {options} data to affect how the call is made eg. HTTP method.
 * @returns {Promise} when complete.. 
 */
var replaceBody = function(url, container, data, options) {
   container = container || mainEl;
   url = data ? url + toQueryString(data) : url;
   url = "page/" + url;
   closePage();
   return sendHttpRequest(url, (options && options.method) || "GET")
   .then(function(result) {
       container.innerHTML = result.responseText;
       evaluateScripts(container);
   })
   .catch(function(result) {
       if (result) {
           if (!result.responseText) {
               console.error(JSON.stringify(result));
           } else {
               console.error(result.responseText);
           }
       } else {
           console.trace();
       }
   });
};

/**
 * Converts a pojo to a url query string.
 * @param {object} The object.
 * @returns {string} The & seperated query string (including ?)
 */
function toQueryString(obj) {
    var parts, i;
    parts = [];
    for (i in obj) {
        if (obj.hasOwnProperty(i)) {
            parts.push(encodeURIComponent(i) + "=" + encodeURIComponent(obj[i]));
        }
    }
    return "?" + parts.join("&");
}

function loadExternalScript(src) {
    var script;
    script = document.createElement("script");
    script.setAttribute("type", "application/javascript");
    script.setAttribute("src", src);
    mainEl.insertBefore(script, mainEl.firstChild);
};

// Sets up a websocket connection with the server.
var socketControl = function(socketAddress) {
    var socket, sendMessage, onReceiveMessage;
    socket = new WebSocket(socketAddress, "echo-protocol");
    
    /**
     * Send any message back up to the server.
     * @param {string} text The text of the message.
     */
    sendMessage = function(text) {
        socket.send(text);
    };

    /**
     * Handles messages received through the web socket.
     */
    onReceiveMessage = function(event) {
        var data, el;
        data = JSON.parse(event.data);
        if (data["session_id"]) {
            window.sessionId = data.session_id;
        }
        if (!isNaN(data["socket_id"])) {
            window.socketId = data.socket_id;
        }
    };

    socket.addEventListener("message", onReceiveMessage);
    window.socket = socket;
}(window.location.origin.replace(/https?/, "ws").replace(/\/$/, ""));

wait(function() {
    return mainEl = document.getElementById("main");
});
