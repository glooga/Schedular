var Class = require('../models/class.js');
var redis = require('redis');
var crypto = require('crypto');
var shasum = crypto.createHash('sha1');
var client = redis.createClient(); //creates a new client
var fs = require("fs");

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

function meetsRequirement(course, requirement) {
	for (var i = 0; i < requirement.value.length; i++) {
		switch (requirement.type) {
			case "field of study":
				if (course.fieldofstudy == requirement.value[i]) return true;
				break;
			case "level":
				if (course.level == requirement.value[i]) return true;
				break;
			case "course identifier":
				if (course.coursenumber == requirement.value[i]) return true;
				break;
			case "hours":
				var hours = parseInt(course.coursenumber.charAt(course.field.length));
				if (hours == requirement.value[i]) return true;
				break;
			case "unique":
				if (course.uniquenumber == requirement.value[i]) return true;
				break;
			case "instructor":
				if (course.instructor == requirement.value[i]) return true;
				break;
			case "status":
				if (course.status == requirement.value[i]) return true;
				break;
			case "flags":
				for (var f = 0; f < course.flags.length; f++) {
					if (course.flags[f] == requirement.value[i]) return true;
				}
				break;
			case "core":
				if (course.core == requirement.value[i]) return true;
				break;
		}
	}
	return false;
}

function overlaps(a, b) {
	for (var i = 0; i < a.length; i++) {
		for (var j = 0; j < b.length; j++) {
            if (a[i].day == b[j].day) {
                if (a[i].start <= b[j].start && a[i].start <= b[j].end) return true;
                if (a[i].start >= b[j].start && a[i].end >= b[j].start) return true;
            }
		}
	}
	return false;
}

function totalHours(courses) {
	var count = 0;
	for (var i = 0; i < courses.length; i++) {
		count += parseInt(courses[i].coursenumber.charAt(courses[i].fieldofstudy.length));
	}
	return count;
}

module.exports = function(app) {
    app.post('/search', function(req, res, next) {
        var allcourses = JSON.parse(fs.readFileSync("classes0.json", "utf8")),
        	possiblestacks = [],
        	coursestack = [],
        	courses = [];
console.log(allcourses.length);
        var max = parseInt(req.body.maxhours);
        var min = parseInt(req.body.minhours);
        var lunchbreak = (req.body.lunchbreak === "true");
        var unavailable = JSON.parse(req.body.unavailable);
        var allrequirements = JSON.parse(req.body.filters);
		unavailable.sort(function(a, b) {
            if (a.day > b.day) return 1;
            else if (a.day < b.day) return -1;
            else if (a.start != b.start) return a.start - b.start;
            else if (a.end != b.end) return a.end - b.end;
            return 0;
        });
        for (var c = 0; c < allrequirements.length; c++) {
            var thisReq = allrequirements[c];
            thisReq.value.sort(function(a, b) {
                if (a > b) return 1;
                else if (a < b) return -1;
                return 0;
            });
        }
        allrequirements.sort(function(a, b) {
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

        for (var i = 0; i < allcourses.length; i++) {
        	if (allcourses[i].times.length > 0) {
        		for (var j = 0; j < allrequirements.length; j++) {
        			if (meetsRequirement(allcourses[i], allrequirements[j])/* &&
                        (allcourses[i].fieldofstudy == "CS" || allcourses[i].level == "lower")*/) {
        				courses.push(allcourses[i]);
        				break; // only add once
        			}
        		}
        	}
        }

        var reqHash = JSON.stringify(max) + "+" + JSON.stringify(min) + "+" + JSON.stringify(lunchbreak) + "+" + JSON.stringify(unavailable) + "+" + JSON.stringify(allrequirements);
        shasum = crypto.createHash('sha1');
        shasum.update("SCHEDULER:SEARCH:" + reqHash); // use a hash function on the hash
        reqHash = shasum.digest('hex');

        var schedhashes = {};

        function findCourses(requirements, level) {
        	for (var i = 0; i < courses.length; i++) {
        		var course = courses[i],
                    opencourse = course.status.indexOf("closed") == -1,
                    noconflict = true,
        			newcourse = true;
                for (var j = 0; j < coursestack.length; j++) {
                    if (coursestack[j].coursenumber == course.coursenumber) {
                        newcourse = false;
                        break;
                    }
                }
    			for (var j = 0; j < coursestack.length; j++) {
    				if (overlaps(coursestack[j].times, course.times)) {
    					noconflict = false;
    					break;
    				}
    			}
                if (newcourse && noconflict && coursestack.length < 10) {
                    var oldcoursestack = coursestack;
                    coursestack = oldcoursestack.splice();
                    coursestack.push(course);
                    // check high requirements
                    var allhighrequirementsmet = true;
                    for (var k = 0; k < allrequirements.length; k++) {
                        if (allrequirements[k].priority == "high") {
                            for (var l = 0; l < coursestack.length; l++) {
                                if (!meetsRequirement(coursestack[l], allrequirements[k])) {
                                    allhighrequirementsmet = false;
                                }
                            }
                        }
                    }
                    coursestack.sort(function(a, b) {
                        return a.uniquenumber - b.uniquenumber;
                    });
                    // create a hash
                    var hash = "";
                    for (var k = 0; k < coursestack.length; k++) {
                        hash += "+" + coursestack[k].uniquenumber;
                    }
                    /*var schedhash = crypto.createHash('sha1');
                    schedhash.update(hash);
                    hash = schedhash.digest('hex');
                    var hash = 5381, l = mash.length;
                    while(l) hash = (hash * 33) ^ mash.charCodeAt(--l);
                    hash = hash >>> 0;
                    console.log(hash);*/
                    // any requirements fulfilled?
                    if (schedhashes[hash] !== "done") {
                        schedhashes[hash] = "done";
                        for (var j = 0; j < requirements.length; j++) {
                            if (meetsRequirement(course, requirements[j])) {
                                var before = possiblestacks.length;
        						if (totalHours(coursestack) <= max) {
                                    var narrower = requirements.slice();
                                    narrower.splice(j, i);
        							if (totalHours(coursestack) >= min || narrower.length == 0) {
                                        //console.log(course);
                                        if (allhighrequirementsmet) {
                                            //client.set(schedhash.digest('hex'), JSON.stringify(coursestack)); // add it to redis
                                            //client.expire(hash, 12 * 3600);
            								possiblestacks.push(coursestack.slice());
                                        }
                                    }
        							if (narrower.length > 0) findCourses(narrower, level+1);
        						}
        						if (possiblestacks.length > before) break;
        					}
        				}
                    }
                    coursestack = oldcoursestack;
        		}
        		if (level == 0) console.log(parseInt(i/courses.length*10000)/100+"%");
        	}
        	if (level == 0) {
        		console.log(possiblestacks.length+" found, redirecting");
				client.set(reqHash, JSON.stringify(possiblestacks)); // add it to redis
				client.expire(reqHash, 12 * 3600);
        		//fs.writeFile("out.json", JSON.stringify(possiblestacks));
        		res.redirect('/search/' + reqHash);
        	}
        }

        client.get(reqHash, function(err, reply) {
			//if (err || reply == null) {
				findCourses(allrequirements, 0);
			//} else {
            //    res.redirect('/search/' + reqHash);
            //}
        });

    });

    app.get('/search/:hash', function(req, res, next) {
    	client.get(req.params.hash, function(err, reply) {
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
                            var time = combinations[i][j].times[k];
							result.timeblocks.push({
								day: time.day,
								//color: combinations[i][j].fieldofstudy,
								start: (time.start-60*6)/(60*(20-6))*100,
								duration: ((time.end-time.start))/(60*(20-6))*100
							});
						}
						classnames.push(combinations[i][j].coursenumber);
					}
					result.hash = ""; // [TODO]: get the actual hash
					result.classes = classnames.join(", ");
					results.push(result);
				}
				res.render('results', {
					results: results,
                    count: results.length
				});
			}
		});
    });
}
