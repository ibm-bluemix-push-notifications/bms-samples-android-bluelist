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
var session = express.Router();
var bodyParser = require('body-parser');

// Internal dependencies
var keyPassManager = require('./key-pass-manager.js');
var sessioncookieutils = require('./sessioncookieutils.js');

// Use body-parser to handle JSON data
session.use(bodyParser.json());

session.route('/')
  .post(sessionLogin)
  .delete(sessionLogout);

module.exports = session;

/**
 * Session Login - obtain session cookie
 */
function sessionLogin(req, res, next) {
    console.log('#sessionLogin()');

    // Get user credentials to do work
    keyPassManager.getUserCredentials(req, function(err, userCredentials) {

        // Handle error obtaining user credentials
        if (err) {
            console.log("sessionLogin: Unable to obtain the user credentials; err = " + err.message + ".");
            return next(err);
        } else {

            // Process the session login
            processSessionLogin(req, res, next, userCredentials);

        }

    });

}

/*
 * Handle session login; obtain the session cookie.
 */
function processSessionLogin(req, res, next, userCredentials) {
    console.log('#processSessionLogin()');

    // This request is only valid if https is being used end-to-end.
    // If the incoming request is over http, then return an error indicating this.
    // If the outgoing request is over http, then return an error indicating this.
    if (req.protocol === 'http') {
        console.log("enrollSample: Incoming protocol ("+req.protocol+") from client is not https; the session cookie may not pass through.");
    } else if (userCredentials.protocol === 'http') {
        console.log("enrollSample: Outgoing protocol ("+userCredentials.protocol+") to cloudant is not https; the session cookie may not pass through.");
    }

    sessioncookieutils.createSessionCookie(userCredentials, function(err, sessionCookie, sessionBody) {

        // Handle error
        if(err) {
            console.log("processSessionLogin: An error occurred obtaining session cookie; err = " + err.message + ".");
            return next(err);
        }

        // Session cookie obtained successfully
        else {

            // Add cloudant access information to the returned body
            var jsonBody = sessionBody || {};
            jsonBody.cloudant_access = {
                protocol: userCredentials.protocol,
                host: userCredentials.host,
                port : userCredentials.port
            };

            // Add the session cookie to the body and headers.
            // We are placing this in the body in case, http is being used.
            // This allows the client to still obtain the cookie and send
            // it using https directly to cloudant.
            if (sessionCookie != null) {
                jsonBody.sessionCookie = sessionCookie;
                res.append('Set-Cookie', sessionCookie);
            }
            
            res.status(200).json(jsonBody);

        }

    });

}

/**
 * Session Logout - free session cookie
 */
function sessionLogout(req, res, next) {
    console.log('#sessionLogout()');

    // Get user credentials to do work
    keyPassManager.getUserCredentials(req, function(err, userCredentials) {

        // Handle error obtaining user credentials
        if (err) {
            console.log("sessionLogout: Unable to obtain the user credentials; err = " + err.message + ".");
            return next(err);
        } else {

            // Process the session logout
            processSessionLogout(req, res, next, userCredentials);

        }

    });

}

/*
 * Handle session logout; free the session cookie.
 */
function processSessionLogout(req, res, next, userCredentials) {
    console.log('#processSessionLogout()');

    var sessionCookie = sessioncookieutils.getSessionCookieFromHeaders(req.headers);

    sessioncookieutils.deleteSessionCookie(userCredentials, sessionCookie, function(err, sessionBody) {

        // Handle error
        if(err) {
            console.log("processSessionLogout: An error occurred obtaining session cookie; err = " + err.message + ".");
            return next(err);
        }

        // Session cookie obtained successfully
        else {

            // Pass body of command through
            var jsonBody = sessionBody || {};

            res.status(200).json(jsonBody);
            console.log("processSessionLogout: Session cookie cleared.");

        }

    });

}
