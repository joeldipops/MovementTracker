var DEFAULT,
onEvent, closePage, newPromise;

DEFAULT = false;

var a = function() {
    var _pageEvents, _pendingPromises;
    _pageEvents = [];
    _pendingCancelFlags = [];

    /**
     * Keeps track of page-level events so they can be unbound later. 
     * @param {EventTarget} target to bind event.
     * @param {string} event name of event.
     * @param {function} callback when event is fired.
     */
    onEvent = function(target, event, handler) {
        target.addEventListener(event, handler);
        _pageEvents.push(target.removeEventListener.bind(target, event, handler));
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
    }
    
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
   container = container || document.getElementById("main");
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
           console.error(result.responseText);
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

// Sets up a websocket connection with the server.
var socketControl = function(socketAddress) {
    var socket, onSendMessage, onReceiveMessage;
    socket = new WebSocket(socketAddress, "echo-protocol");
    
    onSendMessage = function() {
        var text = document.querySelector("[name='message']").value    
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
