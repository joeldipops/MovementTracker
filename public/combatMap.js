(function combatMapScript() {
    var renderMap = function(data, template) {
        var x, y,
        el, newTr, newTd, button;
    
        el = document.getElementById("map");
        while(el.nextChild) {
            el.removeChild(el.nextChild);
        }

        for(y = 0; y < data.height + 1; y++) {
            newTr = document.createElement("tr");
            el.appendChild(newTr);
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
                }
            }
        }
    };
    window.renderMap = renderMap;
})();
