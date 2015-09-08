/* global KRYPTOS, Promise */

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
 * The KRYPTOS Key Store module.
 * 
 * @param {String} plainText
 * @param {CryptoKey} theirPublicKey
 * @param {function} callback
 * @returns {KRYPTOS.Encrypter} the public methods
 */
KRYPTOS.KeyStore = function (service, prefix) {
    
    var service = service;
    
    var publicKeyPrefix = "pub" + prefix;
    
    var encryptKeyPair = null;
    
    var signKeyPair = null;
    
    var wrappedPDK = null;
    
    var wrappedPSK = null;
    
    var ivPDK = null;
    
    var ivPSK = null;
    
    var exportedPublicEncryptKey = null;
    
    var exportedPublicVerifyKey = null;
    
    var intermediateKey = null; // only used during setup
    
    var setupData = null;
    
    var setupCallback;
    
    var cachePSK = false;
    
    var cachedPSK = null;
    
    var isLoaded = function() {
        return (ivPDK && ivPSK && wrappedPDK && wrappedPSK) !== null;
    };
    
    var justSetUp = function() {
        return setupData !== null;
    };
    
    var setSetUp = function() {
       setupData = null; 
    };
    
    var setCachePsk = function(cache) {
        cachePSK = cache;
        if (cache === false) {
            cachedPSK = null;
        }
    };

    var getPrivateKeys = function (callback) {        
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/keys/private?service=' + service, true);
        xhr.responseType = 'blob';
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.setRequestHeader('X-CSRF-Token', getToken());
        xhr.onload = function(e) {
            var blob = new Blob([xhr.response], {type: "application/octet-stream"});
            KRYPTOS.utils.readBlob(blob, function() {                    
                var reader          = this;
                var data            = reader.result;
                var twoBytesLength  = 2;
                var ivLength        = 16;
                var pdkLength       = new Uint16Array(data, 0, twoBytesLength)[0];
                var ivPdk           = new Uint8Array(data, twoBytesLength, ivLength);
                var ivPsk           = new Uint8Array(data, twoBytesLength + ivLength, ivLength);
                var pdk             = new Uint8Array(data, twoBytesLength + ivLength + ivLength, pdkLength);
                var psk             = new Uint8Array(data, twoBytesLength + ivLength + ivLength + pdkLength);

                wrappedPDK = pdk;
                wrappedPSK = psk;
                ivPDK = ivPdk;
                ivPSK = ivPsk;
                if (callback) {
                    callback();
                }
            });
        };
        xhr.onerror = function(e) {    
            if (callback) {
                callback(false, "Couldn't load private keys");
            }
        };
        xhr.send();
    };
    
    /**
     * Set up new key pairs for storage.
     * 
     * @param {function} callback
     * @returns {unresolved}
     */
    var setup = function(callback) {
        ivPDK = KRYPTOS.nonce();
        ivPSK = KRYPTOS.nonce();
        setupCallback = callback;
        setupData = {
            public_keys: null,
            private_keys: null
        };

        return KRYPTOS.importIntermediateKeyWrapKey() //.catch(function (error) {console.log('c1'); console.log(error); KRYPTOS.utils.log(error);})
                .then(function(key) {
                    intermediateKey = key;
                    return;
                })
                .then(KRYPTOS.generateEncryptionKeyPair) //.catch(function (error) {console.log('c2'); console.log(error); KRYPTOS.utils.log(error);})
                .then(function(keyPair) {
                    encryptKeyPair = keyPair;
                })
                .then(wrapPrivateDecryptKey) //.catch(function (error) {console.log('c3'); console.log(error); KRYPTOS.utils.log(error);})
                .then(function(wrappedKey) {
                    wrappedPDK = wrappedKey;
                })
                .then(KRYPTOS.generateSignatureKeyPair) //.catch(function (error) {console.log('c4'); console.log(error); KRYPTOS.utils.log(error);})
                .then(function(keyPair) {
                    signKeyPair = keyPair;
                })
                .then(wrapPrivateSignKey) //.catch(function (error) {console.log('c5'); console.log(error); KRYPTOS.utils.log(error);})
                .then(function(wrappedKey) {
                    wrappedPSK = wrappedKey;
                })
                .then(exportPublicEncryptKey) //.catch(function (error) {console.log('c6'); console.log(error); KRYPTOS.utils.log(error);})
                .then(savePublicEncryptKey)
                .then(exportPublicSignKey) //.catch(function (error) {console.log('c7'); console.log(error); KRYPTOS.utils.log(error);})
                .then(savePublicSignKey)
                .then(packageAndSetup)
                .catch(function(error) {
                    KRYPTOS.utils.log(error);
                    setupCallback(false, error);
                });
    };
    
    /**
     * Wrap the private decryption key.
     * 
     * @returns {unresolved}
     */
    var wrapPrivateDecryptKey = function() {        
        if (KRYPTOS.MSR) {
            return msrWrapPrivateDecryptKey();
        }      
        return KRYPTOS.cryptoSubtle.wrapKey("jwk", encryptKeyPair.privateKey, intermediateKey, {name: "AES-CBC", iv: ivPDK});
    };
    
    /**
     * Wrap the private decryption key for non web crypto api browsers.
     * 
     * @returns {unresolved}
     */
    var msrWrapPrivateDecryptKey = function() {
        var op = KRYPTOS.cryptoSubtle.encrypt({name: "AES-CBC", iv: ivPDK}, intermediateKey, KRYPTOS.utils.toSupportedArray(JSON.stringify(encryptKeyPair.private)));
        return KRYPTOS.msrPromise(op);
    };
    
    /**
     * Wrape the private sign key.
     * 
     * @returns {Promise} of wrapKey
     */
    var wrapPrivateSignKey = function() {        
        if (KRYPTOS.MSR) {
            return msrWrapPrivateSignKey();
        }
        return KRYPTOS.cryptoSubtle.wrapKey("jwk", signKeyPair.privateKey, intermediateKey, {name: "AES-CBC", iv: ivPSK});
    };
    
    /**
     * Wrap the private sign key for non web crypto api browsers.
     * 
     * @returns {unresolved}
     */
    var msrWrapPrivateSignKey = function() {
        var op = KRYPTOS.cryptoSubtle.encrypt({name: "AES-CBC", iv: ivPSK}, intermediateKey, KRYPTOS.utils.toSupportedArray(JSON.stringify(signKeyPair.private)));
        return KRYPTOS.msrPromise(op);
    };
    
    /**
     * Export the public encryption key
     * 
     * @returns {Promise} of exportKey
     */
    var exportPublicEncryptKey = function() {
        if (KRYPTOS.MSR) {
            return encryptKeyPair.public;
        }
        return KRYPTOS.cryptoSubtle.exportKey("jwk", encryptKeyPair.publicKey);
    };
    
    /**
     * Save the public encryption key.
     * 
     * @param {jwk} publicEncryptKey
     * @returns {void}
     */
    var savePublicEncryptKey = function(publicEncryptKey) {
        exportedPublicEncryptKey = publicEncryptKey;
    };
    
    /**
     * Export the public sign key.
     * 
     * @returns {Promise} of exportKey
     */
    var exportPublicSignKey = function() {
        if (KRYPTOS.MSR) {
            return signKeyPair.public;
        }
        return KRYPTOS.cryptoSubtle.exportKey("jwk", signKeyPair.publicKey);
    };
    
    /**
     * Save the public sign key.
     * 
     * @param {jwk} publicSignKey
     * @returns {void}
     */
    var savePublicSignKey = function(publicSignKey) {
        exportedPublicVerifyKey = publicSignKey;
    };
    
    /**
     * Package up the public keys into a Blob.
     * 
     * @returns {Blob}
     */
    var packagePublicKeys = function() {
        return JSON.stringify({
            encrypt: exportedPublicEncryptKey,
            verify: exportedPublicVerifyKey
        });
    };
    
    /**
     * Package into a Blob, the private decryption and sign keys.
     * 
     * @returns {Blob}
     */
    var packagePrivateKeys = function() {
        var length = new Uint16Array([wrappedPDK.byteLength]);
        return new Blob(
                [
                    length,
                    ivPDK,
                    ivPSK,
                    wrappedPDK,
                    wrappedPSK
                ],
                {type: "application/octet-stream"}
            );
    };
    
    /**
     * Package up the keys and set up new user.
     * 
     * @returns {undefined}
     */
    var packageAndSetup = function() {      
        setupData.public_keys = packagePublicKeys();
        setupData.private_keys = packagePrivateKeys();
        KRYPTOS.session.removeItem('has_' + service);
        setupCallback(true, setupData);
    };
    
    var getPdk = function(callback) {
        return KRYPTOS.importIntermediateKeyUnwrapKey()
                .then(unwrapPrivateDecryptionKey)
                .then(function(pdk) {
                    callback(true, pdk);
                }).catch(function(error) {
                    KRYPTOS.utils.log(error);
                    callback(false, error.message ? error.message : error);
                });
    };
    
    var unwrapPrivateDecryptionKey = function(key) {
        if (KRYPTOS.MSR) {
            return msrUnwrapPrivateDecryptionKey(key);
        }
        return KRYPTOS.cryptoSubtle.unwrapKey("jwk", wrappedPDK, key, {name: "AES-CBC", iv: ivPDK}, {name: "RSA-OAEP", hash: {name: "SHA-256"}}, KRYPTOS.NONEXTRACTABLE, ["decrypt"]);
    };
    
    var msrUnwrapPrivateDecryptionKey = function(key) {
        var op = KRYPTOS.cryptoSubtle.decrypt({name: "AES-CBC", iv: ivPDK}, key, KRYPTOS.utils.toSupportedArray(wrappedPDK));       
        return KRYPTOS.msrPromise(op)
                .then(function(result) {
                    return msrImportPrivateDecryptionKey(KRYPTOS.utils.toSupportedArray(KRYPTOS.utils.ab2str(result)));
                });
    };
    
    var getPsk = function(iak) {
        if (cachePSK) {
            if (cachedPSK !== null) {
                return cachedPSK;
            }
            return KRYPTOS.importIntermediateKeyUnwrapKey()
                    .then(unwrapPrivateSignKey)
                    .then(function(psk) {
                        cachedPSK = psk;
                        return cachedPSK;
                    });
        }
        else {
            return KRYPTOS.importIntermediateKeyUnwrapKey()
                    .then(unwrapPrivateSignKey);
        }
    };
    
    var unwrapPrivateSignKey = function(key) {
        if (KRYPTOS.MSR) {
            return msrUnwrapPrivateSignKey(key);
        }
        return KRYPTOS.cryptoSubtle.unwrapKey("jwk", wrappedPSK, key, {name: "AES-CBC", iv: ivPSK}, {name: "RSASSA-PKCS1-v1_5", hash: {name: "SHA-256"}}, KRYPTOS.NONEXTRACTABLE, ["sign"]);
    };
    
    var msrUnwrapPrivateSignKey = function(key) {
        var op = KRYPTOS.cryptoSubtle.decrypt({name: "AES-CBC", iv: ivPSK}, key, KRYPTOS.utils.toSupportedArray(wrappedPSK));
        return KRYPTOS.msrPromise(op)
                .then(function(result) {
                    return msrImportPrivateSignKey(KRYPTOS.utils.toSupportedArray(KRYPTOS.utils.ab2str(result)));
                });
    };
    
    var msrImportPrivateDecryptionKey = function(pdk) {
        var op = KRYPTOS.cryptoSubtle.importKey("jwk", pdk, KRYPTOS.RSA_OAEP, false, ["decrypt"]);
        return KRYPTOS.msrPromise(op);
    };
    
    var msrImportPrivateSignKey = function(psk) {
        var op = KRYPTOS.cryptoSubtle.importKey("jwk", psk, KRYPTOS.RSASSA_PKCS1_v1_5, false, ["sign"]);
        return KRYPTOS.msrPromise(op);
    };
    
    var getPek = function() {
        return exportedPublicEncryptKey;
    };
    
    var getPvk = function() {
        return exportedPublicVerifyKey;
    };
    
    var setPek = function(pek) {
        exportedPublicEncryptKey = pek;
    };
    
    var setPvk = function(pvk) {
        exportedPublicVerifyKey = pvk;
    };
    
    var setPublicKeys = function(json) {
        var publicKeys = JSON.parse(json);
        setPek(publicKeys.encrypt);
        setPvk(publicKeys.verify);
    };
    
    /**
     * Retrieve the public keys.
     * 
     * @param {String} emails
     * @param {function} callback
     * @returns {undefined}
     */
    var getPublicKeys = function(emails, callback) {
        if (KRYPTOS.utils.isEmpty(emails)) {
             callback(false, "No emails provided.");
             return;
        }
        var usernames = "";
        if (emails.length > 10) {
            callback(false, "Max 10 recipients allowed.");
            return;
        }
        for (var i = 0; i < emails.length; i++) {
            var username = KRYPTOS.utils.e2u(emails[i]);
            if (KRYPTOS.session.getItem(publicKeyPrefix + username) || username === '') continue; // Skip if we already got the public keys in sessionStorage
            usernames += username + ",";
        }
        if (usernames === '') {
            callback(true, "Done!");
            return;
        }       
         
        var jqxhr = $.getJSON("/keys/public?service="+service+"&usernames=" + usernames, function(data) {
            if (data) {
                for (var i = 0; i < data.length; i++) {
                    KRYPTOS.session.setItem(publicKeyPrefix + data[i].username, data[i].public_keys);
                }
            }
            callback(true, "");
        });
        jqxhr.fail(function(response) {            
            var $er = $.parseJSON(jqxhr.responseText);
            callback(false, $er.errors.username);
        });

    };
    
    var getRecipientPublicKeys = function(username) {
        return JSON.parse(KRYPTOS.session.getItem(publicKeyPrefix + username));
    };

    return {
        justSetUp: justSetUp,
        setSetUp: setSetUp,
        isLoaded: isLoaded,
        setCachePsk: setCachePsk,
        getPrivateKeys: getPrivateKeys,
        setup: setup,
        getPek: getPek,
        getPvk: getPvk,
        getPdk: getPdk,
        getPsk: getPsk,
        setPek: setPek,
        setPvk: setPvk,
        setPublicKeys: setPublicKeys,
        unwrapPrivateSignKey: unwrapPrivateSignKey,
        getPublicKeys: getPublicKeys,
        getRecipientPublicKeys: getRecipientPublicKeys
    };
};



