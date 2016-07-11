/*
 * IBM Confidential OCO Source Materials
 *
 * 5725-I43 Copyright IBM Corp. 2014, 2015
 *
 * The source code for this program is not published or otherwise
 * divested of its trade secrets, irrespective of what has
 * been deposited with the U.S. Copyright Office.
 *
*/

// External dependencies
var express = require('express');
var customoauth = express.Router();
var bodyParser = require('body-parser');
var passport = require('passport');
var ImfBackendStrategy = require('passport-imf-token-validation').ImfBackendStrategy;

passport.use(new ImfBackendStrategy());

// setup middleware
customoauth.use(passport.initialize());

// Use body-parser to handle JSON data
customoauth.use(bodyParser.json());

customoauth.use(function(req,res,next){
  console.log("Request: "+req.method+" "+req.path);
  next();
});

customoauth.post('/:tenantID/customAuthRealm_1/startAuthorization',
    passport.authenticate('imf-backend-strategy', {session: false }),
    function(req, res) {
    console.log ("tenantID " + req.param("tenantID"));
        var returnedJSON = startAuthorization(req.body.headers);
        res.json(returnedJSON);
    });

customoauth.post('/:tenantID/customAuthRealm_1/handleChallengeAnswer',
    passport.authenticate('imf-backend-strategy', {session: false }),
    function(req, res) {
    console.log("tenantID " + req.param("tenantID"));
        var returnedJSON = handleChallengeAnswer(req.body.headers, req.body.stateId, req.body.challengeAnswer);
        res.json(returnedJSON);
    });

var users = {
    "james": {
        password: "42",
        displayName: "James"
    },
    "yotam": {
        password: "456",
        displayName: "Yotam"
    }
};

var startAuthorization = function(headers) {
    return {
        status: "challenge",
        challenge: {
            message: "wrong_credentials"
        }, stateId : "teststateid"
    };
};

var handleChallengeAnswer = function(headers, stateId, challengeAnswer) {
    console.log('State id ' + stateId);
    if (challengeAnswer && users[challengeAnswer.userName] && challengeAnswer.password === users[challengeAnswer.userName].password) {
        return {
            status: "success",
            userIdentity: {
                userName: challengeAnswer.userName,
                displayName: users[challengeAnswer.userName].displayName
            }
        };
    } else {
        return {
            status: "challenge",
            challenge: {
                message: "wrong_credentials"
            }
        };
    }
};

module.exports = customoauth;
