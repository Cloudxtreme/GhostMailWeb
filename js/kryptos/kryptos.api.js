/* global KRYPTOS, converse, locales, UNKNOWN, showErrorMessage */

"use strict";
/**
 * KRYPTOS is a cryptographic library wrapping and implementing the 
 * Web Cryptography API. It supports both symmetric keys and asymmetric key pair
 * generation, encryption, decryption, signing and verification.
 * 
 * If the Web Cryptography API is not supported by the browser, it falls back
 * to the an implementation of the MSR JavaScript Cryptography Library. 
 * 
 * 
 * @name KRYPTOS
 * @copyright Copyright © GhostCom GmbH. 2014 - 2015.
 * @license Apache License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0
 * @author Mickey Joe <mickey@ghostmail.com>
 * @version 3.1
 */

/**
 * The KRYPTOS Storage API Module.
 */
KRYPTOS.API = function() {
    
    var errorHandler = showErrorMessage;
    
    var getItem = function(itemId, callback) {
        KRYPTOS.utils.getJson({item_id: itemId}, 'storage', 'item', function(success, response) {
            if (success === false) {
                KRYPTOS.utils.error(errorHandler, "Get Error", response);
            }
            else {
                callback(response);
            }
        });
    };
    
    var getRoot = function(callback) {
        KRYPTOS.utils.getJson(null, 'storage', 'init', function(success, response) {
            if (success === false) {
                KRYPTOS.utils.error(errorHandler, "Get Error", response);
            }
            else {
                callback(response);
            }
        });
    };
    
    var addItem = function(json, callback) {
        KRYPTOS.utils.sendJson(json, 'storage', 'item', function(success, response) {
            if (success === false) {
                KRYPTOS.utils.error(errorHandler, "Create Error", response);
            }
            else {
                callback(response);
            }
        });
    };
    
    var updateItem = function(json, callback) {
        KRYPTOS.utils.sendJson(json, 'storage', 'update-item', function(success, response) {
            if (success === false) {
                KRYPTOS.utils.error(errorHandler, "Update Error", response);
            }
            else {
                callback(response);
            }
        });
    };
    
    var deleteItem = function(json, callback) {
        KRYPTOS.utils.sendJson(json, 'storage', 'delete-item', function(success, response) {
            if (success === false) {
                KRYPTOS.utils.error(errorHandler, "Delete Error", response);
            }
            else {
                callback(response);
            }
        });
    };
    
    var moveItem = function(json, callback) {
        KRYPTOS.utils.sendJson(json, 'storage', 'move-item', function(success, response) {
            if (success === false) {
                KRYPTOS.utils.error(errorHandler, "Move Error", response);
            }
            else {
                callback(response);
            }
        });
    };
    
    var copyItem = function(json, callback) {
        KRYPTOS.utils.sendJson(json, 'storage', 'copy-item', function(success, response) {
            if (success === false) {
                KRYPTOS.utils.error(errorHandler, "Copy Error", response);
            }
            else {
                callback(response);
            }
        });
    };
    
    var shareItem = function(json, callback) {
        KRYPTOS.utils.sendJson(json, 'storage', 'share-item', function(success, response) {
            if (success === false) {
                KRYPTOS.utils.error(errorHandler, "Share Error", response);
            }
            else {
                callback(response);
            }
        });
    };
    
    var downloadItem = function(itemId, partNumber, callback, downloadCallback) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/storage/download-item?item_id=' + itemId + '&part_no='+partNumber, true); //1421776555890 - 1421776532206
        xhr.responseType = 'blob';
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.setRequestHeader('X-CSRF-Token', getToken());
        xhr.onload = function(e) {
            if (xhr.status === 200) {
                var blob = new Blob([xhr.response], {type: "application/octet-stream"});
                KRYPTOS.utils.readBlob(blob, function() {
                    var reader          = this;
                    var data            = reader.result;            

                    callback(data);
                });
            }
            else {
                callback(false);
            }            
        };
        xhr.addEventListener('progress', downloadCallback, false);

        xhr.onerror = function(e) {
            callback(false);
        };
        xhr.send();
    };
 
            
    return {
        getRoot: getRoot,
        getItem: getItem,
        addItem: addItem,
        updateItem: updateItem,
        deleteItem: deleteItem,
        moveItem: moveItem,
        copyItem: copyItem,
        shareItem: shareItem,
        downloadItem: downloadItem
    };
            
}();




