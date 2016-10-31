var mongoose = require('mongoose');

var classSchema = mongoose.Schema({
	uniquenumber: {type: Number, unique: true, required: true},
	name: {type: String, unique: false, required: true},
	coursenumber: {type: String, unique: false, required: true},
	fieldofstudy: {type: String, unique: false, required: true},
	//level: {type: Number, unique: false, required: false},
	instructor: {type: String, unique: false, required: false},
	status: {type: String, unique: false, required: false},
	flags: [{type: String, required: false, unique: false}],
	core: {type: String,  unique: false, required: false},
	//description: {type: String, unique: false, required: false},
	year: {type: Number, unique: false, required: true},
	season: {type: String, unique: false, required: true},
	times: [{
		day: {type: String, unique: false, required: false},
		start: {type: Number, unique: false, required: false},
		end: {type: Number, unique: false, required: false},
		room: {type: String, unique: false, required: false}
	}]
});

module.exports = mongoose.model('Class', classSchema);
