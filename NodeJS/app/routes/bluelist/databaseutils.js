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

/*
 * Create the BlueList sample database:
 *  - create database with the given name
 *  - create @datatype index
 */
function createDatabase(adminCredentials, databaseName, callback) {
    console.log('#node: createDatabase()');

    var cloudant = require('cloudant')(adminCredentials.protocol + '://' + adminCredentials.auth + '@' + adminCredentials.host + ':' + adminCredentials.port);

    // Create the database
    console.log("createDatabase: Creating database: " + databaseName);
    cloudant.db.create(databaseName, function(err, body) {

        // Handle request error
        if (err) { 

	        // Database/index already exists; invoke callback
	        if (err.statusCode === 412) {
        		console.log("createDatabase: Database ("+databaseName+") already created.");
	            callback(null);
	        }

	        // Error creating database
	        else {
	        	console.log("createDatabase: Failed to create database ("+databaseName+"); error = " + err.message);
		        err = new Error("Failed to create database "+databaseName+"; error = "+JSON.stringify(err)+".");
	            callback(err);
	        }
        }

        // Database created successfully, create index
        else {
      		console.log("createDatabase: Database ("+databaseName+") created successfully.");
            addCloudantQueryDataTypesIndex(adminCredentials, databaseName, callback);
        }
    	
    });

}

/*
 * Delete BlueList sample database.
 */
function deleteDatabase(adminCredentials, databaseName, callback) {
    console.log('#node: deleteDatabase()');

    var cloudant = require('cloudant')(adminCredentials.protocol + '://' + adminCredentials.auth + '@' + adminCredentials.host + ':' + adminCredentials.port);

    // Delete the database
    console.log("deleteDatabase: Creating database: " + databaseName);
    cloudant.db.destroy(databaseName, function(err, body) {

        // Handle request error
        if (err) { 

	        // Database does not exist; invoke callback
	        if (err.statusCode === 404) {
        		console.log("deleteDatabase: Database ("+databaseName+") does not exist; nothing more to do.");
	            callback(null);
	        }

	        // Error deleting database
	        else {
	        	console.log("deleteDatabase: Failed to delete database ("+databaseName+"); error = " + err.message);
		        err = new Error("Failed to delete database "+databaseName+"; error = "+JSON.stringify(err)+".");
	            callback(err);
	        }
        }

        // Database deleted successfully
        else {
        	console.log("deleteDatabase: Database ("+databaseName+") deleted successfully.");
	  		callback(null);
        }
    	
    });

}

/*
 * Create cloudant query @datatypes index.
 */
function addCloudantQueryDataTypesIndex(adminCredentials, databaseName, callback) {
	console.log('#addCloudantQueryDataTypesIndex()');

    var cloudant = require('cloudant')(adminCredentials.protocol + '://' + adminCredentials.auth + '@' + adminCredentials.host + ':' + adminCredentials.port);
    var db = cloudant.use(databaseName);

    var indexContent = {
	  		index: {
	    		fields: ['@datatype']
	  		},
	  		ddoc: '_imfdata_defaultdatatype'
		};
	var indexName = "_design/_imfdata_defaultdatatype";

    // Create the index
    console.log("addCloudantQueryDataTypesIndex: Creating index: " + indexName);
    db.index(indexContent, function(err, body) {

        // Handle request error
        if (err) { 

	        // Error creating index
        	console.log("addCloudantQueryDataTypesIndex: Failed to create @datatype index for database ("+databaseName+"); error = " + err.message);
	        err = new Error("Created database "+databaseName+" but failed to create index '@datatype'; error = "+JSON.stringify(err)+".");
	  		callback(err);

        }

        // Index created successfully, invoke callback
        else {
            console.log("addCloudantQueryDataTypesIndex: @datatype index for database ("+databaseName+") created successfully.");
	  		callback(null);
        }
    	
    });

}

/*
 * Build a bluelist sample database name for the given user.
 * The first part of the name is 'todosdb'.
 * The second part of the name is generated based on the user name using SHA1.
 */
function getDatabaseName(userName, callback) {
    console.log('#node: getDatabaseName()');

    var databaseName = 'todosdb';
    var SHA1 = crypto.createHash('sha1');
    SHA1.update(userName);
    databaseName += ( '_' + SHA1.digest('hex') );
    console.log("node: getDatabaseName: User ("+userName+"); database name = " + databaseName);
    callback(null, databaseName);
}

exports.createDatabase = createDatabase;
exports.deleteDatabase = deleteDatabase;
exports.getDatabaseName = getDatabaseName;
