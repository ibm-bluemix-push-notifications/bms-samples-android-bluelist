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
var bluelist = express.Router();

// Internal dependencies
var enroll = require('./enroll.js');
var sessioncookie = require('./sessioncookie.js');


// Setup security filter
var passport_auth_func = function() {
    console.log('Authentication is disabled.');
    return function(req, res, next) {
      next();
    };
}
if (!process.env.NO_AUTH) {
    var passport = require('passport');
    var ImfStrategy = require('passport-imf-token-validation').ImfBackendStrategy;
    passport.use(new ImfStrategy());
    bluelist.use('/api/v1/apps/', passport.initialize());
    passport_auth_func = function() {
        console.log('Authentication is enabled.');
        return passport.authenticate('imf-backend-strategy', {
            session: false
        });
    };
}
var passport_auth = passport_auth_func();

// Routes enroll traffic
bluelist.use('/enroll', passport_auth, enroll);

// Routes sessioncookie traffic
bluelist.use('/sessioncookie', passport_auth, sessioncookie);

// Displays current version of server APIs
bluelist.get('/', function(req, res) {
    res.status(200).json({
        bluelist: "ok",
        version: 1
    });
});

module.exports = bluelist;
