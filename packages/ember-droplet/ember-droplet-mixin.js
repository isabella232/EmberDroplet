(function($window, $ember, $jQuery) {

    "use strict";

    /**
     * @module App
     * @class EmberDropletController
     * @type Ember.Mixin
     * @extends Ember.Mixin
     */
    $window.DropletController = $ember.Mixin.create({

        /**
         * @property mimeTypes
         * @type {Array}
         */
        mimeTypes: ['image/jpeg', 'image/jpg', 'image/gif', 'image/png', 'text/plain'],

        /**
         * @property requestHeaders
         * @type {Object}
         * Contains a list of headers to be included in the request made by
         * uploadAllFiles()
         */
        requestHeaders: {},

        /**
         * @property postData
         * @type {Object}
         * Contains a dictionary of extra POST data to be included in the
         * request made by uploadAllFiles()
         */
        postData: {},

        /**
         * @property files
         * @type {Array}
         * @default []
         * Contains a list of files, both valid, deleted, and invalid.
         */
        files: [],

        /**
         * @property uploadStatus
         * @type {Object}
         */
        uploadStatus: { uploading: false, percentComplete: 0, error: false },

        /**
         * @property autoUpload
         * @type {Boolean}
         * Triggers file upload automatically after adding files.
         */
        autoUpload: false,
        
        /**
         * @constructor
         * @method init
         * Clears the file array for each instantiation.
         * @return {void}
         */
        init: function() {
            $ember.set(this, 'files', []);
            this._super();
        },

        /**
         * @property actions
         * @type {Object}
         */
        actions: {

            /**
             * @method addValidFile
             * @param file {File}
             * Adds a valid file to the collection.
             * @return {Object}
             */
            addValidFile: function(file) {
                record = this._addFile(file, true);
                if (this.get('autoUpload') === true) {
                    this.send('uploadAllFiles');
                }
                
                return record;
            },

            /**
             * @method addInvalidFile
             * @param file {File}
             * Adds an invalid file to the collection.
             * @return {Object}
             */
            addInvalidFile: function(file) {
                return this._addFile(file, false);
            },

            /**
             * @method deleteFile
             * @param file
             * Deletes a file from the collection.
             * @return {Object}
             */
            deleteFile: function(file) {
                $ember.set(file, 'deleted', true);
                return file;
            },

            /**
             * @method clearAllFiles
             * Clears all of the files from the collection.
             * @return {void}
             */
            clearAllFiles: function() {
                $ember.set(this, 'files', []);
            },

            /**
             * @method uploadAllFiles
             * Uploads all of the files that haven't been uploaded yet, but are valid files.
             * @return {Object|Boolean} jQuery promise, or false if there are no files to upload.
             */
            uploadAllFiles: function() {

                if ($ember.get(this, 'validFiles').length === 0) {
                    // Determine if there are even files to upload.
                    return false;
                }

                // Find the URL, set the uploading status, and create our promise.
                var url             = $ember.get(this, 'dropletUrl'),
                    deferred        = new $jQuery.Deferred(),
                    postData        = this.get('postData'),
                    requestHeaders  = this.get('requestHeaders');

                $ember.set(this, 'uploadStatus.uploading', true);
                $ember.set(this, 'uploadStatus.error', false);

                // Assert that we have the URL specified in the controller that implements the mixin.
                $ember.assert('You must specify the `dropletUrl` parameter in order to upload files.', !!url);

                // Create a new XHR request object.
                var request = new $window.XMLHttpRequest();
                request.open('post', url, true);

                // Create a new form data instance.
                var formData = new $window.FormData();

                // Iterate over each file, and append it to the form data.
                $ember.EnumerableUtils.forEach($ember.get(this, 'validFiles'), function(file) {
                    formData.append('files', file.file);
                }, this);

                // Add any extra POST data specified in the controller
                for (var index in postData) {
                    if (postData.hasOwnProperty(index)) {
                        formData.append(index, postData[index]);
                    }
                }

                // Add all of the event listeners.
                this._addProgressListener(request.upload);
                this._addSuccessListener(request.upload, deferred);
                this._addErrorListener(request.upload, deferred);

                // Resolve the promise when we've finished uploading all the files.
                request.onreadystatechange = function() {

                    if (request.readyState === 4) {
                        var files = $window.JSON.parse(request.responseText);
                        deferred.resolve(files);
                    }

                };
                // Set the request size, and then we can upload the files!
                request.setRequestHeader('X-File-Size', this._getSize());

                // Assign any request headers specified in the controller.
                for (index in requestHeaders) {
                    if (requestHeaders.hasOwnProperty(index)) {
                        request.setRequestHeader(index, requestHeaders[index]);
                    }
                }

                request.send(formData);

                // Return the promise.
                return deferred.promise();

            }

        },

        /**
         * @property validFiles
         * Finds a list of files that aren't deleted, and are of a valid MIME type.
         * @return {Array}
         */
        validFiles: $ember.computed(function() {
            return this._filesByProperties({ valid: true, deleted: false, uploaded: false });
        }).property('files.length', 'files.@each.deleted', 'files.@each.uploaded'),

        /**
         * @property invalidFiles
         * Finds a list of files that have an unsupported MIME type.
         * @return {Array}
         */
        invalidFiles: $ember.computed(function() {
            return this._filesByProperties({ valid: false });
        }).property('files.length', 'files.@each.deleted'),

        /**
         * @property uploadedFiles
         * Finds a list of files that have been successfully uploaded.
         * @return {Array}
         */
        uploadedFiles: $ember.computed(function() {
            return this._filesByProperties({ uploaded: true });
        }).property('files.length', 'files.@each.uploaded'),

        /**
         * @property deletedFiles
         * Finds a list of files that have been deleted by the user.
         * @return {Array}
         */
        deletedFiles: $ember.computed(function() {
            return this._filesByProperties({ deleted: true });
        }).property('files.length', 'files.@each.deleted'),

        /**
         * @method _filesByProperties
         * @param maps {Object}
         * Accepts a map of properties that each file must have.
         * @return {Array}
         * @private
         */
        _filesByProperties: function(maps) {

            // Iterate over each of the files.
            return $ember.get(this, 'files').filter(function(file) {

                for (var property in maps) {

                    if (maps.hasOwnProperty(property)) {

                        // If the current property doesn't match what we're after from the map,
                        // then the file is invalid.
                        if (file[property] !== maps[property]) {
                            return false;
                        }

                    }

                }

                // Voila! We have a good file that matches our criteria.
                return true;

            });

        },

        /**
         * @method _getSize
         * Determine the size of the request.
         * @return {Number}
         * @private
         */
        _getSize: function() {

            var size = 0;

            // Iterate over all of the files to determine the size of all valid files.
            $ember.EnumerableUtils.forEach($ember.get(this, 'validFiles'), function(file) {
                size += file.file.size;
            });

            return size;

        },

        /**
         * @method _addSuccessListener
         * @param request
         * @private
         */
        _addSuccessListener: function(request) {

            // Once the files have been successfully uploaded.
            request.addEventListener('load', function() {

                // Set the `uploaded` parameter to true once we've successfully // uploaded the files.
                $ember.EnumerableUtils.forEach($ember.get(this, 'validFiles'), function(file) {
                    $ember.set(file, 'uploaded', true);
                });

                // We want to revert the upload status.
                $ember.set(this, 'uploadStatus.uploading', false);

            }.bind(this), false);

        },

        /**
         * @method _addErrorListener
         * @param request
         * @param [deferred = null]
         * @return {void}
         * @private
         */
        _addErrorListener: function(request, deferred) {

            request.addEventListener('error', function() {

                // As an error occurred, we need to revert everything.
                $ember.set(this, 'uploadStatus.uploading', false);
                $ember.set(this, 'uploadStatus.error', true);

                if (deferred) {
                    // Reject the promise if we have one.
                    deferred.reject();
                }

            }.bind(this));

        },

        /**
         * @method _addProgressListener
         * @param request
         * @return {void}
         * @private
         */
        _addProgressListener: function(request) {

            request.addEventListener('progress', function (event) {

                if (!event.lengthComputable) {
                    // There's not much we can do if the request is not computable.
                    return;
                }

                // Calculate the percentage remaining.
                var percentageLoaded = (event.loaded / this._getSize()) * 100;
                $ember.set(this, 'uploadStatus.percentComplete', Math.round(percentageLoaded));

            }.bind(this), false);

        },

        /**
         * @method _addFile
         * @param file {File}
         * @param valid {Boolean}
         * Adds a file based on whether it's valid or invalid.
         * @return {Object}
         * @private
         */
        _addFile: function(file, valid) {

            // Extract the file's extension which allows us to style accordingly.
            var className = 'extension-%@'.fmt(file.name.match(/\.(.+)$/i)[1]).toLowerCase();

            // Create the record with its default parameters, and then add it to the collection.
            var record = { file: file, valid: valid, uploaded: false, deleted: false, className: className };
            $ember.get(this, 'files').pushObject(record);

            // Voila!
            return record;

        }

    });

})(window, window.Ember, window.jQuery);
