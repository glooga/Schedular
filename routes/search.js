var Class = require('../models/class.js');
var redis = require('redis');
var crypto = require('crypto');
var shasum = crypto.createHash('sha1');
var client = redis.createClient(); //creates a new client

function leftPad(str, len) {
    str = "" + str;
    if (str.length >= len) {
        return str;
    }
    while (str.length < len) {
        str = "0" + str;
    }
    return str;
}

function meetsRequirement(requirement, clss) {
    var meets = 0;
    for (var i = 0; i < requirement.value.length; i++) {
        switch (requirement.type) {
            case "field of study":
                meets |= (clss.fieldofstudy == requirement.value[i]);
                break;
            case "level":
                meets |= (clss.level == requirement.value[i]);
                break;
            case "course identifier":
                meets |= (clss.coursenumber == requirement.value[i]);
                break;
            case "hours":
                var hours = parseInt(clss.coursenumber.charAt(clss.field.length));
                meets |= (hours == requirement.value[i]);
                break;
            case "unique":
                meets |= (clss.uniquenumber == requirement.value[i]);
                break;
            case "instructor":
                meets |= (clss.instructor == requirement.value[i]);
                break;
            case "status":
                meets |= (clss.status == requirement.value[i]);
                break;
            case "flags":
                for (var f = 0; f < clss.flags.length; f++) {
                    meets |= (clss.flags[f] == requirement.value[i]);
                }
                break;
            case "core":
                meets |= (clss.core == requirement.value[i]);
                break;
        }
        if (meets == 1) {
            return true;
        }
    }
    return false;
}

module.exports = function(app) {
    app.post('/search', function(req, res, next) {
        var classStack = [];
        var workingCombinations = [];
        var max = req.body.maxhours;
        var min = req.body.minhours;
        var lunchbreak = (req.body.lunchbreak === "true");
        var unavailable = JSON.parse(req.body.unavailable);
        var reqs = JSON.parse(req.body.requirements);
        unavailable.sort(function(a, b) {
            if (a.day > b.day) return 1;
            else if (a.day < b.day) return -1;
            else if (a.start != b.start) return a.start - b.start;
            else if (a.end != b.end) return a.end - b.end;
            return 0;
        });
        for (var c = 0; c < reqs.length; c++) {
            var thisReq = reqs[c];
            thisReq.value.sort(function(a, b) {
                if (a > b) return 1;
                else if (a < b) return -1;
                return 0;
            });
        }
        reqs.sort(function(a, b) {
            if (a.priority.length - b.priority.length != 0) {
                return a.priority.length - b.priority.length;
            } else if (a.type !== b.type) {
                if (a.type > b.type) return 1;
                else if (a.type < b.type) return -1;
            } else if (a.value.length != b.value.length) {
                return a.value.length - b.value.length;
            } else {
                for (var i = 0; i < a.value.length; i++) {
                    if (a.value[i] != b.value[i]) {
                        if (a.value[i] > b.value[i]) return 1;
                        else if (a.value[i] < b.value[i]) return -1;
                    }
                }
            }
            return 0;
        });

        var requirementDivider = 0;
        while (reqs[requirementDivider].priority != "regular") {
            requirementDivider++;
        }
        var hardR = reqs.slice(0, requirementDivider);
        var softR = reqs.slice(requirementDivider);

        function tryClasses(hardR, softR) {
            if (hardR == []) {
                var hours = 0; // find the total number of hours
                for (var i = 0; i < classStack.length; i++) {
                    hours += parseInt(classStack[i].coursenumber.charAt(classStack[i].fieldofstudy.length));
                }
                if (hours >= min && hours <= max) { // if the hours check out, sort the stack based on uniquenumber
                    classStack.sort(function(a, b) {
                        return a.uniquenumber - b.uniquenumber;
                    });
                    var matching = 0;
                    for (var i = 0; i < workingCombinations.length; i++) { // check to see if schedule is already included
                        currentSchedule = workingCombinations[i];
                        if (currentSchedule.length == classStack.length) {
                            for (var j = 0; j < classStack.length; j++) {
                                matching &= (classStack[j].uniquenumber === currentSchedule.uniquenumber);
                            }
                        }
                    }
                    if (lunchbreak && matching == 0) { // if necessary ensure an hour break for lunchtime (660-840) every day
                        var days = ["M", "T", "W", "TH", "F"];
                        var hasLunchBreak = [true, true, true, true, true]; // these values are true by default and turn false if there is a conflice
                        var times = [
                            [],
                            [],
                            [],
                            [],
                            []
                        ];
                        for (var c = 0; c < classStack.length; c++) { // create an array contains every time for a day
                            for (var t = 0; t < classStack.times.length; t++) {
                                times[days.indexOf(classStack.times[t])].push(classStack.times[t]);
                            }
                        }
                        for (var t = 0; t < times.length; t++) { // sort this array by time
                            times[t].sort(function(a, b) {
                                return a.start - b.start;
                            });
                            var timesToday = times[t];
                            var windo = { // create a moving window
                                day: day[t],
                                start: 660,
                                end: 720
                            };
                            while (windo.start <= 780 && !hasLunchBreak[t]) {
                                hasLunchBreak[t] = true; // assume no conflicts for the new window
                                for (var q = 0; q < timesToday.length; q++) { // check if this window conflicts with the classes for the day
                                    thisTime = timesToday[q];
                                    hasLunchBreak[t] &= ((thisTime.start < windo.start && thisTime.start <= windo.end) ||
                                        (thisTime.start > windo.start && thisTime.end >= windo.start)); // if there's a conflict, hasLunchBreak[t] is set to false
                                }
                                windo.start += 15; // shift the window
                                windo.end += 15; // if there was no collicions, get out of the loop: that day has a lunch break
                            }
                        }
                        for (var l = 0; l < hasLunchBreak.length; l++) { // make sure there's a lunch break every day
                            matching |= !hasLunchBreak[l];
                        }
                    }

                    if (matching == 0) { // if everything checks out, save the shedule into workingCombinations
                        var hash = ""; // create a hash
                        for (var i = 0; i < classStack.length; i++) {
                            var currentClass = classStack[i];
                            hash += "+" + leftPad(currentClass.uniquenumber, 5);
                        }
                        shasum.update("SCHEDULER:SCHEDULE:" + hash.substring(1)); // use a hash function on the hash
                        client.set(shasum.digest('hex'), JSON.stringify(classStack)); // add it to redis
                        client.expire(hash, 12 * 3600);
                        workingCombinations.push(classStack); // push it to workingCombinations
                    }
                    return 0;
                } else if (hours > max) {
                    return 0;
                } else if (softR == []) {
                    return 0;
                }
            }

            Class.find({year: req.body.year, season: req.body.season}).exec()
                .then(function(allClasses) {
                    var potentialClasses = [];
                    for (var i = 0; i < allClasses.length; i++) {
                        var currClass = allClasses[i];
                        var allReqs = hardR + softR;
                        for (var a = 0; a < allReqs; a++) {
                            if (meetsRequirement(allReqs[a], currClass)) {
                                potentialClasses.push(currClass);
                            }
                        }
                    }
                    return potentialClasses;
                })
                .then(function(potentialClasses) {
                    for (var i = 0; i < potentialClasses.length; i++) {
                        var poten = potentialClasses[i];
                        var noConflicts = 1;
                        var hours = parseInt(poten.coursenumber.charAt(poten.fieldofstudy.length));
                        for (var j = 0; j < classStack.length; j++) {
                            var thisClass = classStack[j];
                            hours += parseInt(thisClass.coursenumber.charAt(thisClass.fieldofstudy.length));
                            for (var k = 0; k < thisClass.times.length; k++) {
                                for (var l = 0; l < poten.times.length; l++) {
                                    var potenTime = poten.times[l];
                                    var thisTime = thisClass.times[k];
                                    if (potenTime.day == thisTime.day) {
                                        noConflicts &= ((thisTime.start < potenTime.start && thisTime.start <= potenTime.end) ||
                                            (thisTime.start > potenTime.start && thisTime.end >= potenTime.start));
                                    }
                                }
                            }
                            for (var k = 0; k < unavailable.length; k++) {
                                for (var l = 0; l < poten.times.length; l++) {
                                    var potenTime = poten.times[l];
                                    var thisTime = unavailable[k];
                                    if (potenTime.day == thisTime.day) {
                                        noConflicts &= ((thisTime.start < potenTime.start && thisTime.start <= potenTime.end) ||
                                            (thisTime.start > potenTime.start && thisTime.end >= potenTime.start));
                                    }
                                }
                            }
                            noConflicts &= (poten.coursenumber != thisClass.coursenumber);
                        }
                        if (noConflicts) {
                            var satisfies = true;
                            var fulfilled = [];
                            var hardRClone = hardR.slice();
                            var softRClone = softR.slice();

                            for (var h = hardRClone.length - 1; h >= 0; h--) {
                                if (meetsRequirement(hardRClone[h], poten)) {
                                    hardRClone.splice(h, 1);
                                }
                            }
                            for (var s = softRClone.length - 1; s >= 0; s--) {
                                if (meetsRequirement(softRClone[s], poten)) {
                                    softRClone.splice(s, 1);
                                }
                            }

                            if (hardRClone.length != hardR.length || (hardR == [] && softRClone.length != softR.length)) {
                                classStack.push(poten.toObject());
                                var hrs = 0;
                                for (var j = 0; j < classStack.length; j++) {
                                    hrs += parseInt(classStack[j].coursenumber.charAt(classStack[j].fieldofstudy.length));
                                }
                                if (hrs <= max) {
                                    tryClasses(hardRClone, softRClone);
                                }
                                classStack.pop();
                            }
                        }
                    }
                })
                .catch(function(err) {
                    console.log(err);
                });
        }

        var stringifiedReqs = JSON.stringify(max) + "+" + JSON.stringify(min) + "+" + JSON.stringify(lunchbreak) + "+" +
            JSON.stringify(unavailable) + "+" + JSON.stringify(reqs);
        shasum.update("SCHEDULER:SEARCH:" + stringifiedReqs); // use a hash function on the hash
        stringifiedReqs = shasum.digest('hex');

        client.get(stringifiedReqs, function(err, reply) {
            if (err) {
                console.log(err);
            }
            if (reply == null) {
                tryClasses(requirements);
                client.set(stringifiedReqs, JSON.stringify(workingCombinations)); // add it to redis
                client.expire(hash, 12 * 3600);
            }
            res.redirect('/search/' + stringifiedReqs);
        });

    });

    app.get('/search/:hash', function(req, res, next) {
    	client.get(stringifiedReqs, function(err, reply) {
			if (err || reply == null) {
				res.redirect('/');
			} else {
				var combinations = JSON.parse(reply),
					results = [];
				for (var i = 0; i < combinations.length; i++) {
					var result = {},
						classnames = [];
					result.timeblocks = [];
					for (var j = 0; j < combinations[i].length; j++) {
						for (var k = 0; k < combinations[i][j].times.length; k++) {
							result.timeblocks.push({
								day: combinations[i][j].day,
								//color: combinations[i][j].fieldofstudy,
								start: (combinations[i][j].times[k].start-60*6)/(60*(20-6))*100
								duration: ((combinations[i][j].times[k].end-combinations[i][j].times[k].start)-60*6)/(60*(20-6))*100
							});
							classnames.push(combinations[i][j].coursenumber);
						}
						classnames.push(combinations[i][j].coursenumber);
					}
					result.hash = ""; // [TODO]: get the actual hash
					result.classes = classnames.join(", ");
					results.push(result);
				}
				res.render('index', {
					results: results
				});
			}
		});
    });
}
