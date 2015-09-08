/* global KRYPTOS, converse, locales */

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
 * @version 3.0
 */

/**
 * The KRYPTOS Decrypter module.
 */
KRYPTOS.Chat = function() {
    
    var url = KRYPTOS.session.getItem('bosh_service_url');
    
    var jid = KRYPTOS.session.getItem('jid');
    
    var sid = KRYPTOS.session.getItem('sid');
    
    var rid = KRYPTOS.session.getItem('rid');
    
    var pdk = null;
    
    var me = null;
    
    var activeWindow = true;
    
    var unreadMessages = 0;
    
    var logout = function() {
        converse.account.logout();
    };

    var isEnabled = function() {
        if (url === null || url === undefined) {
            return false;
        }
        return true;
    };
    
    var init = function(username) {
        if (!isEnabled()) {
            return; // Chat disabled
        }
        me = username;
        
        handleInitialized();
        
        handleReady();
        
        handleReconnect();
        
        handleStatus();
        
        handleContactStatus();
        
        handleInbound();
        
        handleOutbound();
        
        handleNoresumableSession();
        
        converse.initialize({
            allow_registration: false,
            prebind_url: "/chat/prebind",
            authentication: "prebind",
            prebind: true,
            keepalive: true,
            bosh_service_url: url,
            jid: jid,
//            sid: sid,
//            rid: rid,
            show_only_online_users: false,
            show_participants_toggle: true,
            allow_otr: false,
            i18n: locales['en'],
            auto_subscribe: false,
            auto_reconnect: true,
            allow_muc: false,
            allow_logout: false,
            play_sounds: false,
            hide_muc_server: true,
            allow_contact_removal: false,
            allow_contact_requests: false,
            show_controlbox_by_default: false,
            roster_groups: false,
            use_otr_by_default: false,
            use_vcards: true,
            
//            auto_list_rooms: true,
//            message_archiving: 'roster',
//            no_trimming: true,
            
            debug: false
        });
    };
    
    var getPdk = function(callback) {
        if (pdk !== null) {
            callback(pdk);
        }
        else {
            KRYPTOS.getPrivateDecryptionKey(function(success, result) {
                if (!success) {
                    console.log('problem with PDK');
                } else {
                    pdk = result;
                }
                callback(pdk);
            });
        }
    };
    
    var handleInitialized = function() {
        converse.listen.on('initialized', function (event) {
            
        });
    };
    
    var handleReady = function() {
        converse.listen.on('ready', function (event) {

        });
    };
    
    var lastMessageId = null;
    
    /**
     * Handle inbound encrypted chat messages for decryption.
     * 
     * @returns {void}
     */
    var handleInbound = function() {
        converse.listen.on('message', function (event, chat) {
            if (chat.message.context.id) {
                if (lastMessageId === chat.message.context.id) {
                    return;
                }
                lastMessageId = chat.message.context.id;
            }
            var message = chat.message.children('body').text();
            var me = this.bare_jid;
            var mKey = null;
            me = me.replace(/@.*$/,'');            
            if (message !== '') {
                getPdk(function(pdk) {
                    var messageObj = KRYPTOS.utils.b642obj(message);
                    for (var i in messageObj.keys) {
                        if (messageObj.keys[i].u === me) {
                            mKey = messageObj.keys[i].k;
                            break;
                        }

                    }
                    if (mKey === null) {
//                            console.log('no key');
                        return;
                    }
                    messageObj.key = KRYPTOS.utils.b642ab(mKey);
                    messageObj.iv = KRYPTOS.utils.b642ab(messageObj.iv);
                    messageObj.message = KRYPTOS.utils.b642ab(messageObj.m);
                    messageObj.signature = KRYPTOS.utils.b642ab(messageObj.s);
                    //var pvk = KRYPTOS.Keys.getPublicKey(from, 'verify');
                    KRYPTOS.Keys.getPublicKey(messageObj.from, 'verify', function(pvk) {
                        new KRYPTOS.Decrypter(messageObj.key, messageObj.iv, messageObj.message, messageObj.signature, pvk, pdk, function(plainText) {
                            chat.message.children('body').text(decodeURIComponent(plainText));
                            if (chat.object.model && chat.object.model.get('chatroom')) {
                                chat.object.model.createMessage(chat.message, chat.object.$delay, chat.object.archive_id);
                            } else {
                                chat.object.receiveMessage(chat.message);
                            }

                            if (!activeWindow) {
                                ++unreadMessages;
                            }
                        }).decrypt();
                    });
                });
            }
            else {
                if (chat.object.model && chat.object.model.get('chatroom')) {
                    chat.object.onChatRoomMessage(chat.message);
                } else {
                    chat.object.receiveMessage(chat.message);
                }
            }            
        });
    };
    
    /**
     * Handle outbound chat messages for encryption.
     * 
     * @returns {void}
     */
    var handleOutbound = function() {
        converse.listen.on('messageSend', function (event, chat) {
            var to = [];
            if (chat.object.model.get('chatroom')) {
                for (var u in chat.object.occupantsview.getAll() ){
                    to.push(String(u));
                } 
            } else {
                to = [chat.object.model.get('jid')];
            }
            KRYPTOS.Keys.getRecipientsPublicKeys(to, function(success, message) {
                if (success) {
                    var plainText = encodeURIComponent(KRYPTOS.utils.escapeHTML(chat.message));
                    var Encrypter = new KRYPTOS.Encrypter(plainText, {to:to}, false, function(success, result) {
                        if (success) {
                            result.from = me;
                            if (chat.object.model.get('chatroom')) {
                                chat.object.sendChatRoomMessage(chat.message, KRYPTOS.utils.obj2b64(result));
                            } else {
                                chat.object.sendMessage(chat.message, KRYPTOS.utils.obj2b64(result));
                            }
                        }
                        else {
                            showErrorMessage("Message Not Sent!", "Chat message could not be sent. " + result);
                        }
                    });
                    Encrypter.encryptChatMessage();
                }
                else {
                    showErrorMessage("Message Not Sent!", "Chat message could not be sent. " + message);
                }
            });
        }); 
    };
    
    var handleStatus = function() {
        converse.listen.on('statusChanged', function (event, status) {
            setMyStatus(status);
        });
    };
    
    var handleContactStatus = function() {
        converse.listen.on('contactStatusChanged', function (event, buddy, status) {
            setContactStatus(buddy.user_id, buddy.chat_status);
            if (buddy.chat_status === 'online') {
                showSuccessMessage("Online", buddy.user_id + " just came online.");
            }
        });
    };
    
    var handleNoresumableSession = function() {
        converse.listen.on('noResumeableSession', function (event) {

        });
    };
    
    var handleReconnect = function() {
        converse.listen.on('reconnect', function (event) {
            
        });
    };
    
    var setMyStatus = function(status) {
        $('#my-status').html(getContactStatus(status, true));
    };
    
    var getContacts = function() {
        if (!isEnabled()) {
            return; // Chat disabled
        }
        return converse.contacts.get();
    };
    
    var setContactStatus = function(username, status) {
        var selector = username.replace(".", "\\.");
        $('.inbox #contact-' + selector + ' .status').html(getContactStatus(status, false));
    };
    
    var getContactStatus = function(status, iconOnly) {
        if (!isEnabled()) {
            return; // Chat disabled
        }
        var html = "";
        switch(status) {
            case 'offline': html = '<span class="icon-offline"></span>' + (!iconOnly ? "Offline" : ""); break;
            case 'online': html = '<span class="icon-online"></span>' + (!iconOnly ? "Online" : ""); break;
            case 'dnd': html = '<span class="icon-dnd"></span>' + (!iconOnly ? "Busy" : ""); break;
            case 'away': html = '<span class="icon-away"></span>' + (!iconOnly ? "Away" : ""); break;
        }
        return html;
    };
    
    var openChat = function(jid) {
        converse.chats.open(jid);
    };
    
    var openControl = function() {
        converse.controlbox.showControlBox();
    };
    
    var closeControl = function() {
        
    };
    
    var toggleControl = function(e) {
        if (!isEnabled()) {
            return; // Chat disabled
        }
        converse.controlbox.toggle(e);
    };
    
    var uniqueGroupName = function() {
        return KRYPTOS.utils.ab2hex(KRYPTOS.randomValue(64));
    };
    
    var reset = function() {
        activeWindow = true;
        unreadMessages = 0;
    };
    
    var count = function() {
        activeWindow = false;
        unreadMessages = 0;
    };
    
    var getUnreadMessages = function() {
        return unreadMessages;
    };
    
    return {
        init: init,
        logout: logout,
        reset: reset,
        count: count,
        getUnreadMessages: getUnreadMessages,
        getContacts: getContacts,
        setContactStatus: setContactStatus,
        getContactStatus: getContactStatus,
        openChat: openChat,
        toggleControl: toggleControl,
        openControl: openControl,
        closeControl: closeControl,
    };
            
}();

