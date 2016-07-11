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
var enroll = express.Router();
var bodyParser = require('body-parser');

// Internal dependencies
var keyPassManager = require('./key-pass-manager.js');
var databaseutils = require('./databaseutils.js');
var permissionutils = require('./permissionutils.js');
var sessioncookieutils = require('./sessioncookieutils.js');

// Use body-parser to handle JSON data
enroll.use(bodyParser.json());

// Handle session login/logout
enroll.route('/')
  .put(enrollSample)
  .delete(cleanupSample);

module.exports = enroll;

/**
 * Handle bluelist sample enroll:
 *  - create database with generated name
 *  - set permissions for given user
 *  - create session cookie for given user
 */
function enrollSample(req, res, next) {
    console.log('#enrollSample()');

    // Get admin credentials to do work
    keyPassManager.getAdminCredentials(req, function(err, adminCredentials) {

        // Handle error obtaining admin credentials
        if (err) {
            console.log("enrollSample: Unable to obtain the admin credentials.");
            return next(err);
        } else {

            // Get user name to do work
            keyPassManager.getUserId(req, adminCredentials, function(userName, isAdmin) {

                // If valid user name
                if (userName != null) {

                    // Determine database name based on user
                    databaseutils.getDatabaseName(userName, function(err, databaseName) {

                        // Handle error obtaining database name
                        if (err) {
                            return next(err);
                        } else {

                            // Process the enroll
                            processEnroll(req, res, next, adminCredentials, userName, databaseName, enrollComplete);

                        }

                    });

                }

                // Invalid user name
                else {
                    console.log("enrollSample: Could not obtain userId from security context or incoming request.");
                    err = new Error("Unable to obtain userId from the security context or the incoming request.");
                    err.status = 401;
                    return next(err);
                }

            });

        }

    });

}

/**
 * Handle bluelist sample un-enroll (cleanup):
 *  - delete session cookie for given user
 *  - remove permissions for given user
 *  - delete database with generated name
 */
function cleanupSample(req, res, next) {
    console.log('#cleanupSample()');

    // Get admin credentials to do work
    keyPassManager.getAdminCredentials(req, function(err, adminCredentials) {

        // Handle error obtaining admin credentials
        if (err) {
            console.log("cleanupSample: Unable to obtain the admin credentials.");
            return next(err);
        } else {

            // Get user name to do work
            keyPassManager.getUserId(req, adminCredentials, function(userName, isAdmin) {

                // If valid user name
                if (userName != null) {

                    // Determine database name based on user
                    databaseutils.getDatabaseName(userName, function(err, databaseName) {

                        // Handle error obtaining database name
                        if (err) {
                            return next(err);
                        } else {

                            // Process the cleanup
                            processCleanup(req, res, next, adminCredentials, userName, databaseName);

                        }

                    });

                }

                // Invalid user name
                else {
                    console.log("cleanupSample: Could not obtain userId from security context or incoming request.");
                    err = new Error("Unable to obtain userId from the security context or the incoming request.");
                    err.status = 401;
                    return next(err);
                }

            });

        }

    });

}

/*
 * Enroll the user for the BlueList sample:
 *  - create BlueList sample database
 *  - set user permissions
 *  - obtain session cookie
 */
function processEnroll(req, res, next, adminCredentials, userName, databaseName, callback) {
    console.log('#processEnroll()');

    // Create the BlueList sample database
    databaseutils.createDatabase(adminCredentials, databaseName, function(err) {

        // Handle error
        if(err) {
            console.log("processEnroll: An error occurred creating database("+databaseName+"); err = " + err.message + ".");
            callback( err, null, null, req, res, next, adminCredentials, null, userName, databaseName, null, null );
        }

        // If no error so far, set permissions
        else {

            // Set permissions
            permissionutils.setPermissions(adminCredentials, userName, databaseName, function(err) {

                // Handle error
                if(err) {
                    console.log("processEnroll: An error occurred setting permissions for user ("+userName+") for database("+databaseName+"); err = " + err.message + ".");
                    callback( null, err, null, req, res, next, adminCredentials, null, userName, databaseName, null, null );
                }

                // If no error so far, create session cookie
                else {

                    // Obtain user credentials
                    keyPassManager.getUserCredentials(req, function(err, userCredentials) {

                        // Handle error obtaining credentials
                        if (err) {
                            console.log("processEnroll: Unable to obtain the user credentials; err = " + err.message + ".");
                            callback( null, err, null, req, res, next, adminCredentials, null, userName, databaseName, null, null );
                        } else {

                            // This request is only valid if https is being used end-to-end.
                            // If the incoming request is over http, then return an error indicating this.
                            // If the outgoing request is over http, then return an error indicating this.
                            if (req.protocol === 'http') {
                                console.log("enrollSample: Incoming protocol ("+req.protocol+") from client is not https; the session cookie may not pass through.");
                            } else if (userCredentials.protocol === 'http') {
                                console.log("enrollSample: Outgoing protocol ("+userCredentials.protocol+") to cloudant is not https; the session cookie may not pass through.");
                            }

                            // Create session
                            sessioncookieutils.createSessionCookie(userCredentials, function(err, sessionCookie, sessionBody) {

                                // Handle error
                                if(err) {
                                    console.log("processEnroll: An error occurred obtaining session cookie for user ("+userName+"); err = " + err.message + ".");
                                    callback( null, null, err, req, res, next, adminCredentials, userCredentials, userName, databaseName, null, null );
                                }

                                // Handle success; send response
                                else {
                                    callback( null, null, null, req, res, next, adminCredentials, userCredentials, userName, databaseName, sessionCookie, sessionBody );
                                }

                            });

                        }

                    });

                }

            });

        }

    });

}

/*
 * Handle completion of enroll.
 * If an error occurred, try to clean everything up and return the error.
 * Otherwise, send the successful response.
 */
function enrollComplete(databaseErr, permissionsErr, sessionErr, req, res, next, adminCredentials, userCredentials, userName, databaseName, sessionCookie, sessionBody) {
    console.log('#enrollComplete()');

    // If session, permission or database error, then attempt to delete the database
    // If any error occurred, attempt to undo everything and send back error
    if (sessionErr || permissionsErr || databaseErr) {

        // If session or permission error, then attempt to remove the permissions
        if (sessionErr || permissionsErr) {

            // If session error, then attempt to clear the session cookie
            if (sessionErr) {

                // Attempt to remove the session cookie if there was a problem
                sessioncookieutils.deleteSessionCookie(userCredentials, sessionCookie, function(err, sessionBody) {
                    if (err) {
                        console.log( "enrollComplete: Error occurred clearing session cookie for user ("+userName+"); err = " + err.message + ".");
                    }
                    else {
                        console.log( "enrollComplete: Session cookie cleared for user ("+userName+").");
                    }
                });

            }

            // Remove the permissions
            permissionutils.removePermissions(adminCredentials, userName, databaseName, function(err) {
                if (err) {
                    console.log( "enrollComplete: Error occurred removing permissions for user ("+userName+") for database ("+databaseName+"); err = " + err.message + ".");
                }
                else {
                    console.log( "enrollComplete: Permissions removed for user ("+userName+") for database ("+databaseName+").");
                }
            });

        }

        // Attempt to delete the newly created database and views
        databaseutils.deleteDatabase(adminCredentials, databaseName, function(err) {
            if (err) {
                console.log( "enrollComplete: Error occurred deleting database ("+databaseName+"); err = " + err.message + ".");
            }
            else {
                console.log( "enrollComplete: Deleted database ("+databaseName+").");
            }
        });

        // Pass on the original error
        next( ( sessionErr ? sessionErr : ( permissionsErr ? permissionsErr : databaseErr ) ) );

    }

    // If no error, then return payload with database name, cloudant info, and the session cookie
    else {
        console.log( "enrollComplete: Enroll processed successfully.");

        // Add cloudant access information to the returned body
        var jsonBody = sessionBody || {};
        jsonBody.cloudant_access = {
            protocol: userCredentials.protocol,
            host: userCredentials.host,
            port : userCredentials.port
        };
        jsonBody.database = databaseName;

        // Add the session cookie to the body and headers.
        // We are placing this in the body in case, http is being used.
        // This allows the client to still obtain the cookie and send
        // it using https directly to cloudant.
        if (sessionCookie != null) {
            jsonBody.sessionCookie = sessionCookie;
            res.append('Set-Cookie', sessionCookie);
        }

        // Send response
        res.status(200).json(jsonBody);

    }

}

/**
 * Handle BlueList sample un-enroll (cleanup).
  - delete session cookie for given user
  - remove permissions for the given user
  - delete database
 */
 function processCleanup(req, res, next, adminCredentials, userName, databaseName) {
    console.log('#processCleanup()');

    // Create database
    var errorFlag = false;
    var rootError;

    // Obtain user credentials
    keyPassManager.getUserCredentials(req, function(err, userCredentials) {

        // Handle error obtaining credentials
        if (err) {
            console.log( "processCleanup: Error obtaining user credentials; skip deleting session cookie; err = " + err.message + ".");
            userCredentials = null;
        } 

        var sessionCookie = sessioncookieutils.getSessionCookieFromHeaders(req.headers);

        // Remove the session cookie
        sessioncookieutils.deleteSessionCookie(userCredentials, sessionCookie, function(err,sessionBody) {

            // Handle error
            if (err) {
                rootError = err;
                errorFlag = true;
                console.log( "processCleanup: Error occurred clearing session cookie for user ("+userName+"); err = " + err.message + ".");
            }
            else {
                console.log( "processCleanup: Session cookie for user ("+userName+") cleared.");
            }

            // Remove the permissions
            permissionutils.removePermissions(adminCredentials, userName, databaseName, function(err) {

                // Handle error
                if (err) {
                    if (!rootError) rootError = err;
                    errorFlag = true;
                    console.log( "processCleanup: Error occurred removing permissions for user ("+userName+") for database ("+databaseName+"); err = " + err.message + ".");
                }
                else {
                    console.log( "processCleanup: Permissions removed for user ("+userName+") for database ("+databaseName+").");
                }

                // Attempt to delete the newly created database and views
                databaseutils.deleteDatabase(adminCredentials, databaseName, function(err) {

                    // Handle error
                    if (err) {
                        if (!rootError) rootError = err;
                        errorFlag = true;
                        console.log( "processCleanup: Error occured deleting database ("+databaseName+"); err = " + err.message + ".");
                    }
                    else {
                        console.log( "processCleanup: Deleted database ("+databaseName+").");
                    }

                    // If any error occurred send back error
                    if (errorFlag) {

                        // Pass on the original error
                        next(rootError);

                    }

                    // If no error, then return 
                    else {

                        // Send response
                        var jsonBody = sessionBody || {};
                        res.status(200).json(jsonBody);
                        console.log( "processCleanup: Cleanup processed successfully.");

                    }
                    
                });

            });

        });

    });

 }
