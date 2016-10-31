var Class = require('../models/class.js');
var redis = require('redis');
var crypto = require('crypto');
var shasum = crypto.createHash('sha1');
var client = redis.createClient(); //creates a new client

module.exports = function(app) {
    app.get('/schedule/:hash', function(req, res, next) {
      //client.get(req.params.hash)
	  res.redirect("/");
    });
}
