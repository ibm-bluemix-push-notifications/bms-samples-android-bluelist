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
var crypto = require('crypto');
var NodeCache = require('node-cache');
var underscore = require('underscore');

// Internal dependencies

// Cache of userId --> user credentials
var userCache = new NodeCache({
  checkperiod: 1
});


// Set up admin credentials from VCAP_SERVICES
var adminCreds = null;
var vcapServices = JSON.parse(process.env.VCAP_SERVICES || "{}");
var cloudantNoSQLDB = [];
if (vcapServices) {
  for (var key in vcapServices) {
    if (key.lastIndexOf('cloudantNoSQLDB',0) === 0) { 
      cloudantNoSQLDB = vcapServices[key]; 
      break;
    }
  }
}
if ( cloudantNoSQLDB.length > 0 ) {
  var vcapCreds = cloudantNoSQLDB[0].credentials;
  var protocol = "https";
  if (vcapCreds.url) {
    var protocolSepIndex = vcapCreds.url.indexOf("://");
    if (protocolSepIndex >= 0) {
      protocol = vcapCreds.url.substring(0,protocolSepIndex);
    }
  }
  adminCreds = {
        protocol: protocol,
        host: vcapCreds.host,
        port: vcapCreds.port,
        username: vcapCreds.username,
        password: vcapCreds.password,
        auth: vcapCreds.username + ':' + vcapCreds.password
  };
  console.log("key-pass-manager init: Obtaining admin credentials from VCAP environment variables; host = " + adminCreds.host);
}

// Initialize constants
var USER_PREFIX = 'org.couchdb.user:';
var USER_PREFIX_LEN = USER_PREFIX.length;

/*
 * Encrypt given data with given salt.
 */
function encryptWithSalt(data, salt) {
  console.log('#encryptWithSalt');

    var cipher = crypto.createCipher('aes256', salt);
    var encrypted = cipher.update(data, 'utf8', 'hex') + cipher.final('hex');
    return encrypted;
}

/*
 * Decrypt given data with given salt.
 */
function decryptWithSalt(data, salt) {
  console.log('#decryptWithSalt');
  
    var decipher = crypto.createDecipher('aes256', salt);
    var decrypted = decipher.update(data, 'hex', 'utf8') + decipher.final('utf8');
    return decrypted;
}

/*
 * Obtain the admin credentials.
 */
function getAdminCredentials(req, callback) {
    console.log('#getAdminCredentials()');

    // Use the cached admin credentials if available
    if (adminCreds != null) {
        credentials = underscore.clone(adminCreds);
        callback(null, credentials);
    }

    // If the VCAO env vars are not available return error
    else { /* missing VCAP_SERVICES definition */
        err = new Error("Unable to obtain the admin credentials from the VCAP_SERVICES environment variable.");
        err.status = 503;
        console.log("getAdminCredentials: Unable to obtain admin credentials from VCAP environment variables");
        callback(err, null);
    }

}

/*
 * Obtain the user credentials associated with the request.
 */
function getUserCredentials(req, callback) {
    console.log('#getUserCredentials()');

    // Start with the admin credentials
    getAdminCredentials(req, function(err, credentials) {

        // Handle error
        if (err) {
            callback(err);
        } 

        // Handle successfully obtaining admin credentials
        else {

            // Determine the userId from the security context
            getUserId(req, credentials, function(userId, isAdmin) {

                // If admin user, just return admin credentials
                if (isAdmin) {
                    console.log("getUserCredentials: User ("+userId+") is an admin user; using the admin credentials");
                    callback(null, credentials);
                    return;
                }

                // If userId not found, return error
                else if (userId == null) {
                    console.log("getUserCredentials: Unable to obtain userId from security context or incoming request");
                    err = new Error("Unable to obtain userId from the security context or the incoming request.");
                    err.status = 401;
                    callback(err);
                    return;
                }

                // If empty userId, return security credentials with no user/password
                // in case credentials are not required
                else if (userId.length === 0) {
                    console.log("getUserCredentials: User ("+userId+") is empty; set credentials without user/password in case it is not required");
                    var creds = {
                        protocol: credentials.protocol,
                        host: credentials.host,
                        port: credentials.port
                    };
                    callback(null, creds);
                    return;
                }

                // If valid userId, get credentials for this user from the _users database (or cache)
                else {

                    // If we already cached the user credentials, return them
                    var creds = userCache.get(userId);
                    if (Object.keys(creds).length !== 0) {
                        creds = underscore.clone(creds[userId]);
                        callback(null, creds);
                    } 

                    // Obtain password information from the _users database
                    else {

                        var cloudant = require('cloudant')(credentials.protocol + '://' + credentials.auth + '@' + credentials.host + ':' + credentials.port);
                        var db = cloudant.use('_users');

                        // Create the database
                        console.log("getUserCredentials: Getting user credentials for: " + userId);
                        db.get(USER_PREFIX + userId, function(err, body) {

                            // Handle request error
                            if (err) { 

                                // Error creating database
                                console.log("getUserCredentials: Failed to obtain valid credentials for user ("+userId+"); error = " + err.message);
                                err = new Error("Failed to obtain valid credentials for user ("+userId+"); error = "+JSON.stringify(err)+".");
                                err.status = 401;
                                callback(err);

                            }

                            // Successfully obtained user info, build creds and cache them
                            else {
                                console.log("getUserCredentials: Obtained user credentials for: " + userId + " successfully.");

                                // Pull password from response
                                var _id = body._id;
                                var username = _id.substring(USER_PREFIX_LEN);
                                var user_password_salt = body.salt;
                                var user_encrypted_password = body.password;
                                var user_password = decryptWithSalt(user_encrypted_password, user_password_salt);

                                // Build creds
                                creds = {
                                    protocol: credentials.protocol,
                                    host: credentials.host,
                                    port: credentials.port,
                                    username: username,
                                    password: user_password,
                                    auth: username + ':' + user_password
                                };
                                // Dump the credentials; only use if debugging
                                //console.log('user_cred=' + JSON.stringify(creds));

                                // Cache creds
                                userCache.set(userId, creds, 180);

                                // Return creds
                                console.log("getUserCredentials: Obtained valid credentials for user ("+userId+") ");
                                callback(null, creds);
                            }
                            
                        });
                    }
                }
            });
        }
    });
}

/*
 * Removes cached information about a user.
 */
function clearUserCredentials(userId) {
    console.log('#clearUserCredentials');

    if(userId) {
        console.log("clearUserCredentials: User ("+userId+") credentials cleared from cache");
        userCache.del(userId);
    }

    else {
        console.log("clearUserCredentials: Unable to clear user credentials; no userId provided");
    }

}

/*
 * Obtains user id from the security context.
 */
function getUserId(req, adminCredentials, callback) {
    console.log('#getUserId()');

    // Make sure we have a valid security context
    if (req.securityContext) {
        // Dump the security; only use if debugging
        //console.log('getUserId: securityContext=' + JSON.stringify(req.securityContext));

        // Obtain sub 
        var sub = req.securityContext["imf.sub"];

        // No sub
        if (!sub) {
            console.log('getUserId: securityContext[imf.sub] does not exist.');
            callback (null, false);
        }

        // If admin user, obtain userId from admin credentials
        else if (sub.indexOf("com.ibm.imf") >= 0) {
            var authParts = (adminCredentials.auth ? adminCredentials.auth.split(':') : []);
            var userId = (authParts.length > 1 ? authParts[0] : null);
            console.log('getUserId: securityContext[imf.sub]=' + sub + '; userId ('+userId+') is an admin user.');
            callback(userId, true);
        }

        // If not admin user, obtain userId from sub
        else {
            var colonLocation = sub.indexOf(':');

            // If no userId
            if (colonLocation === 0) {
                console.log('getUserId: securityContext[imf.sub]=' + sub + ' has empty user.');
                callback ('', false);
            }

            // Handle non-empty userId
            else if (colonLocation > 0) {
                var userId = sub.substring(0, colonLocation);
                console.log('getUserId: securityContext[imf.sub]=' + sub + ' contains user ' + userId +'.');
                callback (userId, false);
            }

            // Handle sub without a colon
            else {
                console.log('getUserId: securityContext[imf.sub]=' + sub + ' has no colon and no user.');
                callback (null, false);
            }

        }

    }

    // If oauth not being used, get userid from payload
    else if ( req.body  &&  req.body.username ) {
        console.log('getUserId: Obtained user ('+req.body.username+') from request payload.');
        callback(req.body.username,false);
        return;
    }

    // Handle no auth; just return 'yotam'
    else if (process.env.NO_AUTH) {
        console.log('getUserId: NO_AUTH set, return yotam');
        callback('yotam',false);
        return;
    }

    // Handle missing security context
    else {
        console.log('getUserId: Missing security context and no user.');
        callback (null, false);
    }

}


exports.encryptWithSalt = encryptWithSalt;
exports.decryptWithSalt = decryptWithSalt;
exports.getAdminCredentials = getAdminCredentials;
exports.getUserCredentials = getUserCredentials;
exports.clearUserCredentials = clearUserCredentials;
exports.getUserId = getUserId;