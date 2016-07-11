/*
 * IBM Confidential OCO Source Materials
 *
 * 5725-I43 Copyright IBM Corp. 2015
 *
 * The source code for this program is not published or otherwise
 * divested of its trade secrets, irrespective of what has
 * been deposited with the U.S. Copyright Office.
 *
*/

// External dependencies
var express = require('express');
var router = express.Router();
var underscore = require('underscore');

// Internal dependencies
var bluelist = require('./bluelist/bluelist.js');

// Logs incoming requests
router.use(function(req, res, next) {
    var cloneHeaders = {};
    if (req.headers) {
        cloneHeaders = underscore.clone(req.headers);
        if (cloneHeaders.authorization) {
            delete cloneHeaders.authorization;
            cloneHeaders.authorization = '**************';
        }
    }

    console.log('Incoming request: %s %s %s\nHeaders: %j\n', req.method, req.protocol, req.url, cloneHeaders, {});
    next();
});

// Routes all /bluelist related traffic
router.use('/bluelist', bluelist);

// If custom oauth enabled, routes all /apps related traffic
var cpString = process.env.ENABLE_CUSTOM_PROVIDER || 'yes';
if ( cpString === 'yes' ) {
    var customoauth = require('./customoauthprovider/customoauth.js');
    router.use('/apps', customoauth);
    console.log("Using customoauth provider.");
}

// Displays current version of server APIs
router.get('/', function(req, res) {
    res.status(200).json({
        bluelistproxy: "ok",
        customoauthprovider: ( cpString === 'yes' ? "ok" : "disabled"),
        version: 1
    });
});

// Returns 404s for all other routes
router.use(function(req, res, next) {
    var err = new Error("Request is not supported.");
    err.status = 404;
    next(err);
});


/*
 * Error Handlers
 */

// Logs error and responds to client
router.use(function(err, req, res, next){
    console.log('Error - %s: %s', err.name, err.message);
    res.status(err.status || 500).json({
        status: 'error',
        message: err.message,
    });
    next(err);
});

module.exports = router;
