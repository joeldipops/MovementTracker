(function utils() {
    var nativeParseInt, nativeSetTimeout, U;

    if (!window.MovementTracker) {
        window.MovementTracker = {};
    }

    U = window.MovementTracker.utils = {
        /**
         * Makes a clone of an object or array.
         * @param {object} object
         * @param {boolean} full also copies the prototype etc.
         * @returns {object} the clone.
         */
        clone : function(object, full) {
            var k, result;

            switch (typeof object) {
                case "object":
                    break;
                case "string":
                case "boolean":
                case "number":
                case "undefined":
                    return object;
                case "function":
                default:
                    throw "Not implemented";
            }

            if (object === null) {
                return null;
            }

            if (Array.isArray(object)) {
                result = [];
                
                for (k = 0; k < object.length; k++) {
                    result.push(object[k]);
                }
                return result;
            } else {
                result = {};

                for (k in object) {
                    if(!full && !object.hasOwnProperty(k)) {
                        continue;
                    }
                    result[k] = object[k];
                }
                return result;
            }
        },

        /**
         * Checks if value is a ntural number,
         * @param {number} value to check.
         * @returns {boolean} true if 0 or a postive integer, false otherwise.
         */
        isNatural : function(value) {
            return Number.isInteger(value) && value >= 0;
        },

        /**
         * Repeatedly calls a function until it succeeds.
         * Used when waiting for a resource to exist.
         * @param {function} callback, function must return truthy on success and falsy otherwise.
         */
        wait : function(callback) {
            if (!callback()) {
                setTimeout(window.MovementTracker.utils.wait.bind({}, callback), 50);
            }
        },

        /**
         * Checks that two ids that may be either ids or strings are equal.
         * @param {number|string} id1
         * @param {number|string} id2
         * @returns {boolean} true if same id.
         */
        isEqual : function(id1, id2) {
            if (isNaN(id1 && id2)) {
                return false;
            }
            id1 = (typeof id1 === "string") ? id1 : id1.toString();
            id2 = (typeof id2 === "string") ? id2 : id2.toString();
            return id1 === id2;
        },

        /**
         * Converts a pojo to a url query string.
         * @param {object} The object.
         * @returns {string} The & seperated query string (including ?)
         */
        toQueryString : function(obj) {
            var parts, i;
            parts = [];
            for (i in obj) {
                if (obj.hasOwnProperty(i)) {
                    parts.push(encodeURIComponent(i) + "=" + encodeURIComponent(obj[i]));
                }
            }
            return "?" + parts.join("&");
        }
    };
 })();
