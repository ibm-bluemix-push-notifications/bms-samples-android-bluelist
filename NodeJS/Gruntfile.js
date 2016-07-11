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

/*jslint node:true */
'use strict';

var request = require('request');

module.exports = function(grunt) {

  // show elapsed time at the end
  require('time-grunt')(grunt);

  // load all grunt tasks
  require('load-grunt-tasks')(grunt);

  var reloadPort = 35729,
    files;

  grunt.initConfig({

    env: {
      dev: {
        imfServiceUrl: 'http://imf-authserver.stage1.ng.bluemix.net/imf-authserver',
        VCAP_SERVICES: '{"cloudantNoSQLDB":[fillinwithBlueMixEnvVars],"AdvancedMobileAccess": [fillinwithBlueMixEnvVars]}',
        VCAP_APPLICATION: '{"application_id":"fillinwithBlueMixAppId"}',
        NO_AUTH: 1,  // If commented out, need to have VCAP_APPLICATION set and pass oauth token on requests
        ENABLE_ANALYTICS_SDK: 'no',
        ENABLE_CUSTOM_PROVIDER: 'no'
      }
    },

    // Project settings
    config: {
      app: 'app'
    },

    pkg: grunt.file.readJSON('package.json'),

    develop: {
      server: {
        file: 'app.js'
      }
    },

    // Watches files for changes and runs tasks based on the changed files
    watch: {
      options: {
        nospawn: true,
        livereload: reloadPort
      },
      lib: {
        files: ['<%= config.app %>/lib/**/*.js'],
        tasks: ['develop:server']
      },
      gruntfile: {
        files: ['Gruntfile.js']
      },
      server: {
        files: [
          'app.js',
          '<%= config.app %>/routes/**/*.js'
        ],
        tasks: ['develop:server']
      },
    },

    // The actual grunt server settings
    connect: {
      options: {
        port: 9000,
        open: true,
        livereload: 35729,
        // Change this to '0.0.0.0' to access the server from outside
        hostname: 'localhost'
      },
      livereload: {
        options: {
          middleware: function(connect) {
            return [
              connect.static('.tmp'),
              connect.static('<%= config.app %>')
            ];
          }
        }
      }
    },

    // Empties folders to start fresh
    clean: {
      server: '.tmp'
    }

  });



  grunt.config.requires('watch.server.files');
  files = grunt.config('watch.server.files');
  files = grunt.file.expand(files);

  grunt.registerTask('serve', function(target) {
    grunt.task.run([
      'clean:server',
      'env:dev',
      'develop:server',
      'watch'
    ]);
  });

  grunt.registerTask('delayed-livereload',
    'Live reload after the node server has restarted.',
    function() {
      var done = this.async();
      setTimeout(function() {
        request.get('http://localhost:' + reloadPort + '/changed?files=' +
          files.join(','),
          function(err, res) {
            var reloaded = !err && res.statusCode === 200;
            if (reloaded) {
              grunt.log.ok('Delayed live reload successful.');
            } else {
              grunt.log.error('Unable to make a delayed live reload.');
            }
            done(reloaded);
          });
      }, 500);
    });

  grunt.registerTask('default', ['develop:server', 'watch']);
};
