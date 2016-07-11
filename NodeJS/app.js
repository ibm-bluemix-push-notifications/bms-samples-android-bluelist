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

 // Just in case we missed something
process.on('uncaughtException', function(err){
  console.log('Caught exception: ' + err.stack);
});

// External dependencies
var express = require('express');
var cors = require('cors');
var http = require('http');
var https = require('https');

// Internal dependencies
var router = require('./app/routes/router.js');

// Set how many concurrent sockets can be open for all http client requests
http.globalAgent.maxSockets = 100;
https.globalAgent.maxSockets = 100;

// Setup app
var app = express();
app.use(cors());

// Set routes
app.use(router);

//Start servers
//console.log("app init: env = " + JSON.stringify(process.env));
app.set('port', process.env.VCAP_APP_PORT || process.env.PORT || 3000);
var server = app.listen(app.get('port'), function() {
  console.log('CONSOLE LOG: Express server listening on port ' + server.address().port + "; host = " + server.address().address );
});

