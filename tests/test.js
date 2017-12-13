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

ava.test("parseInt", function(t) {
    t.not(global.parseInt, window.parseInt);
    t.is(1, window.parseInt("1"));
    t.true(isNaN(window.parseInt("F")));
    t.is(15, window.parseInt("F", 16));
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