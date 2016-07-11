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

// Internal dependencies
var keyPassManager = require('./key-pass-manager.js');

/*
 * Update permissions for user for this database:
 *  - if _users database does not exist create it and the view
 *  - if entry for user does not exist in _users database, add user
 *  - if user does not have admins permissions for database, add the permissions
 */
function setPermissions(adminCredentials, userName, databaseName, callback) {
    console.log('#setPermissions()');

    // Start with creating the _users database and proceed to updating the permissions
    createUsersDatabase(adminCredentials, userName, databaseName, callback);

}

/*
 * Remove permissions for user for this database:
 *  - clear admins permissions for database
 *  - remove user from _users database
 *  - clear user from user credentials cache
 */
function removePermissions(adminCredentials, userName, databaseName, callback) {
    console.log('#removePermissions()');

    var rootErr = null;

    // Remove this user's access to the database
    removeUserAccess(adminCredentials, userName, databaseName, function(err) {

    	// Handle error
    	if (err) {
            console.log("removePermissions: An error occurred removing access to database("+databaseName+") for user ("+userName+"); err = " + err.message + ".");
    		rootErr = err;
    	}

	    // Delete the user from the user's database
	    deleteUserEntry(adminCredentials, userName, databaseName, function(err) {

	    	// Handle error
	    	if (err) {
            	console.log("removePermissions: An error occurred removing user ("+userName+") from the _users database; err = " + err.message + ".");
	    		if (rootErr == null) rootErr = err;
	    	}

            // Clear the credentials from cache
            keyPassManager.clearUserCredentials(userName);

		    // Everything cleaned up, invoke callback
		    callback(rootErr);

	    });

    });

}

/*
 * Create the _users database.
 */
function createUsersDatabase(adminCredentials, userName, databaseName, callback) {
	console.log('#createUsersDatabase()');

    var cloudant = require('cloudant')(adminCredentials.protocol + '://' + adminCredentials.auth + '@' + adminCredentials.host + ':' + adminCredentials.port);

    // Create the database
    console.log("createUsersDatabase: Creating database: _users");
    cloudant.db.create('_users', function(err, body) {

        // Handle request error
        if (err) { 

	        // _users database already existed, add/update user
	        if (err.statusCode === 412) {
            	console.log("createUsersDatabase: _users database already exists; Adding/updating user ("+userName+")");
            	var db = cloudant.use('_users');

			    // Get specific user's database info
			    console.log("createUsersDatabase: Retrieving database document: _users/org.couchdb.user:" + userName);
			    db.get('org.couchdb.user:' + userName, function(err, body) {

			        // Handle request error
			        if (err) { 

				        // Specific user's database document does not exist, create it and add permissions
				        if (err.statusCode === 404) {
		            		console.log("createUsersDatabase: User ("+userName+") _users database document does not exist; Creating it and adding access");
			            	createUserEntry(adminCredentials, userName, databaseName, callback);
				        }

				        // Error retrieving user's database document
				        else {
		        			console.log("createUsersDatabase: Failed to read database document (_users/org.couchdb.user:"+userName+"); error = " + err.message);
			        		err = new Error("Failed to read database document _users/org.couchdb.user:"+userName+"; error = "+JSON.stringify(err)+".");
		            		callback(err);
				        }
			        }

			        // Specific user's database document exists, update permissions
			        else {
	            		console.log("createUsersDatabase: User ("+userName+") _users database info exists; Updating access");
		            	addUserAccess(adminCredentials, userName, databaseName, callback);
			        }
			    	
			    });

	        }

	        // Error creating _users database
	        else {
	        	console.log("createUsersDatabase: Failed to create database (_users); error = " + err.message);
		        err = new Error("Failed to create database _users; error = "+JSON.stringify(err)+".");
	            callback(err);
	        }
        }

        // _users database did not exist and was created successfully, create view
        else {
            console.log("createUsersDatabase: Created _users database; adding view");
      		createUsersDatabaseView(adminCredentials, userName, databaseName, callback);
        }
    	
    });

}

/*
 * Create the _users database view.
 */
function createUsersDatabaseView(adminCredentials, userName, databaseName, callback) {
	console.log('#createUsersDatabaseView()');

    var cloudant = require('cloudant')(adminCredentials.protocol + '://' + adminCredentials.auth + '@' + adminCredentials.host + ':' + adminCredentials.port);
    var db = cloudant.use('_users');

    var viewContent = {
    		"views": {
        		"users": {
        			"map": "function(doc) {\n  emit(doc._id, doc);\n}"
        		}
      		}
		};
    var viewName = "_design/_imfdata_usersview";

    // Create the view
    console.log("createUsersDatabaseView: Creating _users view: " + viewName);
    db.insert(viewContent, viewName, function(err, body) {

        // Handle request error
        if (err) { 

	        // Error creating view
        	console.log("createUsersDatabaseView: Failed to create users view for database (_users); error = " + err.message);
	        err = new Error("Created database _users but failed to create users view; error = "+JSON.stringify(err)+".");
            callback(err);

        }

        // View created, create user entry
        else {
            console.log("createUsersDatabaseView: Created _users database view");
    		createUserEntry(adminCredentials, userName, databaseName, callback);
        }
    	
    });

}

/*
 * Create _users database entry for specific user.
 */
function createUserEntry(adminCredentials, userName, databaseName, callback) {
	console.log('#createUserEntry()');

    var cloudant = require('cloudant')(adminCredentials.protocol + '://' + adminCredentials.auth + '@' + adminCredentials.host + ':' + adminCredentials.port);
    var db = cloudant.use('_users');

	// Generate password, salt, and encrypted password
	var password = crypto.randomBytes(16).toString('hex');
	var salt = crypto.randomBytes(16).toString('hex');
	var hash = crypto.createHash('sha1');
	hash.update(password + salt);
	var password_sha = hash.digest('hex');
	var encryptedPassword = keyPassManager.encryptWithSalt(password, salt);

    var docContent = {
    		"_id": "org.couchdb.user:" + userName,
    		"name": userName,
    		"password": encryptedPassword,
    		"salt": salt,
    		"password_sha": password_sha,
    		"roles": [],  // Not sure if we need any of these roles (_reader, _writer, _admin, _design, _all_dbs)
    		"type": "user"
		};
    var docName = "org.couchdb.user:" + userName;

    // Create the _users document
    console.log("createUserEntry: Creating _users document: " + docName);
    db.insert(docContent, docName, function(err, body) {

        // Handle request error
        if (err) { 

	        // Error creating _users document
        	console.log("createUserEntry: Failed to create database document (_users/org.couchdb.user:"+userName+"); response error = " + err.message);
	        err = new Error("Failed to create database document _users/org.couchdb.user:"+userName+"; error = "+JSON.stringify(err)+".");
            callback(err);

        }

        // _users database entry for specific user created successfully; add permissions
        else {
			console.log("createUserEntry: _users database document for user ("+userName+") created; Adding access");
            addUserAccess(adminCredentials, userName, databaseName, callback);
        }
    	
    });

}

/*
 * Update user permissions for database.
 */
function addUserAccess(adminCredentials, userName, databaseName, callback) {
	console.log('#addUserAccess()');

    var cloudant = require('cloudant')(adminCredentials.protocol + '://' + adminCredentials.auth + '@' + adminCredentials.host + ':' + adminCredentials.port);
    var db = cloudant.use(databaseName);

    var docName = '_security';

    // Get the database _security document
    console.log("addUserAccess: Retrieving _security document for database " + databaseName);
    db.get(docName, function(err, body) {

        // Handle request error
        if (err) { 

        	// Error retrieving _security document
        	console.log("addUserAccess: Failed to get permissions for database ("+databaseName+"); error = " + err.message);
	        err = new Error("Failed to get database "+databaseName+" permissions; error = "+JSON.stringify(err)+".");
            callback(err);
        }

        // Database permission info found, update it for this user
        else {

		    // Parse received JSON payload
		    var jsonBody = body || {};

		    // Determine if the security document for this database already exists
		    var existingSecurityDoc = false;
		    if (jsonBody.hasOwnProperty('couchdb_auth_only')  ||
		    	jsonBody.hasOwnProperty('admins')  ||
		    	jsonBody.hasOwnProperty('members')) {
		    	existingSecurityDoc = true;
		    }

		    // Update security admins info for this user to give admins access
		    var existingMember = false;
		    jsonBody.couchdb_auth_only = true;
		    if (!jsonBody.admins) {
		    	jsonBody.admins = {
		    		"names": [userName]
		    	};
		    }
		    else {
		    	if (jsonBody.admins.names) {
		    		existingMember = ( jsonBody.admins.names.indexOf(userName) >= 0 );
		    		if (!existingMember) {
		    			jsonBody.admins.names.push(userName);
		    		}
		    	}
		    	else {
			    	jsonBody.admins = {
			    		"names": [userName]
			    	};
		    	}
		    }

		    // If member does not already exist, then update the permissions
		    if (!existingMember) {

			    // Update security members info for this user to give admins access
			    if (!jsonBody.members  &&  !existingSecurityDoc) {
			    	jsonBody.members = {
			    		"names": [],
			    		"roles": ['_admin']
			    	};
			    }

			    // Obtain and clear revision info from doc
			    var revision = jsonBody._rev || null;

			    // Update the _security document with permissions
			    console.log("addUserAccess: Setting permissions for database: " + databaseName);
			    db.insert(jsonBody, docName, function(err, body) {

			        // Handle request error
			        if (err) { 

				        // Error updating _security document
						console.log("addUserAccess: Failed to set permissions for database ("+databaseName+"); error = " + err.message);
						err = new Error("Failed to set database "+databaseName+" permissions; error = "+JSON.stringify(err)+".");
						callback(err);

			        }

			        // _security document updated successfully, invoke callback
			        else {
						console.log("addUserAccess: Permissions for user ("+userName+") and database ("+databaseName+") set successfully");
						callback(null);
			        }
			    	
			    });

		    }

		    // If member already exist invoke callback
		    else {
            	console.log("addUserAccess: Permissions for user ("+userName+") and database ("+databaseName+") already exist; nothing more to do");
            	callback(null);
		    }

        }
    	
    });

}

/*
 * Delete _users database entry for specific user.
 */
function deleteUserEntry(adminCredentials, userName, databaseName, callback) {
	console.log('#deleteUserEntry()');

    var cloudant = require('cloudant')(adminCredentials.protocol + '://' + adminCredentials.auth + '@' + adminCredentials.host + ':' + adminCredentials.port);
    var db = cloudant.use('_users');

    var docName = "org.couchdb.user:" + userName;

    // Retrieve the _users document for the specific user
    console.log("deleteUserEntry: Retrieving _users document: " + docName);
    db.get(docName, function(err, body) {

        // Handle request error
        if (err) { 

	    	// Handle valid database entry for specific user does not exist response
	    	if (err.statusCode === 404) {
	    		console.log("deleteUserEntry: _users database document for user ("+userName+") does not exist; nothing more to do");
	            callback(null);
	    	}

	        // Error retrieving _users document
	        else {
	        	console.log("deleteUserEntry: Failed to read database document (_users/org.couchdb.user:"+userName+"); error = " + err.message);
		        err = new Error("Failed to read database document _users/org.couchdb.user:"+userName+"; error = "+JSON.stringify(err)+".");
	            callback(err);
	        }
        }

        // _users database document for specific user retrieved successfully; obtain revision and issue delete
        else {
			console.log("deleteUserEntry: _users database document for user ("+userName+") retrieved; removing it");

			// Obtain revision id from document
		    var jsonBody = body || {};
		    var revision = jsonBody._rev || null;

		    // Delete _users database document for specific user
		    console.log("deleteUserEntry: Deleting _users database document: " + docName);
		    db.destroy(docName, revision, function(err, body) {

		        // Handle request error
		        if (err) { 

		        	// Handle valid database document for specific user does not exist response
		        	if (err.statusCode === 409) {
			    		console.log("deleteUserEntry: _users database document for user ("+userName+") does not exist; nothing more to do");
			            callback(null);
		        	}

			        // Error deleting _users database document for specific user
			        else {
	        			console.log("deleteUserEntry: Failed to delete _users database document (org.couchdb.user:"+userName+"); error = " + err.message);
		        		err = new Error("Failed to delete _users database rg.couchdb.user:"+userName+"; error = "+JSON.stringify(err)+".");
			            callback(err);
			        }

		        }

		        // _users database entry for specific user deleted successfully; invoke callback
		        else {
					console.log("deleteUserEntry: _users database document for user ("+userName+") deleted");
		            callback(null);
		        }
		    	
		    });

        }
    	
    });

}

/*
 * Remove user permissions for database.
 */
function removeUserAccess(adminCredentials, userName, databaseName, callback) {
	console.log('#removeUserAccess()');

    var cloudant = require('cloudant')(adminCredentials.protocol + '://' + adminCredentials.auth + '@' + adminCredentials.host + ':' + adminCredentials.port);
    var db = cloudant.use(databaseName);

    var docName = '_security';

    // Retrieve the _security document for the database
    console.log("removeUserAccess: Retrieving _security document for database: " + databaseName);
    db.get(docName, function(err, body) {

        // Handle request error
        if (err) { 

	    	// Handle valid permissions do not exist response
	    	if (err.statusCode === 404) {
	            console.log("removeUserAccess: Permissions for user ("+userName+") and database ("+databaseName+") do not exist; nothing more to do");
	            callback(null);
	    	}

	        // Error retrieving _security document
	        else {
	        	console.log("removeUserAccess: Failed to get permissions for database ("+databaseName+"); error = " + err.message);
		        err = new Error("Failed to get database "+databaseName+" permissions; error = "+JSON.stringify(err)+".");
	            callback(err);
	        }
        }

        // Database permissions info obtained successfully
        else {
			console.log("deleteUserEntry: _security document for database ("+databaseName+") retrieved; updating it");

		    // Parse received JSON payload
		    var jsonBody = body || {};

		    // Update security admins info for this user to remove admins access
		    var existingMember = false;
		    if (jsonBody.admins) {
		    	if (jsonBody.admins.names) {
		    		var namesIndex = jsonBody.admins.names.indexOf(userName);
		    		existingMember = ( namesIndex >= 0 );
		    		if (existingMember) {
		    			jsonBody.admins.names.splice(namesIndex, 1);
		    		}
		    	}
		    }

		    // If member exists, then update the permissions
		    if (existingMember) {

			    // Obtain and clear revision info from doc
			    var revision = jsonBody._rev || null;

			    // Update database permissions info
			    console.log("deleteUserEntry: Updating _security document for database: " + databaseName);
			    db.insert(jsonBody, docName, function(err, body) {

			        // Handle request error
			        if (err) { 
	    				console.log("removeUserAccess: Failed to remove permissions for database ("+databaseName+"); error = " + err.message);
	        			err = new Error("Failed to remove database "+databaseName+" permissions; error = "+JSON.stringify(err)+".");
	        			callback(err);
			        }

			        // Database permissions info updated successfully, invoke callback
			        else {
            			console.log("removeUserAccess: Permissions for user ("+userName+") and database ("+databaseName+") updated successfully");
            			callback(null);
			        }
			    	
			    });

		    }

		    // If member does not exist invoke callback
		    else {
            	console.log("removeUserAccess: Permissions for user ("+userName+") and database ("+databaseName+") does not exist; nothing more to do");
            	callback(null);
		    }

        }
    	
    });

}

exports.setPermissions = setPermissions;
exports.removePermissions = removePermissions;
