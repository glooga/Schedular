var fs = require('fs');
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/Schedular');
mongoose.Promise = require('bluebird');
var Class = require('./models/class.js');
Class.remove({}, function(error) { console.log(error); });

function saveFile(i) {
	var jsa = JSON.parse(fs.readFileSync('./out/classes' + i + '.json', 'utf8'));
	Class.create(jsa, function(err, objs) {
		if(err) {
			console.error(err);
			console.error("THE PROBLEM IS AT FILE: "+i);
		} else {
			if(i == 22) {
				console.log("Done!");
				return 0;
			} else {
				console.log("Done with file "+i)
				saveFile(i+1);
			}
		}
	});
}

saveFile(0);
