var Class = require('./class.js');

function tryClasses(reqs) {
    if (reqs == []) {
        var hours = 0;
        for (var i = 0; i < classStack.length; i++) {
            hours += parseInt(classStack[i].courseIdentifier.substring(classStack[i].field).charAt(0));
        }
        if (hours >= min) {
            workingCombinations.push(classStack);
            return 0;
        } else {
            reqs.push({
                type: "more hours"
            });
        }
    }

    Class.find(year: year, season: season).exec()
        .then(function(potentialClasses) {
            for (var i = 0; i < potentialClasses.length; i++) {
                var poten = courseIdentifier[i];
                var noConflicts = 1;
                var hours = parseInt(poten.courseIdentifier.substring(poten.field).charAt(0));
                for (var j = 0; j < classStack, j++) {
                    var thisClass = classStack[j];
                    hours += parseInt(thisClass.courseIdentifier.substring(thisClass.field).charAt(0));
                    for (var k = 0; k < 5; k++) {
                        var S1 = thisClass.times[k].start;
                        var S2 = poten.times[k].start;
                        var E1 = thisClass.times[k].end;
                        var E2 = poten.times[k].end;
                        noConflicts &= ((S2 > S1) && (E2 > S1)) || ((S2 < S1) && (S2 < E1));
                    }
                    noConflicts &= (poten.courseIdentifier != thisClass.courseIdentifier);
                }
                if (noConflicts) {
                    var satisfies = true;
                    var fulfilled = [];
                    var newReqs = reqs.splice();
                    // do stuff here to see if a req is satisfied - index of satisfied reqs goes into fulfilled
                    for (var j = fulfilled.length - 1; j >= 0; j--) {
                        newReqs.slice(fulfilled[j], 1)
                    }
                    classStack.push(poten);
                    var hrs = 0;
                    for (var j = 0; j < classStack.length; j++) {
                        hrs += classStack[j].courseNumber.charAt(0);
                    }
                    if (hrs <= max) {
                        tryClasses(newReqs);
                    }
                    classStack.pop();
                }
            }
        })
        .catch(function(err) {
            console.log(err)
        });
}
