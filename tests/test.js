var core, ava;
ava = require("ava");
ava.test.beforeEach(function() {
    require("./helpers/setup-browser-env.js");
    global.WebSocket = require("mock-socket").WebSocket;
    window.setTimeout = global.setTimeout;
    core = require("../public/client.js")
});

ava.after.always(function(){
    delete global.window;
    delete global.WebSocket;
});

ava.test("isNatural tests", function(t) {
    t.is(window.core.isNatural(-1), false);
    t.is(window.core.isNatural(0), true);
    t.is(window.core.isNatural(1), true);
    t.is(window.core.isNatural(0.0), true);
    t.is(window.core.isNatural(1.0), true);
    t.is(window.core.isNatural(1.1), false);
    t.is(window.core.isNatural(-0), true);
    t.is(window.core.isNatural('somestring'), false);
    t.is(window.core.isNatural(true), false);
    t.is(window.core.isNatural(NaN), false);
});

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