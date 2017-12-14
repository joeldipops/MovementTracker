var utils, ava;
ava = require("ava");
ava.test.beforeEach(function() {
    require("./helpers/setup-browser-env.js");
    global.WebSocket = require("mock-socket").WebSocket;
    window.setTimeout = global.setTimeout;
    window.parseInt = global.parseInt;
    utils = require("../public/utils.js");
});

ava.after.always(function(){
    delete global.window;
    delete global.WebSocket;
});

ava.test("isNatural", function(t) {
    var obj = window.MovementTracker.utils;

    t.false(obj.isNatural(-1));
    t.true(obj.isNatural(0));
    t.true(obj.isNatural(1));
    t.true(obj.isNatural(0.0));
    t.true(obj.isNatural(1.0));
    t.false(obj.isNatural(1.1));
    t.true(obj.isNatural(-0));
    t.false(obj.isNatural('somestring'));
    t.false(obj.isNatural(true));
    t.false(obj.isNatural(NaN));
});

/*
ava.test("parseInt", function(t) {
    t.not(global.parseInt, window.parseInt);
    t.is(1, window.parseInt("1"));
    t.true(isNaN(window.parseInt("F")));
    t.is(15, window.parseInt("F", 16));
});
*/

ava.test("valueEquals", function(t) {
    var obj = window.MovementTracker.utils;

    t.true(obj.valueEquals(1, 1));
    t.true(obj.valueEquals(null, null));
    t.true(obj.valueEquals(void 0, undefined));
    t.false(obj.valueEquals(null, undefined));
    t.true(obj.valueEquals(false, false));
    t.false(obj.valueEquals(true, false));
    t.true(obj.valueEquals("", ""))
    t.false(obj.valueEquals(1, "1"));
    t.true(obj.valueEquals("Hello", "Hello"));
    t.false(obj.valueEquals("Hello", "World"));

    t.true(obj.valueEquals([], []));
    t.true(obj.valueEquals({}, {}));
    t.false(obj.valueEquals([], {}));
    t.false(obj.valueEquals({}, []));
    t.false(obj.valueEquals([], ""));
    t.false(obj.valueEquals("", []));

    t.true(obj.valueEquals(
        ["one", 2, "3"],
        ["one", 2, "3"]
    ));

    t.false(obj.valueEquals(
        ["one", 2, "3"],
        ["one", 2, "3", 4]
    ));

    t.false(obj.valueEquals(
        ["one", 2, "3", 4],
        ["one", 2, "3"]
    ));

    t.false(obj.valueEquals(
        ["one", 2, "3"],
        ["3", "one", 2],
    ));

    t.true(obj.valueEquals(
        { "a" : 1, "b" : 2 },
        { b : 2, a : 1 }
    ));

    t.false(obj.valueEquals(
        { "a" : 1 },
        { "a" : 2 }
    ));

    t.true(obj.valueEquals(
        { "a" : 1, "b" : { "c" : 3 }},
        { "b" : { "c": 3 }, "a" : 1 }
    ));
    

    var f = function() {};
    f.prototype.foo = function() {};

    var g = function() {};
    g.prototype.bar = function() {};
    
    var first = new f();
    var second = new f();

    first.a = "abc";
    second.a = "abc";

    t.true(obj.valueEquals(first, second));

    var second = new g();
    second.a = "abc";

    t.false(obj.valueEquals(first, second));
});

ava.test("clone", function(t) {
    var obj, input, output;
    var obj = window.MovementTracker.utils;
    input = { "a" : 1, "b" : { "c" : 3 }};
    output = obj.clone(input);

    t.not(input, output);
    t.true(obj.valueEquals(input, output));

    t.fail("Test not complete");
});

ava.test("isEqual", function(t) {
    var obj= window.MovementTracker.utils;
    t.true(obj.isEqual(1, 1));
    t.false(obj.isEqual(1, -1));
    t.true(obj.isEqual("1", "1"));
    t.false(obj.isEqual("1", "-1"));
    t.true(obj.isEqual(1, "1"));
    t.true(obj.isEqual("-1", -1));
});

ava.test("toQueryString", function(t) {
    var obj, input, output;
    obj = window.MovementTracker.utils;
    input = {};
    output = obj.toQueryString(input);

    t.true(typeof output === "string");
    t.is("?", output);
    
    input = { key : "value" };
    output = obj.toQueryString(input);

    t.is("?key=value", output);

    input = { key : "value", question : "answer" };
    output = obj.toQueryString(input);
    t.true(output.indexOf("key=value") >= 0);
    t.true(output.indexOf("question=answer") >= 0);
    t.true(output.startsWith("?"));
    t.true(output.indexOf("&") >= 0);
    t.is(26, output.length);
});

ava.test("wait", async function(t) {
    var b, i, fn, obj;

    obj = window.MovementTracker.utils;

    i = 0;
    b = false;

    obj.wait(function() {
        console.log(i, ",", b);
        if (i === 0) {

            b = true;
        }
        if (i > 1) {
            t.fail();
        }
        if (i === 1) {
            if (b) {
                t.pass();
            }
            i++;
        }

        return i
    });

    i = 1;
    await new Promise(function(resolve, reject) {
        global.setTimeout(function() {
            resolve();
        }, 500);
    });
});
/*
ava.test("onEvent tests", function(t) {
    var div1, div2
    div1 = document.createElement("div");
    
    window.core.onEvent(div1, "click", function() {
        t.pass();
    });

    div1.click();
    t.fail();

    //document.bodyElement.appendChild(div);
});
*/