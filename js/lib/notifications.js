/* global Notification */

"use strict";
/**
 * The Notification module. 
 * 
 * @name Notifications
 * @copyright Copyright © GhostCom GmbH 2014 - 2015.
 * @license Apache License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0
 * @author Mickey Joe <mickey@ghostmail.com>
 * @version 3.1
 */

/**
 * Notification constructor.
 * 
 * @param {integer} max
 * @returns {void}
 */
var Notifications = function (lang) {
    
    var options = {
        body: "",
        icon: "https://www.ghostmail.com/img/favicon/favicon-114.png",
        lang: lang || "en"
    };
    
    var request = function(callback) {
        if (supported()) {
//            console.log('supported');
            if (callback) {
                callback(false);
            }
        }
        else {
            return;
        }
        if (Notification.permission === "granted") {
//            console.log('already granted');
            if (callback) {
                callback(true);
            }
        }
        else if (Notification.permission !== 'denied') {
//            console.log('request permission');
            Notification.requestPermission(function (permission) {
                // If the user accepts, let's create a notification
                if (permission === "granted") {
//                    console.log('granted');
                    if (callback) {
                        callback(true);
                    }
                }
                else {
//                    console.log('not granted');
                    if (callback) {
                        callback(false);
                    }
                }
            });
        }
        else {
//            console.log('denied');
            if (callback) {
                callback(false);
            }
        }
    };

    var notify = function(title, body) {
        request(function(canNotify) {
            if (canNotify) {
                options.body = body;
                var notification = new Notification(title, options);
                setTimeout(function(){
                    notification.close(); //closes the notification
                }, 8000);
            }
        });
    };
    
    var supported = function() {
        return ('Notification' in window);
    };
    
    // public methods
    return {
        request: request,
        notify: notify,
        supported: supported
    };
};



