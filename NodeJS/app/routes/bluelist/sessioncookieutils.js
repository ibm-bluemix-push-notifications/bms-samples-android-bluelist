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

// Internal dependencies


/*
 * Obtain and return the session cookie on behalf of user.
 */
function createSessionCookie(userCredentials, callback) {
    console.log('#createSessionCookie()');

    var cloudant = require('cloudant')(userCredentials.protocol + '://' + userCredentials.host + ':' + userCredentials.port);

    // Create the session cookie
    console.log("createSessionCookie: Creating session cookie");
    cloudant.auth(userCredentials.username, userCredentials.password, function(err, body, headers) {

        // Handle request error
        if (err) { 

            // Error creating session cookie
            console.log("createSessionCookie: Failed to create session cookie for user ("+userCredentials.username+"); error = " + err.message);
            err = new Error("Failed to create session cookie for user "+userCredentials.username+"; error = "+JSON.stringify(err)+".");
            callback(err, null, null);

        }

        // Session cookie created successfully, pull cookie and invoke callback
        else {

            // Obtain the session cookie from the response header
            var sessionCookie = getSessionCookieFromHeaders(headers);

            if (sessionCookie == null) {
                console.log("createSessionCookie: session cookie for user ("+userCredentials.username+") not found");
                err = new Error("Session cookie for user "+userCredentials.username+" not found in header.");
                callback(err, null, null);
            }
            else {
                console.log("createSessionCookie: session cookie for user ("+userCredentials.username+") found");
            }

            // Create base json response
            var jsonBody = body || { "ok": true };

            // Invoke the callback
            console.log("createSessionCookie: Session cookie for user ("+userCredentials.username+") created successfully.");
            callback(null, sessionCookie, body);

        }
        
    });

}
/*
 * Delete the session cookie on behalf of user.
 */
function deleteSessionCookie(userCredentials, sessCookie, callback) {
    console.log('#deleteSessionCookie()');

    // Deleting the session cookie is not supported by the cloudant api.
    // Just return an empty body.

    callback(null, { "ok": true } );

}

/*
 * Returns the AuthSession cookie from the request headers or
 * null if not found.
 */
function getSessionCookieFromHeaders(headers) {
    console.log('#getSessionCookieFromHeaders()');


    // Obtain session cookie from incoming request headers
    var sessionCookie = null;
    if (headers) {
        var cookies = headers['set-cookie'];
        var cookiesArray = ( Array.isArray( cookies ) ? cookies : [cookies] );
        for (var i = 0; i < cookiesArray.length; i++) {
            var c = cookiesArray[i];
            if ( c  &&  c.indexOf('AuthSession=') == 0 ) {
                sessionCookie = c;
            }
        }
    }

    console.log("getSessionCookieFromHeaders: Session cookie " + ( sessionCookie == null ? "not " : "" ) + "found");

    return sessionCookie;
}


exports.createSessionCookie = createSessionCookie;
exports.deleteSessionCookie = deleteSessionCookie;
exports.getSessionCookieFromHeaders = getSessionCookieFromHeaders;
