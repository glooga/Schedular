module.exports = function(app) {
	require("./index.js")(app);
	require("./search.js")(app);
	require("./schedule.js")(app);
};
