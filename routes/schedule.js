module.exports = function(app) {
    app.get('/schedule/:hash', function(req, res, next) {
      res.render('index', { title: 'Express' });
    });
}
