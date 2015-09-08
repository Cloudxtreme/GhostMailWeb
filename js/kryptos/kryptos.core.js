/* global sjcl, ES6Promise */
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
 * The KRYPTOS Core module.
 */
var KRYPTOS = KRYPTOS || {
    
    /**
     * 256 bytes length
     */
    LENGTH_256: 256,
    
    /**
     * SHA-256 hashing algorithm
     */
    SHA_256: {
        name: "SHA-256"
    },
    
    /**
     * RSA-PSS signing alogrithm
     */
    RSA_PSS: {
        name: "RSS-PSS"
    },
    
    RSA_OAEP: {
        name: "RSA-OAEP"
    },
    
    AES_CBC: {
        name: "AES-CBC"
    },
    
    AES_KW: {
        name: "AES-KW"
    },
    
    AES_GCM: {
        name: "AES-GCM"
    },
    
    HMAC: {
        name: "HMAC"
    },
    
    RSASSA_PKCS1_v1_5: {
        name: "RSASSA-PKCS1-v1_5"
    },
    
    RSASSA_PKCS1_v1_5_ALGO: {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),  // 24 bit representation of 65537
        hash: {
            name: "SHA-256"
        }
    },
    
    /**
     * Assymetric encryption algorithm
     */
    RSA_OAEP_ALGO: {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),  // 24 bit representation of 65537
        hash: {
            name: "SHA-256"
        }
    },
    
    /**
     * Symmetric encryption algorithm
     */
    AES_CBC_ALGO: {
        name: "AES-CBC", 
        length: 256
    },
    
    /**
     * Key wrap algorithm
     */
    AES_KW_ALGO: {
        name: "AES-KW", 
        length: 256
    },
    
    HMAC_ALGO: { 
        name: "HMAC", 
        hash: {
            name: "SHA-256"
        }
    },
    
    /**
     * Indicates if crypto library fallback
     */
    MSR: false,
    
    MS: false,
    
    SF: false,
    
    EXTRACTABLE: true,
    
    NONEXTRACTABLE: false,
    
    ENCRYPT_USAGE: ["encrypt", "decrypt"],
    
    SIGN_USAGE: ["sign", "verify"],
    
    WRAP_USAGE: ["wrapKey", "unwrapKey"],
    
    crypto: null,
    
    cryptoSubtle: null,
    
    Promise: null,
    
    session: window.sessionStorage,
    
    store: window.localStorage,
    
    rawIntermediateKey: null,
    
    intermediateKey: null,
    
    encryptKeyPair: null,
    
    signKeyPair: null,
    
    wrappedPrivateEncryptKey: null,
    
    wrappedPrivateSignKey: null,
    
    exportedPublicEncryptKey: null,
    
    exportedPublicSignKey: null,
    
    aesKey: null,
    
    ivIAK: null,
    
    ivPDK: null,
    
    ivPSK: null,
    
    setupData: null,
    
    setupCallback: null,
    
    mailPassword: null,
    
    accountPassword: null,
    
    nonce: function() {
        return KRYPTOS.randomValue(16);
    },
    
    randomValue: function(bytes) {
        return KRYPTOS.crypto.getRandomValues(new Uint8Array(bytes));
    },
    
    uniqueFileId: function() {
        return KRYPTOS.utils.ab2hex(KRYPTOS.randomValue(4));
    },
    
    format: function() {
        if (KRYPTOS.MSR) {
            return 'jwk';
        }
        return 'raw';
    },
    
    hasKey: function() {
        return KRYPTOS.session.getItem('h');
    },
    
    
    /**
     * This is the user's hashed password used in various encryptions of 
     * messages and key 'raps :)
     * 
     * @param {string} key
     * @returns {ByteArray} of the hash presented in hexa-decimals
     */
    key: function(key) {
        if (!key) {
            key = KRYPTOS.mailPassword;
        }
        if (KRYPTOS.MSR) {
            return KRYPTOS.msrKey(key);
        }
        return KRYPTOS.utils.hex2ab(key);
        //return KRYPTOS.utils.hex2ab(KRYPTOS.session.getItem('h'));
    },
    
    msrKey: function(key) {
        return KRYPTOS.utils.toSupportedArray(KRYPTOS.utils.aesKey2Jwk(key, true));
    },
    
    /**
     * This is the user's hashed account password used to HMAC sign and verify
     * the wrapped intermediate key.
     * 
     * @param {string} key
     * @returns {ByteArray} of the hash presented in hexa-decimals
     */
    hmacKey: function(key) {
        if (!key) {            
            key = KRYPTOS.accountPassword;
        }
        return KRYPTOS.utils.hex2ab(key);
    },
    
    iak: function() {
        
        var key = KRYPTOS.session.getItem('iak');
        if (!key) {
            return null;
        }
        if (KRYPTOS.MSR) {
            
            return KRYPTOS.utils.toSupportedArray(key);
        }
        return JSON.parse(key);
    },
    
    clear: function() {
        KRYPTOS.mailPassword = null;
        KRYPTOS.accountPassword = null;
        KRYPTOS.rawIntermediateKey = null;
        KRYPTOS.intermediateKey = null;
        KRYPTOS.encryptKeyPair = null;        
        KRYPTOS.signKeyPair = null;
        KRYPTOS.wrappedPrivateEncryptKey = null;
        KRYPTOS.wrappedPrivateSignKey = null;
        KRYPTOS.exportedPublicEncryptKey = null;
        KRYPTOS.exportedPublicSignKey = null;
        KRYPTOS.aesKey = null;
        KRYPTOS.ivPDK = null;
        KRYPTOS.ivPSK = null;
        KRYPTOS.setupData = null;
        KRYPTOS.session.clear();
    },
    
    /**
     * Compute the account password and the private key password based on hashes
     * of the plain password and the username@domain. The private key password
     * is stored in session storage. If a callback function is provided it will
     * be called when all digest Promises have completed successfully.
     * 
     * The init function is used for both the sign-in and registration flow.
     * 
     * @param {string} username plain text
     * @param {string} password plain text
     * @param {string} domain plain text
     * @param {type} callback
     * @returns {void}
     */
    init: function(username, password, domain, callback) {        
        return KRYPTOS.getDerivedPassword(username + "@" + domain, password)
                .then(function(accountPassword) {
                    KRYPTOS.accountPassword = accountPassword;
                    return KRYPTOS.getDerivedPassword(username + "@" + domain + username, password);
                })
                .then(function(mailPassword) {
                    KRYPTOS.mailPassword = mailPassword;
                    if (callback) {
                        callback(username, KRYPTOS.accountPassword, KRYPTOS.mailPassword);
                    }
                })
                .catch(function(error) {
                    KRYPTOS.utils.log(error);
                });
    },
    
    /**
     * Derives a 256 bit key based on a password, using the PBKDF2 algorithm
     * with 5000 rounds.
     * 
     * @param {type} salt
     * @param {type} password
     * @returns {String}
     */
    getDerivedPassword: function(salt, password) {
//        var rounds = 5000;
//        var length = 256;
//        var derivedKey = sjcl.misc.pbkdf2(password, sjcl.codec.utf8String.toBits(salt), rounds, length);
//        return sjcl.codec.hex.fromBits(derivedKey);
        
        return new KRYPTOS.Promise(function (resolve, reject) {
            var rounds = 5000;
            var length = 256;
            var derivedKey = sjcl.misc.pbkdf2(password, sjcl.codec.utf8String.toBits(salt), rounds, length);
            resolve(sjcl.codec.hex.fromBits(derivedKey));
        });
    },
    
    /**
     * Common Promise handler used for MSR crypto operations.
     * 
     * @param {type} operation
     * @param {boolean} resetNative
     * @returns {KRYPTOS.Promise}
     */
    msrPromise: function(operation, resetNative) {
        return new KRYPTOS.Promise(function (resolve, reject) {
            operation.oncomplete = function(result) {
                if (resetNative) {
                    KRYPTOS.check.resetMsrCryptoSupport();
                }
                resolve(result.target.result);
            };
            operation.onerror = function(error) {
                if (resetNative) {
                    KRYPTOS.check.resetMsrCryptoSupport();
                }
                reject(error);
            };
        });
    },
    
    /**
     * KEY PAIRS SETUP
     */
    
    /**
     * Sets up the user account and the user keys.
     * 
     * @param {string} username
     * @param {string} password
     * @param {string} domain
     * @param {function} callback
     * @returns {void}
     */
    setup: function(username, password, domain, callback) {
        KRYPTOS.init(username, password, domain, function(username, accountPassword, mailPassword) {
            KRYPTOS.setupData = {
                username: username,
                password: accountPassword,
                public_keys: null,
                private_keys: null,
                key: null
            };
            KRYPTOS.mailPassword = mailPassword;
            
            
            
            
            KRYPTOS.setupCallback = callback;
            return KRYPTOS.setupKeyPairs();
        });        
    },
    
    /**
     * Generate the encrypting and signing key pairs and back them up. 
     * Private keys are wrapped/encrypted before backing them up.
     * The setupCompleted Event is dispatched when the setup is completed.
     * 
     * @returns nothing
     */
    setupKeyPairs: function() {
        return this.importAesKey()
            .then(this.saveAesKey) 
            .then(this.generateIntermediateKey)
            .then(this.importIntermediateKey)
            .then(this.saveIntermediateKey)
            .then(this.wrapIntermediateKey)
            .then(this.saveWrappedIntermediateKey)
            .then(this.generateEncryptionKeyPair)
            .then(this.saveEncryptingKeyPair)
            .then(this.wrapPrivateDecryptKey)
            .then(this.saveWrappedPrivateDecryptKey)
            .then(this.generateSignatureKeyPair)
            .then(this.saveSigningKeyPair)
            .then(this.wrapPrivateSignKey)
            .then(this.saveWrappedPrivateSignKey)
            .then(this.exportPublicEncryptKey)
            .then(this.savePublicEncryptKey)
            .then(this.exportPublicSignKey)
            .then(this.savePublicSignKey)
            .then(this.packageAndSetup)
            .catch(function(error) {
                KRYPTOS.utils.log(error);
                KRYPTOS.clear();

            });
    },
    
    /**
     * Import the AES key
     * 
     * @param {String} key
     * @returns {Promise} of importKey
     */
    importAesKey: function(key) {
        if (KRYPTOS.MSR) {
            return KRYPTOS.msrImportAesKey(key);
        }
        return KRYPTOS.cryptoSubtle.importKey(KRYPTOS.format(), KRYPTOS.key(key), KRYPTOS.AES_CBC, KRYPTOS.NONEXTRACTABLE, ["wrapKey"]);
    },
    
    msrImportAesKey: function(key) {
        var op = KRYPTOS.cryptoSubtle.importKey(KRYPTOS.format(), KRYPTOS.key(key), KRYPTOS.AES_CBC, KRYPTOS.NONEXTRACTABLE, ["wrapKey"]);
        return KRYPTOS.msrPromise(op);
    },
    
    /**
     * Save the AES key.
     * 
     * @param {ByteArray} key
     * @returns {ByteArray} key
     */
    saveAesKey: function(key) {
        KRYPTOS.aesKey = key;
        return key;
    },
    
    /**
     * Generate 256 bit key.
     * 
     * @returns {ByteArray} key
     */
    generateIntermediateKey: function() {
        KRYPTOS.rawIntermediateKey = KRYPTOS.randomValue(32); // 256 bit key
        return KRYPTOS.rawIntermediateKey; // 256 bit key
    },
    
    importIntermediateKey: function(intermediateKey) {
        if (KRYPTOS.MSR) {
            return KRYPTOS.msrImportIntermediateKey(intermediateKey);
        }
        return KRYPTOS.cryptoSubtle.importKey(KRYPTOS.format(), intermediateKey, KRYPTOS.AES_CBC, KRYPTOS.EXTRACTABLE, KRYPTOS.WRAP_USAGE.concat(KRYPTOS.ENCRYPT_USAGE));
    },
    
    msrImportIntermediateKey: function(intermediateKey) {
        var op = KRYPTOS.cryptoSubtle.importKey(KRYPTOS.format(), KRYPTOS.utils.toSupportedArray(KRYPTOS.utils.aesKey2Jwk(intermediateKey, true)), KRYPTOS.AES_CBC, KRYPTOS.EXTRACTABLE, KRYPTOS.WRAP_USAGE.concat(KRYPTOS.ENCRYPT_USAGE));
        return KRYPTOS.msrPromise(op);
    },
    //KRYPTOS.utils.toSupportedArray(KRYPTOS.utils.aesKey2Jwk(intermediateKey, true))
    
    saveIntermediateKey: function(key) {        
        KRYPTOS.intermediateKey = key;        
        return KRYPTOS.intermediateKey;
    },
    
    /**
     * Wrap the intermediate key.
     * 
     * @param {ByteArray} key
     * @returns {Promise} of wrapKey
     */
    wrapIntermediateKey: function(key) {
        if (KRYPTOS.MSR) {
            return KRYPTOS.msrWrapIntermediateKey(key);
        }
        KRYPTOS.ivIAK = KRYPTOS.nonce();
        return KRYPTOS.cryptoSubtle.wrapKey("raw", key, KRYPTOS.aesKey, {name: "AES-CBC", iv: KRYPTOS.ivIAK}); 
    },
    
    /**
     * Wrap the intermediate key with unsupported wrapKey operation.
     * 
     * @param {ByteArray} key
     * @returns {Promise} of wrapKey
     */
    msrWrapIntermediateKey: function(key) {
        KRYPTOS.ivIAK = KRYPTOS.nonce();
//        if (!key) {
//            key = KRYPTOS.rawIntermediateKey;
//        }
        var op = KRYPTOS.cryptoSubtle.encrypt({name: "AES-CBC", iv: KRYPTOS.ivIAK}, KRYPTOS.aesKey, KRYPTOS.utils.toSupportedArray(KRYPTOS.rawIntermediateKey));
        return KRYPTOS.msrPromise(op);
    },
    
    /**
     * Save the wrapped intermediate key.
     * 
     * @param {jwk} wrappedKey
     * @returns {void}
     */
    saveWrappedIntermediateKey: function(wrappedKey) {
        KRYPTOS.wrappedIntermediateKey = wrappedKey;
    },
    
    /**
     * Package into a Blob, the wrapped intermediate key.
     * 
     * @returns {Blob}
     */
    packageIntermediateKey: function() {        
        
        return new Blob(
                [
                    KRYPTOS.ivIAK,
                    KRYPTOS.wrappedIntermediateKey 
                ],
                {type: "application/octet-stream"}
            );
    },
    
    /**
     * Generate the encrypting key pair.
     * 
     * @returns a Promise
     */
    generateEncryptionKeyPair: function() {
        if (KRYPTOS.MSR) {
            if (KRYPTOS.check.forceNative()) {
//                console.log('generating encryption key pair');
                var op = KRYPTOS.cryptoSubtle.generateKey(KRYPTOS.RSA_OAEP_ALGO, KRYPTOS.EXTRACTABLE, KRYPTOS.ENCRYPT_USAGE);
                return KRYPTOS.msrPromise(op, true);
            }
            return KRYPTOS.msrGenerateEncryptionKeyPair();
        }
        return KRYPTOS.cryptoSubtle.generateKey(KRYPTOS.RSA_OAEP_ALGO, KRYPTOS.EXTRACTABLE, KRYPTOS.ENCRYPT_USAGE);
    },
    
    /**
     * Generate the encrypting key pair.
     * 
     * @returns a Promise
     */
    msrGenerateEncryptionKeyPair: function() {
        
        return new KRYPTOS.Promise(function (resolve, reject) {
            var rsaKey = new KRYPTOS.RSA().generateKey(KRYPTOS.RSA_OAEP_ALGO, KRYPTOS.EXTRACTABLE, KRYPTOS.ENCRYPT_USAGE);
            resolve(rsaKey);
        });
    },
    
    msrImportPrivateDecryptionKey: function(pdk) {
        var op = KRYPTOS.cryptoSubtle.importKey("jwk", pdk, KRYPTOS.RSA_OAEP, false, ["decrypt"]);
        return KRYPTOS.msrPromise(op);
    },
    
    msrImportPrivateSignKey: function(psk) {
        var op = KRYPTOS.cryptoSubtle.importKey("jwk", psk, KRYPTOS.RSASSA_PKCS1_v1_5, false, ["sign"]);
        return KRYPTOS.msrPromise(op);
    },
    
    /**
     * Save the encrypting key pair in memory for later use.
     * 
     * @param {CryptoKeyPair} keyPair
     * @returns nothing
     */
    saveEncryptingKeyPair: function(keyPair) {
//        console.log('saveEncryptingKeyPair');
//        console.log(keyPair);
        KRYPTOS.encryptKeyPair = keyPair;        
    },
    
    exportPrivateDecryptKey: function() {
         
        return KRYPTOS.cryptoSubtle.exportKey("jwk", KRYPTOS.encryptKeyPair.privateKey);
    },
    
    saveExportedPrivateDecryptKey: function(jwk) {

    },
    
    /**
     * Wrap the private decryption key.
     * 
     * @returns {unresolved}
     */
    wrapPrivateDecryptKey: function() {        
        if (KRYPTOS.MSR) {
            return KRYPTOS.msrWrapPrivateDecryptKey();
        }
        KRYPTOS.ivPDK = KRYPTOS.nonce();        
        return KRYPTOS.cryptoSubtle.wrapKey("jwk", KRYPTOS.encryptKeyPair.privateKey, KRYPTOS.intermediateKey, {name: "AES-CBC", iv: KRYPTOS.ivPDK});
    },
    
    /**
     * Wrap the private decryption key.
     * 
     * @returns {unresolved}
     */
    msrWrapPrivateDecryptKey: function() {
//        console.log('msrWrapPrivateDecryptKey'); //TBlqEpkSpaZbsyXZZlJVDdCmErvzGWxdGSWuSajMcMgudPlWDl
        KRYPTOS.ivPDK = KRYPTOS.nonce();
        //var privateKey = KRYPTOS.encryptKeyPair.privateKey || KRYPTOS.encryptKeyPair.private;
        if (KRYPTOS.check.forceNative()) { //MS API
            console.log('Exporting...');
            var exportOp = KRYPTOS.cryptoSubtle.exportKey("jwk", KRYPTOS.encryptKeyPair.privateKey);
            return KRYPTOS.msrPromise(exportOp, true).then(function(privateKey) {
//                console.log('exported key');
//                console.log(privateKey);
//                console.log(KRYPTOS.utils.ab2str(privateKey));
//                console.log(JSON.parse(KRYPTOS.utils.ab2str(privateKey)));
//                console.log(KRYPTOS.utils.ab2jwk(privateKey));
                var wrapOp = KRYPTOS.cryptoSubtle.encrypt({name: "AES-CBC", iv: KRYPTOS.ivPDK}, KRYPTOS.intermediateKey, KRYPTOS.utils.toSupportedArray(JSON.stringify(KRYPTOS.utils.ab2jwk(privateKey))));
                return KRYPTOS.msrPromise(wrapOp);
            }).catch(function(error) {
                KRYPTOS.utils.log(error);
                KRYPTOS.check.resetMsrCryptoSupport();
            });
            
        }
        else { // MSR
            var op = KRYPTOS.cryptoSubtle.encrypt({name: "AES-CBC", iv: KRYPTOS.ivPDK}, KRYPTOS.intermediateKey, KRYPTOS.utils.toSupportedArray(JSON.stringify(KRYPTOS.encryptKeyPair.private)));
            return KRYPTOS.msrPromise(op);
        }
//        console.log('msrWrapPrivateDecryptKey');
//        console.log(privateKey);
//        var exportOp = KRYPTOS.cryptoSubtle.exportKey("jwk", KRYPTOS.encryptKeyPair.privateKey);
//        var op = KRYPTOS.cryptoSubtle.encrypt({name: "AES-CBC", iv: KRYPTOS.ivPDK}, KRYPTOS.intermediateKey, KRYPTOS.utils.toSupportedArray(JSON.stringify(privateKey)));
//        return KRYPTOS.msrPromise(op);
    },
    
    /**
     * Save the wrapped decyption key.
     * 
     * @param {jwk} wrappedKey
     * @returns {void}
     */
    saveWrappedPrivateDecryptKey: function(wrappedKey) {
//        console.log('saveWrappedPrivateDecryptKey');
//        console.log(wrappedKey);
        KRYPTOS.wrappedPrivateEncryptKey = wrappedKey;
    },
    
    /**
     * Generate the signature key pair.
     * 
     * @returns {Promise} of generateKey
     */
    generateSignatureKeyPair: function() {
        if (KRYPTOS.MSR) {
            if (KRYPTOS.check.forceNative()) {
                var op = KRYPTOS.cryptoSubtle.generateKey(KRYPTOS.RSASSA_PKCS1_v1_5_ALGO, KRYPTOS.EXTRACTABLE, KRYPTOS.SIGN_USAGE);
                return KRYPTOS.msrPromise(op, true);
            }
            return KRYPTOS.msrGenerateSignatureKeyPair();
        }
        return KRYPTOS.cryptoSubtle.generateKey(KRYPTOS.RSASSA_PKCS1_v1_5_ALGO, KRYPTOS.EXTRACTABLE, KRYPTOS.SIGN_USAGE);
    },
    
    /**
     * Generate the signature key pair.
     * 
     * @returns {Promise} of generateKey
     */
    msrGenerateSignatureKeyPair: function() {

        return new KRYPTOS.Promise(function (resolve, reject) {
            var rsaKey = new KRYPTOS.RSA().generateKey(KRYPTOS.RSASSA_PKCS1_v1_5_ALGO, KRYPTOS.EXTRACTABLE, KRYPTOS.SIGN_USAGE);
            resolve(rsaKey);
        });
    },
    
    /**
     * Save the signature key pair.
     * 
     * @param {raw} keyPair
     * @returns {void}
     */
    saveSigningKeyPair: function(keyPair) {
        KRYPTOS.signKeyPair = keyPair;
        
    },
    
    exportPrivateSignKey: function() {
         
        return KRYPTOS.cryptoSubtle.exportKey("jwk", KRYPTOS.signKeyPair.privateKey);
    },
    
    saveExportedPrivateSignKey: function(jwk) {
        
    },
    
    /**
     * Wrape the private sign key.
     * 
     * @returns {Promise} of wrapKey
     */
    wrapPrivateSignKey: function() {
        
        KRYPTOS.ivPSK = KRYPTOS.nonce();
        if (KRYPTOS.MSR) {
            return KRYPTOS.msrWrapPrivateSignKey();
        }
        return KRYPTOS.cryptoSubtle.wrapKey("jwk", KRYPTOS.signKeyPair.privateKey, KRYPTOS.intermediateKey, {name: "AES-CBC", iv: KRYPTOS.ivPSK});
    },
    
    /**
     * Wrap the private decryption key.
     * 
     * @returns {unresolved}
     */
    msrWrapPrivateSignKey: function() {
        KRYPTOS.ivPSK = KRYPTOS.nonce();
        //var privateKey = KRYPTOS.signKeyPair.privateKey || KRYPTOS.signKeyPair.private;
//        console.log('msrWrapPrivateSignKey');
        if (KRYPTOS.check.forceNative()) { //MS API
            console.log('Exporting sign key...');
            var exportOp = KRYPTOS.cryptoSubtle.exportKey("jwk", KRYPTOS.encryptKeyPair.privateKey);
            return KRYPTOS.msrPromise(exportOp, true).then(function(privateKey) {
//                console.log('exported key');
//                console.log(privateKey);
//                console.log(KRYPTOS.utils.ab2str(privateKey));
//                console.log(JSON.parse(KRYPTOS.utils.ab2str(privateKey)));
//                console.log(KRYPTOS.utils.ab2jwk(privateKey));
                var wrapOp = KRYPTOS.cryptoSubtle.encrypt({name: "AES-CBC", iv: KRYPTOS.ivPSK}, KRYPTOS.intermediateKey, KRYPTOS.utils.toSupportedArray(JSON.stringify(KRYPTOS.utils.ab2jwk(privateKey))));
                return KRYPTOS.msrPromise(wrapOp);
            }).catch(function(error) {
                KRYPTOS.utils.log(error);
                KRYPTOS.check.resetMsrCryptoSupport();
            });
            
        }
        else {
            var op = KRYPTOS.cryptoSubtle.encrypt({name: "AES-CBC", iv: KRYPTOS.ivPSK}, KRYPTOS.intermediateKey, KRYPTOS.utils.toSupportedArray(JSON.stringify(KRYPTOS.signKeyPair.private)));
            return KRYPTOS.msrPromise(op);
        }
    },
    
    /**
     * Save the wrapped private sign key.
     * 
     * @param {jwk} wrappedKey
     * @returns {void}
     */
    saveWrappedPrivateSignKey: function(wrappedKey) {
//        console.log('saveWrappedPrivateSignKey');
//        console.log(wrappedKey);
        KRYPTOS.wrappedPrivateSignKey = wrappedKey;
    },
    
    /**
     * Package into a Blob, the private decryption and sign keys.
     * 
     * @returns {Blob}
     */
    packagePrivateKeys: function() {
         //1680
        var length = new Uint16Array([KRYPTOS.wrappedPrivateEncryptKey.byteLength]);
         //1680
        return new Blob(
                [
                    length,
                    KRYPTOS.ivPDK,
                    KRYPTOS.ivPSK,
                    KRYPTOS.wrappedPrivateEncryptKey,
                    KRYPTOS.wrappedPrivateSignKey 
                ],
                {type: "application/octet-stream"}
            );
    },
    
    /**
     * Export the public encryption key
     * 
     * @returns {Promise} of exportKey
     */
    exportPublicEncryptKey: function() {
        if (KRYPTOS.MSR) {
            if (KRYPTOS.check.forceNative()) {
                var op = KRYPTOS.cryptoSubtle.exportKey("jwk", KRYPTOS.encryptKeyPair.publicKey);
                return KRYPTOS.msrPromise(op).then(function(publicKey) {
//                    console.log('exported public key');
//                    console.log(publicKey);
                    return KRYPTOS.utils.ab2jwk(publicKey);
                });
            }
            return KRYPTOS.encryptKeyPair.public;
        }
        return KRYPTOS.cryptoSubtle.exportKey("jwk", KRYPTOS.encryptKeyPair.publicKey);
    },
    
    /**
     * Save the public encryption key.
     * 
     * @param {jwk} publicEncryptKey
     * @returns {void}
     */
    savePublicEncryptKey: function(publicEncryptKey) {
//        console.log('savePublicEncryptKey');
//        console.log(publicEncryptKey);
        KRYPTOS.exportedPublicEncryptKey = publicEncryptKey;
        
    },
    
    /**
     * Export the public sign key.
     * 
     * @returns {Promise} of exportKey
     */
    exportPublicSignKey: function() {
        if (KRYPTOS.MSR) {
            if (KRYPTOS.check.forceNative()) {
                var op = KRYPTOS.cryptoSubtle.exportKey("jwk", KRYPTOS.signKeyPair.publicKey);
                return KRYPTOS.msrPromise(op).then(function(publicKey) {
//                    console.log('exported public sign key');
//                    console.log(publicKey);
                    return KRYPTOS.utils.ab2jwk(publicKey);
                });
            }
            return KRYPTOS.signKeyPair.public;
        }
        return KRYPTOS.cryptoSubtle.exportKey("jwk", KRYPTOS.signKeyPair.publicKey);
    },
    
    /**
     * Save the public sign key.
     * 
     * @param {jwk} publicSignKey
     * @returns {void}
     */
    savePublicSignKey: function(publicSignKey) {
//        console.log('savePublicSignKey');
//        console.log(publicSignKey);
        KRYPTOS.exportedPublicSignKey = publicSignKey;
        
    },
    
    /**
     * Package up the public keys into a Blob.
     * 
     * @returns {Blob}
     */
    packagePublicKeys: function() {
        return JSON.stringify({
            encrypt: KRYPTOS.exportedPublicEncryptKey,
            verify: KRYPTOS.exportedPublicSignKey
        });
    },
    
    /**
     * Package up the keys and set up new user.
     * 
     * @returns {undefined}
     */
    packageAndSetup: function() {
        
        KRYPTOS.setupData.public_keys = KRYPTOS.packagePublicKeys();
        KRYPTOS.setupData.private_keys = KRYPTOS.packagePrivateKeys();
        KRYPTOS.setupData.key = KRYPTOS.packageIntermediateKey();
        
        return KRYPTOS.utils.sendData(KRYPTOS.setupData, 'users', '', KRYPTOS.setupCallback);
    },
    
    /**
     * INTERMEDIATE KEY RETRIEVAL
     */
    
    intermediateKeyCallback: null,
    
    /**
     * Retrieve the wrapped intermediate key.
     * 
     * @param {ByteArray} intermediateKey
     * @param {ByteArray} ivIak
     * @param {String} mailPassword
     * @param {String} accountPassword
     * @param {function} callback
     * @returns {void}
     */
    retrieveIntermediateKey: function(intermediateKey, ivIak, mailPassword, accountPassword, callback) {
        KRYPTOS.wrappedIntermediateKey = intermediateKey;
        KRYPTOS.ivIAK = ivIak;
        KRYPTOS.mailPassword = mailPassword;
        KRYPTOS.accountPassword = accountPassword;
        KRYPTOS.intermediateKeyCallback = callback;
        
        return this.importAesKeyUnwrapKey()
            .then(this.saveAesKey)
            .then(this.unwrapIntermediateKey)
            .then(this.exportIntermediateKey)                
            .then(this.storeIntermediateKey)
            .then(this.completeIntermediateKeyRetrieval)
            .catch(function(error) {
                KRYPTOS.utils.log(error);
                KRYPTOS.clear();
                if (KRYPTOS.intermediateKeyCallback !== null) {
                    KRYPTOS.intermediateKeyCallback(false, error);
                }
            });
    },
    
    /**
     * Unwrap the intermediate key.
     * 
     * @param {type} key
     * @returns {unresolved}
     */
    unwrapIntermediateKey: function(key) {
        if (KRYPTOS.MSR) {
            return KRYPTOS.msrUnwrapIntermediateKey(key);
        }
        return KRYPTOS.cryptoSubtle.unwrapKey("raw", KRYPTOS.wrappedIntermediateKey, KRYPTOS.aesKey, {name: "AES-CBC", iv: KRYPTOS.ivIAK}, {name: "AES-CBC"}, true, KRYPTOS.WRAP_USAGE.concat(KRYPTOS.ENCRYPT_USAGE));
    },
    
    /**
     * Unwrap the intermediate key.
     * 
     * @param {type} key
     * @returns {unresolved}
     */
    msrUnwrapIntermediateKey: function(key) {
        var op = KRYPTOS.cryptoSubtle.decrypt({name: "AES-CBC", iv: KRYPTOS.ivIAK}, KRYPTOS.aesKey, KRYPTOS.wrappedIntermediateKey);
        return KRYPTOS.msrPromise(op);
    },
    
    exportIntermediateKey: function(intermediateKey) {
        if (KRYPTOS.MSR) {
            KRYPTOS.rawIntermediateKey = intermediateKey;
            return KRYPTOS.utils.aesKey2Jwk(KRYPTOS.utils.ab2hex(intermediateKey), true);
        }
        return KRYPTOS.cryptoSubtle.exportKey('jwk', intermediateKey);
    },
    
    storeIntermediateKey: function(jwk) {
        if (KRYPTOS.MSR) {
            KRYPTOS.msrStoreIntermediateKey(jwk);
        }
        else {
            KRYPTOS.session.setItem('iak', JSON.stringify(jwk));   
        }
    },
    
    msrStoreIntermediateKey: function(jwk) {
        KRYPTOS.session.setItem('iak', jwk);        
    },
    
    completeIntermediateKeyRetrieval: function() {
        KRYPTOS.wrappedIntermediateKey = null;
        KRYPTOS.mailPassword = null;
        if (KRYPTOS.intermediateKeyCallback !== null) {
            KRYPTOS.intermediateKeyCallback(true);
        }
    },
    
    /**
     * KEY PAIRS RETRIEVAL
     */
    
    privateKeysCallback: null,
    
    extractable: function() {
        return KRYPTOS.EXTRACTABLE;
    },
    
    nonExtractable: function() {
        return KRYPTOS.NONEXTRACTABLE;
    },
    
    exportAesKey: function(key) {
        return KRYPTOS.cryptoSubtle.exportKey("raw", key);
    },
    
    importAesKeyUnwrapKey: function() {
        if (KRYPTOS.MSR) {
            return KRYPTOS.msrImportAesKeyUnwrapKey();
        }
        return KRYPTOS.cryptoSubtle.importKey("raw", KRYPTOS.key(), KRYPTOS.AES_CBC_ALGO, KRYPTOS.NONEXTRACTABLE, ["unwrapKey", "decrypt"]);
    },
    
    msrImportAesKeyUnwrapKey: function() {
        var op = KRYPTOS.cryptoSubtle.importKey("raw", KRYPTOS.key(), KRYPTOS.AES_CBC_ALGO, KRYPTOS.NONEXTRACTABLE, ["unwrapKey", "decrypt"]);
        return KRYPTOS.msrPromise(op);
    },
    
    importAesKeyWrapKey: function() {
        
        return KRYPTOS.cryptoSubtle.importKey("raw", KRYPTOS.key(), KRYPTOS.AES_CBC, KRYPTOS.NONEXTRACTABLE, ["wrapKey"]);
    },
    
    importIntermediateKeyUnwrapKey: function() {
        if (KRYPTOS.MSR) {
            return KRYPTOS.msrImportIntermediateKeyUnwrapKey();
        }
        return KRYPTOS.cryptoSubtle.importKey("jwk", KRYPTOS.iak(), KRYPTOS.AES_CBC, KRYPTOS.NONEXTRACTABLE, ["unwrapKey"]);
    },
    
    msrImportIntermediateKeyUnwrapKey: function() {
        var op = KRYPTOS.cryptoSubtle.importKey("jwk", KRYPTOS.iak(), KRYPTOS.AES_CBC, KRYPTOS.NONEXTRACTABLE, ["decrypt"]);        
        return KRYPTOS.msrPromise(op);
        
//        return KRYPTOS.cryptoSubtle.importKey("jwk", KRYPTOS.iak(), KRYPTOS.AES_CBC, KRYPTOS.NONEXTRACTABLE, ["decrypt"]);
    },
    
    msrImportIntermediateKeyWrapKey: function() {
        var op = KRYPTOS.cryptoSubtle.importKey("jwk", KRYPTOS.iak(), KRYPTOS.AES_CBC, KRYPTOS.NONEXTRACTABLE, ["encrypt"]);        
        return KRYPTOS.msrPromise(op);
    },
    
    importIntermediateKeyWrapKey: function() {
        if (KRYPTOS.MSR) {
            return KRYPTOS.msrImportIntermediateKeyWrapKey();
        }
        return KRYPTOS.cryptoSubtle.importKey("jwk", KRYPTOS.iak(), KRYPTOS.AES_CBC, KRYPTOS.NONEXTRACTABLE, ["wrapKey"]);
    },

    unwrapPrivateDecryptionKey: function(key) {
        if (KRYPTOS.MSR) {
            return KRYPTOS.msrUnwrapPrivateDecryptionKey(key);
        }
        //console.log(KRYPTOS.ivPDK);
        //console.log(KRYPTOS.wrappedPrivateEncryptKey);
        //console.log(key);
        return KRYPTOS.cryptoSubtle.unwrapKey("jwk", KRYPTOS.wrappedPrivateEncryptKey, key, {name: "AES-CBC", iv: KRYPTOS.ivPDK}, {name: "RSA-OAEP", hash: {name: "SHA-256"}}, KRYPTOS.NONEXTRACTABLE, ["decrypt"]);
    },
    
    msrUnwrapPrivateDecryptionKey: function(key) {
        var op = KRYPTOS.cryptoSubtle.decrypt({name: "AES-CBC", iv: KRYPTOS.ivPDK}, key, KRYPTOS.wrappedPrivateEncryptKey);       
        return KRYPTOS.msrPromise(op)
                .then(function(result) {
                    return KRYPTOS.msrImportPrivateDecryptionKey(KRYPTOS.utils.toSupportedArray(KRYPTOS.utils.ab2str(result)));
                });
        
//        return KRYPTOS.cryptoSubtle.decrypt({name: "AES-CBC", iv: KRYPTOS.ivPDK}, key, KRYPTOS.wrappedPrivateEncryptKey);
        //return KRYPTOS.cryptoSubtle.unwrapKey("jwk", KRYPTOS.wrappedPrivateSignKey, key, {name: "AES-CBC", iv: KRYPTOS.ivPSK}, {name: "RSASSA-PKCS1-v1_5", hash: {name: "SHA-256"}}, KRYPTOS.NONEXTRACTABLE, ["sign"]);
    },
    
    savePrivateDecryptionKey: function(wrappedPrivateDecryptKey) {
        
        KRYPTOS.Keys.myPrivateKey = wrappedPrivateDecryptKey;
        
    },
    
    unwrapPrivateSignKey: function(key) {
        if (KRYPTOS.MSR) {
            return KRYPTOS.msrUnwrapPrivateSignKey(key);
        }
        return KRYPTOS.cryptoSubtle.unwrapKey("jwk", KRYPTOS.wrappedPrivateSignKey, key, {name: "AES-CBC", iv: KRYPTOS.ivPSK}, {name: "RSASSA-PKCS1-v1_5", hash: {name: "SHA-256"}}, KRYPTOS.NONEXTRACTABLE, ["sign"]);
    },
    
    msrUnwrapPrivateSignKey: function(key) {
        var op = KRYPTOS.cryptoSubtle.decrypt({name: "AES-CBC", iv: KRYPTOS.ivPSK}, key, KRYPTOS.wrappedPrivateSignKey);
        return KRYPTOS.msrPromise(op)
                .then(function(result) {
                    return KRYPTOS.msrImportPrivateSignKey(KRYPTOS.utils.toSupportedArray(KRYPTOS.utils.ab2str(result)));
                });
        //return KRYPTOS.cryptoSubtle.unwrapKey("jwk", KRYPTOS.wrappedPrivateSignKey, key, {name: "AES-CBC", iv: KRYPTOS.ivPSK}, {name: "RSASSA-PKCS1-v1_5", hash: {name: "SHA-256"}}, KRYPTOS.NONEXTRACTABLE, ["sign"]);
    },
    
    savePrivateSignKey: function(wrappedPrivateSignKey) {
        
        KRYPTOS.Keys.myPrivateCert = wrappedPrivateSignKey;
        
    },
    
    completePrivateKeysRetrieval: function() {
        KRYPTOS.session.removeItem('h');
        if (KRYPTOS.privateKeysCallback !== null) {
            KRYPTOS.privateKeysCallback(true);
        }
    },
    
    /**
     * WEB CRYPTO & MSR CRYPTO POINT.
     * 
     * 
     * @param {type} callback
     * @returns {unresolved}
     */
    getPrivateDecryptionKey: function(callback) {
        return KRYPTOS.importIntermediateKeyUnwrapKey()
                .then(KRYPTOS.unwrapPrivateDecryptionKey)
                .then(function(pdk) {
                    callback(true, pdk);
                }).catch(function(error) {
                    KRYPTOS.utils.log(error);
                    callback(false, error.message ? error.message : error);
                });
    },
    
    /**
     * WEB CRYPTO & MSR CRYPTO POINT.
     * 
     * 
     * @param {type} callback
     * @returns {unresolved}
     */
    getPrivateSignKey: function(callback) {
        return KRYPTOS.importIntermediateKeyUnwrapKey()
                .then(KRYPTOS.unwrapPrivateDecryptionKey)
                .then(function(pdk) {
                    callback(true, pdk);
                }).catch(function(error) {
                    KRYPTOS.utils.log(error);
                    callback(false, error.message ? error.message : error);
                });
    },
    
    publicKeysCallback: null,
    
    retrievePublicKeys: function(pek, pvk, callback) {
        KRYPTOS.publicKeysCallback = callback;
        if (KRYPTOS.MSR) {
            KRYPTOS.exportedPublicEncryptKey = KRYPTOS.utils.toSupportedArray(JSON.stringify(pek));
            KRYPTOS.exportedPublicSignKey = KRYPTOS.utils.toSupportedArray(JSON.stringify(pvk));
            
            var importPublicEncryptKeyOp = this.importPublicEncryptKey();
            importPublicEncryptKeyOp.oncomplete = function(importPublicEncryptKeyOpResult) {
                
                
                
                KRYPTOS.saveImportedPublicEncryptKey(importPublicEncryptKeyOpResult.target.result);
                
                var importPublicVerifyKeyOp = KRYPTOS.importPublicVerifyKey();
                importPublicVerifyKeyOp.oncomplete = function(importPublicVerifyKeyOpResult) {
                    
                    
                    
                    KRYPTOS.saveImportedPublicVerifyKey(importPublicVerifyKeyOpResult.target.result);
                    
                    KRYPTOS.completePublicKeyImport();

                };
                importPublicVerifyKeyOp.onerror = function(error) {
                    
                    
                };
                
            };
            importPublicEncryptKeyOp.onerror = function(error) {
                
                
            };
        }
        else {
            KRYPTOS.exportedPublicEncryptKey = pek;
            KRYPTOS.exportedPublicSignKey = pvk;
            return this.importPublicEncryptKey()
                .then(this.saveImportedPublicEncryptKey)
                .then(this.importPublicVerifyKey)
                .then(this.saveImportedPublicVerifyKey)
                .then(this.completePublicKeyImport)
                .catch(function(error) {
                    KRYPTOS.utils.log(error);
                });
            }
    },
    
    importPublicEncryptKey: function(publicKey) {
        if (!publicKey) {
            publicKey = KRYPTOS.exportedPublicEncryptKey;
        }
        if (KRYPTOS.MSR) {
            return KRYPTOS.msrImportPublicEncryptKey(publicKey);
        }
        return KRYPTOS.cryptoSubtle.importKey("jwk", publicKey, {name: "RSA-OAEP", hash: {name: "SHA-256"}}, false, ["encrypt"]);
    },
    
    msrImportPublicEncryptKey: function(publicKey) {
        var op = KRYPTOS.cryptoSubtle.importKey("jwk", KRYPTOS.utils.toSupportedArray(JSON.stringify(publicKey)), {name: "RSA-OAEP", hash: {name: "SHA-256"}}, false, ["encrypt"]);
        return KRYPTOS.msrPromise(op);
        //return KRYPTOS.utils.toSupportedArray(JSON.stringify(publicKey));
//        return new KRYPTOS.Promise(function (resolve, reject) {
//            resolve(KRYPTOS.utils.toSupportedArray(JSON.stringify(publicKey)));
//        });
//        var op = KRYPTOS.cryptoSubtle.importKey("jwk", KRYPTOS.utils.toSupportedArray(KRYPTOS.utils.ab2str(publicKey)), {name: "RSA-OAEP", hash: {name: "SHA-256"}}, false, ["encrypt"]);
//        return KRYPTOS.msrPromise(op);
    },
    
    saveImportedPublicEncryptKey: function(key) {
        KRYPTOS.Keys.myPublicKey = key;
    },
    
    importPublicVerifyKey: function() {
        
        
        return KRYPTOS.cryptoSubtle.importKey("jwk", KRYPTOS.exportedPublicSignKey, {name: "RSASSA-PKCS1-v1_5", hash: {name: "SHA-256"}}, false, ["verify"]);
    },
    
    saveImportedPublicVerifyKey: function(key) {
        
        
        KRYPTOS.Keys.myPublicCert = key;
    },
    
    completePublicKeyImport: function() {
        KRYPTOS.publicKeysCallback(KRYPTOS.Keys.myPublicKey, KRYPTOS.Keys.myPublicCert);
        //document.dispatchEvent(new Event('publickeysreceived'));
    },
    
    /**
     * CHANGE PASSWORD
     */
    wrappedKeysCallback: null,
    appendData: null,
    
    /**
     * Re-encrypts the intermediate key when a user changes password.
     * 
     * @param {String} username
     * @param {String} oldPassword
     * @param {String} newPassword
     * @param {String} domain
     * @param {function} callback
     * @returns {void}
     */
    changePassword: function(username, oldPassword, newPassword, domain, callback) {
        KRYPTOS.setupCallback = callback;
        KRYPTOS.init(username, oldPassword, domain, function(username, accountPassword1, mailPassword1) {
            
            var oldAccountPassword = accountPassword1;
            var oldMailPassword = mailPassword1;
            
            KRYPTOS.init(username, newPassword, domain, function(username, accountPassword2, mailPassword2) {
                
                var newAccountPassword = accountPassword2;
                var newMailPassword = mailPassword2;
                
                KRYPTOS.authenticate(username, oldAccountPassword, null, function(success, wrappedIntermediateKey) {
                    if (!success) {
                        return callback(false);
                    }
                    KRYPTOS.Keys.getIntermediateKey(wrappedIntermediateKey, oldMailPassword, oldAccountPassword, function(success, error) {
                        KRYPTOS.setupData = {
                            username: username,
                            current_password: oldAccountPassword,
                            new_password: newAccountPassword,
                            key: null
                        };
                        if (!success) {
                            return callback(false);
                        }
                        return this.importAesKey(newMailPassword)
                                .then(this.saveAesKey)
                                .then(this.importIntermediateKeyReWrap)
                                .then(this.saveIntermediateKey)
                                .then(this.wrapIntermediateKey)
                                .then(this.saveWrappedIntermediateKey)
                                .then(this.packageAndChangePassword)
                                .catch(function(error) {
                                    KRYPTOS.utils.log(error);
                                    return callback(false, error);
                                });
                    });
                });
                
            });
        });        
    },
    
    importIntermediateKeyReWrap: function() {
        if (KRYPTOS.MSR) {
            return KRYPTOS.msrImportIntermediateKey(KRYPTOS.iak());
        }
        return KRYPTOS.cryptoSubtle.importKey("jwk", KRYPTOS.iak(), KRYPTOS.AES_CBC, KRYPTOS.EXTRACTABLE, KRYPTOS.WRAP_USAGE.concat(KRYPTOS.ENCRYPT_USAGE));
    },
    
   /**
     * Package up the intermediate key and change password.
     * 
     * @returns {undefined}
     */
    packageAndChangePassword: function() {
        
        KRYPTOS.setupData.key = KRYPTOS.packageIntermediateKey();
        
        return KRYPTOS.utils.sendData(KRYPTOS.setupData, 'users', 'update', KRYPTOS.setupCallback);
    },    
    
    authenticate: function(username, accountPassword, otp, callback) {
        var fd = new FormData();
        fd.append('_token', getToken());
        fd.append('username', username);
        fd.append('password', accountPassword);
        if (otp) {
            fd.append('otp', otp);
        }

        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'sessions', true);
        xhr.responseType = 'json';
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.setRequestHeader('X-CSRF-Token', getToken());
        xhr.onload = function(e) {
            
            if (xhr.status === 200) {
                callback(true, xhr.response);                
            }
            else if (xhr.status === 403) {
                callback(false, 'Login to this account has been blocked temporarily, too many login attempts, please try again later.');
            }
            else {
                if (otp) {
                    callback(false, 'Incorrect verification code.');
                }
                else {
                    callback(false, 'Username and/or password incorrect.');
                }
                
            }
        };
        xhr.onerror = function(e) {
            callback(false);
        };
        xhr.send(fd);
    }
    
    
};

/**
 * The KRYPTOS Encrypter module.
 * 
 * @param {String} plainText
 * @param {CryptoKey} theirPublicKey
 * @param {function} callback
 * @returns {KRYPTOS.Encrypter} the public methods
 */





/**
 * The KRYPTOS Keys module.
 * 
 */
KRYPTOS.Keys = {
    
    prefix: "pub",
    
    myPublicKey: null,
    myPrivateKey: null,
    myPublicCert: null,
    myPrivateCert: null,
    
    publicKeys: null,
    publicCerts: null,

        
    /**
     * Retrieve the backed up keys.
     * 
     * @returns {void}
     */
    get: function() {
        this.getPrivateKeys();
    },
    
    getIntermediateKey: function(sessionInfo, mailPassword, accountPassword, callback) {
        var jsonObj = null;
        if (sessionInfo.iak) {
            jsonObj = sessionInfo;
        }
        else {
            jsonObj = JSON.parse(sessionInfo); // IE 11 and Safari 7 fix, doesn't come as parsed
        }
        var rawKey = KRYPTOS.utils.b642ab(jsonObj.iak);
        
//        var blob = new Blob([new Uint8Array(rawKey)], {type: "application/octet-stream"});
//        KRYPTOS.utils.readBlob(blob, function() {
            
//            var reader          = this;
            var data            = rawKey;
            var keyLength       = 48;
            var ivLength        = 16;
            var ivAik           = new Uint8Array(data, 0, ivLength);
            var iak             = new Uint8Array(data, ivLength, keyLength);
//            var extra           = new Uint8Array(data, ivLength + keyLength);
//            var sessionInfo = JSON.parse(KRYPTOS.utils.ab2str(extra));
            if (jsonObj) {
                for (var prop in jsonObj) {
                    if(jsonObj.hasOwnProperty(prop) && prop !== 'iak') {
                        KRYPTOS.session.setItem(prop, jsonObj[prop]);
                    }
                 }
                 //window.dispatchEvent(new Event('onresettoken'));
                 resetToken();
            }
                    
//            var intermediateKey  = new Uint8Array(data);
            
            
            
//            
            KRYPTOS.retrieveIntermediateKey(iak, ivAik, mailPassword, accountPassword, callback);
//        });
    },
    
    setPublicKeys: function(user, publicKeys) {
        KRYPTOS.session.setItem(KRYPTOS.Keys.prefix + KRYPTOS.utils.e2u(user), publicKeys);
    },
    
    getPublicKey: function(user, type, callback) {
        var username = KRYPTOS.utils.e2u(user);
        var publicKeys = KRYPTOS.session.getItem(KRYPTOS.Keys.prefix + username);
        if (publicKeys) {
            var keys = JSON.parse(publicKeys);
            if (type === 'verify') {
                callback(keys.verify);
            }
            else {
                callback(keys.encrypt);
            }
        }
        else {
            var jqxhr = $.getJSON("/keys/public/" + username, function(data) {
                KRYPTOS.session.setItem(KRYPTOS.Keys.prefix + username, JSON.stringify(data));
                if (type === 'verify') {
                    callback(data.verify);
                }
                else {
                    callback(data.encrypt);
                }
                
            });
            jqxhr.fail(function() {
                callback(false, false);
            });
        }
    },

    /**
     * Retrieve the public keys.
     * 
     * @param {String} user
     * @param {function} callback
     * @returns {undefined}
     */
    getPublicKeys: function(user, callback) {
        var username = KRYPTOS.utils.e2u(user);
        var publicKeys = KRYPTOS.session.getItem(KRYPTOS.Keys.prefix + username);
        if (publicKeys) {
            
            var keys = JSON.parse(publicKeys);
            
            KRYPTOS.retrievePublicKeys(keys.encrypt, keys.verify, callback);
        }
        else {
            var jqxhr = $.getJSON("/keys/public/" + username, function(data) {
                
                KRYPTOS.session.setItem(KRYPTOS.Keys.prefix + username, JSON.stringify(data));
                KRYPTOS.retrievePublicKeys(data.encrypt, data.verify, callback);
            });
            jqxhr.fail(function() {
                callback(false, false);
            });
        }
    },
    
    /**
     * Retrieve the public keys.
     * 
     * @param {String} emails
     * @param {function} callback
     * @returns {undefined}
     */
    getRecipientsPublicKeys: function(emails, callback) {
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
            if (KRYPTOS.session.getItem(KRYPTOS.Keys.prefix + username) || username === '') continue; // Skip if we already got the public keys in sessionStorage
            usernames += username + ",";
        }
        if (usernames === '') {
            return callback(true, "Done!");
            //return;
        }
        
         
        var jqxhr = $.getJSON("/keys/public?usernames=" + usernames, function(data) {
            if (data) {
                for (var i = 0; i < data.length; i++) {
                    KRYPTOS.session.setItem(KRYPTOS.Keys.prefix + data[i].username, data[i].public_keys);
                }
            }
            callback(true, "");
        });
        jqxhr.fail(function(response) {            
            var $er = $.parseJSON(jqxhr.responseText);
            callback(false, $er.errors.username);
        });

    },
    
    /**
     * Retrieve the users contacts with their public keys.
     * 
     * @param {function} callback
     * @returns {void}
     */
    getContactsPublicKeys: function(callback) {
        var jqxhr = $.getJSON("/contacts/keys", function(data) {
            if (data) {
                var contacts = [data.length];
                for (var i = 0; i < data.length; i++) {
                    contacts[i] = {username: data[i].username, email: data[i].username + "@ghostmail.com"};
                    KRYPTOS.session.setItem(KRYPTOS.Keys.prefix + data[i].username, data[i].public_keys);
                }
                KRYPTOS.session.setItem('contacts', JSON.stringify(contacts));
            }
            if (callback) {
                callback();
            }
        });
        jqxhr.fail(function() {
            if (callback) {
                callback();
            }
        });
    },

    /**
     * Retrieve the private keys.
     * 
     * @param {function} callback
     * @returns {void}
     */
    getPrivateKeys: function(callback) {    
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/keys/private', true);
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
                    
                    KRYPTOS.wrappedPrivateEncryptKey = pdk;
                    KRYPTOS.wrappedPrivateSignKey = psk;
                    KRYPTOS.ivPDK = ivPdk;
                    KRYPTOS.ivPSK = ivPsk;
//                    KRYPTOS.importIntermediateKeyUnwrapKey().then(function(result) {
//                        
//                        
//                    }).catch(function(e) {
//                        
//                        
//                    });
                    if (callback) {
                        callback();
                    }
                    
//                    KRYPTOS.retrievePrivateKeys(pdk, psk, ivPdk, ivPsk, extractable, callback);
                });
        };
        xhr.onerror = function(e) {
            
            
        };
        xhr.send();
   }
};

/**
 * The KRYPTOS contacts module.
 * 
 */
KRYPTOS.Contacts = {

    
    getAll: function() {
        return JSON.parse(KRYPTOS.session.getItem('contacts'));
    },
    
    getAllEmails: function() {
        var contacts = [];
        var temp = this.getAll();
        if (temp) {      
            for (var i = 0; i < temp.length; i++) {
                if (contacts.indexOf(temp[i].email) === -1) {
                    contacts.push(temp[i].email);
                }
            }
        } 
        return contacts;
    },
    
    getAllUsernames: function() {
        var usernames = [];
        var temp = this.getAll();
        for (var i = 0; i < temp.length; i++) {
            usernames[i] = temp[i].username;
        }
        return usernames;
    },
    
    add: function(username, callback) {
        KRYPTOS.utils.sendJson({contact_username: username}, 'contacts', 'add', callback);
    },
    
    accept: function(username, callback) {
        KRYPTOS.utils.sendJson({contact_username: username}, 'contacts', 'accept', callback);
    },
    
    remove: function(username, callback) {
        KRYPTOS.utils.sendJson({contact_username: username}, 'contacts', 'delete', callback);
    }

};

/**
 * The KRYPTOS Messages module.
 * 
 */
KRYPTOS.Messages = {
    mails: [],
    
    add: function(uuid, mail) {
        this.mails[uuid] = mail;
    },
    
    get: function(uuid) {
        if (!this.mails[uuid]) {
            return false;
        }
        return this.mails[uuid];
    },
    
    read: function(uuid, callback) {
        KRYPTOS.utils.sendJson({message_id: uuid}, 'messages', 'read', callback); //function(json, resource, type, callback)
    },
    
    unread: function(uuid, callback) {
        KRYPTOS.utils.sendJson({message_id: uuid}, 'messages', 'unread', callback); //function(json, resource, type, callback)
    },
    
    delete: function(uuid, callback) {
        this.remove(uuid);
        KRYPTOS.utils.sendJson({message_id: uuid}, 'messages', 'delete', callback); //function(json, resource, type, callback)
    },
    
    remove: function(uuid) {
        delete this.mails[uuid];
    },
    
    getMails: function() {
        
    },
    
    saveDraft: function(callback) {
        
    }
};


/**
 * The KRYPTOS RSA module for generating RSA key pairs when the Web Crypto API 
 * is not available.
 * 
 */
KRYPTOS.RSA = function() {
    
    var key = new RSAKey();
    
    var alg, d, dp, dq, e, ext, pub_key_op, pri_key_op, kty = "RSA", n, p, q, qi; 
    
    var generate = function(length, e) {
        key.generate(length, e);
    };
    
    var generateKey = function(algo, extractable, usages) {
        
        generate(algo.modulusLength, KRYPTOS.utils.ab2hex(algo.publicExponent));
        
        switch (algo.name) {
            case "RSASSA-PKCS1-v1_5":
                alg = "RS256";
                pub_key_op = ["verify"];
                pri_key_op = ["sign"];
                break;
            case "RSA-OAEP":
                alg = "RSA-OAEP-256";
                pub_key_op = ["encrypt"];
                pri_key_op = ["decrypt"];
                break;    
            default: throw new Error("Unknown key operation");
        }

        d = KRYPTOS.utils.bi2b64(key.d);
        dp = KRYPTOS.utils.bi2b64(key.dmp1);
        dq = KRYPTOS.utils.bi2b64(key.dmq1);
        e = KRYPTOS.utils.d2b64(algo.publicExponent, true);
        ext = extractable;        
        n = KRYPTOS.utils.bi2b64(key.n);
        p = KRYPTOS.utils.bi2b64(key.p);
        q = KRYPTOS.utils.bi2b64(key.q);
        qi = KRYPTOS.utils.bi2b64(key.coeff);

        return new CryptoKey(); 
    };
    
    var CryptoKey = function() {
        
        return {
            public: {
                alg: alg,
                e: e,
                ext: ext,
                extractable: ext,
                key_ops: pub_key_op,
                kty: kty,
                n: n
            },
            private: {
                alg: alg,
                d: d,
                dp: dp,
                dq: dq,
                e: e,
                ext: ext,
                extractable: ext,
                key_ops: pri_key_op,
                kty: kty,
                n: n,
                p: p,
                q: q,
                qi: qi
            }
        };
        
//        var getKey = function() {
//            this;
//        };
//        
//        var getPublic = function() {
//            return keyData.public;
//        };
//        
//        var getPrivate = function() {
//            return keyData.private;
//        };
//        
//        return {
//            public: getPublic,
//            private: getPrivate,
//        };
    };
    
    return {
        generateKey: generateKey
    };
    
};


/**
 * KRYPTOS utilities.
 * Contains varios utility and conversions functions.
 */
KRYPTOS.utils = {
    
    logContainer: '#logContainer',
    
    logType: 1,
    
    /**
     * This is the KRYPTOS logger.
     * Set logType = 1 to log to console.
     * Set logType = 2 to log to the a HTML container or define it above.
     * Set logType = 0 to disable logging completely.
     * 
     * @param {type} msg
     * @returns {undefined}
     */
    log: function(msg) {
        if (this.logType === 1) {
            console.log(msg);
        }
        else if (this.logType === 2) {
            $(logContainer).append('<p>' + msg + '</p>');
        }
        else if (this.logType === 3) {
            console.log('------- ERROR LOG START -------');
            if (msg.message) {
                console.log('error.message:');
                console.log(msg.message);
            }
            if (msg.stack) {
                console.log('error.stack:');
                console.log(msg.stack);
            }
            console.log('Full Error:');
            console.error(msg);
            console.log('------- ERROR LOG END ---------');
        }
    },
    
    error: function(handler, title, errorObj) {
        var message = "";
        var obj = errorObj.errors || errorObj;
        for (var prop in obj) {
            if(obj.hasOwnProperty(prop)) {
                message += obj[prop];
            }
        }
        if (message === "") {
            message = "An un-expected error happened";
        }
        handler(title, message);
    },
    
    rsa: function() {
        return new KRYPTOS.RSA();
    },
    
    formatSubject: function(subject) {
        var str = decodeURIComponent(subject);
        if (str.length > 50) {
            return str.substring(0, 50) + "...";
        }
        return str;
    },
    
    formatLine: function(line, length) {
        if (line.length > length) {
            return line.substring(0, length) + "...";
        }
        return line;
    },
    
    extractMessage: function(data, callback) {
        var keyLength       = new Uint16Array(data, 0, 2)[0];   // First 16 bit integer
        var signatureLength = new Uint16Array(data, 2, 2)[0];
        var encryptedKey    = new Uint8Array( data, 4, keyLength);
        var signature       = new Uint8Array( data, 4 + keyLength, signatureLength);
        var iv              = new Uint8Array( data, 4 + signatureLength + keyLength, 16);
        var cipherText      = new Uint8Array( data, 4 + signatureLength + keyLength + 16);
        callback(encryptedKey, iv, cipherText, signature);
    },
    
    extractInboundMessage: function(data, callback) {
        var obj = JSON.parse(KRYPTOS.utils.b642str(data));
        callback(KRYPTOS.utils.b642ab(obj.key), new Uint8Array(KRYPTOS.utils.str2ab(obj.iv)), new Uint8Array(KRYPTOS.utils.b642ab(obj.value)), KRYPTOS.utils.str2ab(obj.mac));
    },
    
    getInboundMessage: function(messageId, callback) {   //b642str    
        var data = KRYPTOS.session.getItem("m" + messageId); // check if message is cached in sessionStorage
        if (data) {
            var message = JSON.parse(data);
            KRYPTOS.utils.extractInboundMessage(message.mail, function(encryptedKey, iv, cipherText, signature) {
                KRYPTOS.getPrivateDecryptionKey(function(success, pdk) {
                    if (!success) {
                        callback(false, pdk);
                        return;
                    }
                    new KRYPTOS.Decrypter(encryptedKey, iv, cipherText, signature, null, pdk, callback).decrypt3();
                });

            });
        }
    },
    
    getMessage: function(messageId, user, callback) {
        //var pvk = KRYPTOS.Keys.getPublicKey(user, 'verify');
        var data = KRYPTOS.session.getItem("m" + messageId); // check if message is cached in sessionStorage
        KRYPTOS.Keys.getPublicKey(user, 'verify', function(pvk) {
            if (data) {
                var message = JSON.parse(data);
                KRYPTOS.utils.extractMessage(KRYPTOS.utils.b642ab(message.mail), function(encryptedKey, iv, cipherText, signature) {
                    KRYPTOS.getPrivateDecryptionKey(function(success, pdk) {
                        if (!success) {
                            callback(false, pdk);
                            return;
                        }
                        new KRYPTOS.Decrypter(encryptedKey, iv, cipherText, signature, pvk, pdk, callback).decrypt();
                    });

                });
            }
            else {
                var xhr = new XMLHttpRequest();
                xhr.open('GET', '/messages/mail?type=mail&message_id=' + messageId, true);
                xhr.responseType = 'blob';
                xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                xhr.setRequestHeader('X-CSRF-Token', getToken());
                xhr.onload = function(e) {
                    var blob = new Blob([xhr.response], {type: "application/octet-stream"});
                    KRYPTOS.utils.readBlob(blob, function() {
                        var reader          = this;
                        var data            = reader.result;
                        KRYPTOS.utils.extractMessage(data, function(encryptedKey, iv, cipherText, signature) {
                            KRYPTOS.getPrivateDecryptionKey(function(success, pdk) {
                                if (!success) {
                                    callback(false, pdk);
                                    return;
                                }
                                new KRYPTOS.Decrypter(encryptedKey, iv, cipherText, signature, pvk, pdk, callback).decrypt();
                            });
                        });
                    });
                };
                xhr.onerror = function(e) {

                };
                xhr.send();
            }
        });
    },
    
    getMessages: function(data, callback) {
        if (data.public_keys) {
            for (var i = 0; i < data.public_keys.length; i++) {
                KRYPTOS.Keys.setPublicKeys(data.public_keys[i].username, data.public_keys[i].public_keys);
            }
        }
        var usePDK = false;
        if (data.mails) {
            var promises = [];            
            for (var i = 0; i < data.mails.length; i++) {
                if (data.mails[i].type === 'mail') {
                    usePDK = true; 
                    break;
                }
            }
            if (usePDK) {
                KRYPTOS.getPrivateDecryptionKey(function(success, pdk) {
                    if (!success) {
                        callback(false, pdk);
                        return;
                    }
                    for (var i = 0; i < data.mails.length; i++) {
                        if (data.mails[i].type === 'mail') {
//                            if (KRYPTOS.Messages.get(data.mails[i].uuid) && data.mailbox !== 'drafts') {
//                                data.mails[i] = KRYPTOS.Messages.get(data.mails[i].uuid);
//                                continue;
//                            }
                            var message = KRYPTOS.utils.b642ab(data.mails[i].mail);
                            //var pvk = KRYPTOS.Keys.getPublicKey(data.mails[i].username, 'verify');
                            KRYPTOS.Keys.getPublicKey(data.mails[i].username, 'verify', function(pvk) {
                                KRYPTOS.utils.extractMessage(message, function(encryptedKey, iv, cipherText, signature) {
                                    promises.push(new KRYPTOS.Decrypter(encryptedKey, iv, cipherText, signature, pvk, pdk, callback).decrypt2(data.mails[i].uuid));
                                });
                            });
                        }
                        else {
                            data.mails[i].body = data.mails[i].mail;
                            KRYPTOS.Messages.add(data.mails[i].uuid, data.mails[i]);
                        }
                        //KRYPTOS.session.setItem("m" + data.mails[i].uuid, JSON.stringify(data.mails[i]));
                    }
                    KRYPTOS.Promise.all(promises)
                        .then(function(result) {
                            for (var i = 0; i < data.mails.length; i++) {
                                for (var j = 0; j < result.length; j++) {
                                    if (result[j].uuid === data.mails[i].uuid) {
                                        data.mails[i].body = result[j].plain.body;
                                        data.mails[i].attachments_meta = result[j].plain.attachments;
                                        if (result[j].plain.subject === '') {
                                            data.mails[i].subject = '(no subject)';
                                        }
                                        else {
                                            data.mails[i].subject = KRYPTOS.utils.formatSubject(result[j].plain.subject);
                                        }
                                        data.mails[i].failed = result[j].failed;
                                        KRYPTOS.Messages.add(data.mails[i].uuid, data.mails[i]);
                                        break;
                                    }
                                }
                            }
                            callback(true, data);
                        }).catch(function(error) {
                            KRYPTOS.utils.log(error);
                            callback(false, error);
                        });
                });
            }
            else {
                for (var i = 0; i < data.mails.length; i++) {
                    data.mails[i].body = data.mails[i].mail;
                    KRYPTOS.Messages.add(data.mails[i].uuid, data.mails[i]);
                    //KRYPTOS.session.setItem("m" + data.mails[i].uuid, JSON.stringify(data.mails[i]));
                }
                callback(true, data);
            }
        }
        else {
            callback(true, false);
        }
    },
    
    getAttachment: function(messageId, attachmentId, hexKey, hexSignature, callback, downloadCallback) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/messages/attachment?message_id=' + messageId + '&attachment_id='+attachmentId, true); //1421776555890 - 1421776532206
        xhr.responseType = 'blob';
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.setRequestHeader('X-CSRF-Token', getToken());
        xhr.onload = function(e) {
            if (xhr.status === 200) {
                var blob = new Blob([xhr.response], {type: "application/octet-stream"});
                KRYPTOS.utils.readBlob(blob, function() {
                    var reader          = this;
                    var data            = reader.result;            
                    var ivLength        = 16;
                    var iv              = new Uint8Array(data, 0, ivLength);
                    var attachment      = new Uint8Array(data, ivLength);
                    var key             = KRYPTOS.utils.hex2ab(hexKey);                    
                    var signature       = KRYPTOS.utils.hex2ab(hexSignature);
                    new KRYPTOS.Decrypter(key, iv, attachment, signature, null, null, callback).decryptFile();
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
    },
    
    /**
     * Read a Blob and handle a handler to handle it :)
     * 
     * @param {Blob} blob
     * @param {function} handler
     * @returns {undefined}
     */
    readBlob: function(blob, handler) {
        var reader = new FileReader();
        reader.onload = handler;
        reader.onerror = function(event) {
            handler(event);
        };
        reader.readAsArrayBuffer(blob);
    },
    
    /**
     * Read a File and handle a handler to handle it :)
     * 
     * @param {File} file
     * @param {function} handler
     * @returns {undefined}
     */
    readFile: function(file, handler) {
        var meta = {
            id: null,
            uuid: null,
            name: KRYPTOS.utils.cleanString(file.name),
            bytes: file.size,
            size: file.size,
            type: KRYPTOS.utils.cleanString(file.type),
            hmac: null,
            key: null
        };
        
        KRYPTOS.utils.readBlob(file, function() {
            var reader = this;
            meta.id = KRYPTOS.uniqueFileId();
            handler(reader.result, meta);
        });
     
    },
    
    validName: function(name) {
        return name && name !== "" && KRYPTOS.utils.strpbrk(name, "\\/?%*:|\'\"<>&;") === false; // \, /, ?, %, *, :, |, ', &quot;, &lt;, &gt;, &amp; and ;
    },
    
    strpbrk: function(haystack, charList) {
        for (var i = 0; i < haystack.length; ++i) {
            if (charList.indexOf(haystack.charAt(i)) >= 0) {
                return haystack.slice(i);
            }
        }
        return false;
      },
    
    /**
     * I dont really like this function, but seems to be necessary for JavaScript
     * to handle JSON from a string correctly.
     * 
     * @param {type} json
     * @returns {Array|Object}
     */
    formatJson: function(json) {
        $('#textarea').html(json);
        var formattedJson = JSON.parse($('#textarea').html());
        return formattedJson;
    },
    
    escapeHTML: function(s) {
        return s.toString().replace(/</g, "&lt;").replace(/>/g, "&gt;");
    },
    
    dot2us: function(s) {
        return s.toString().replace(".", "_");
    },
    
    cleanString: function(s, strict) {
        var regex = null;
        if (strict) {
            regex = /\<|\>|\"|\'|\%|\;|\(|\)|\&|\+|\-/g;
        }
        else {
            regex = /\<|\>|\"|\'|\%|\;|\&/g;
        }
        return (s + "").replace(regex, "");
    },

    ba2dataUrl: function(byteArray) {
        var binaryString = '';
        for (var i=0; i<byteArray.byteLength; i++) {
            binaryString += String.fromCharCode(byteArray[i]);
        }
        return "data:application/octet-stream;base64," + btoa(binaryString);
    },
    
    escapeJson: function(s) {
        return s.replace(/\r?\n/g, "\\n").replace(/"/g, '\"').replace(/'/g, "\'").replace(/“/g, "\“").replace(/”/g, "\”").replace(/’/g, "\’");
    },
    
    unescapeJson: function(s) {
        if (s) {
            return s.replace(/\\n/g, "<br />").replace(/\"/g, '"').replace(/\'/g, "'").replace(/\“/g, "“").replace(/\”/g, "”").replace(/\’/g, "’");
        }
        return "";
    },
    
    /**
     * Converts BigInteger hex to base64 from ArrayBuffer
     * 
     * @param {type} bigInteger
     * @returns {String}
     */
    bi2b64: function(bigInteger) {
        return KRYPTOS.utils.d2b64(KRYPTOS.utils.hex2ab(bigInteger.toString(16)), true);
    },
    
    d2b64: function(data, base64Url) {
        var output = "";
        if (data.pop || data.subarray) {
            data = String.fromCharCode.apply(null, data);
        }
        output = btoa(data);
        if (base64Url) {
            return output.replace(/\+/g, "-").replace(/\//g, "_").replace(/\=/g, "");
        }
        return output;
    },
    
    /**
     * Converts an ArrayBuffer to a string of hexadecimal numbers.
     * 
     * @param {ArrayBuffer} arrayBuffer
     * @returns {String}
     */
    ab2hex: function(arrayBuffer) {
        var byteArray = new Uint8Array(arrayBuffer);
        var hexString = "";
        var nextHexByte;

        for (var i=0; i<byteArray.byteLength; i++) {
            nextHexByte = byteArray[i].toString(16);  // Integer to base 16
            if (nextHexByte.length < 2) {
                nextHexByte = "0" + nextHexByte;     // Otherwise 10 becomes just a instead of 0a
            }
            hexString += nextHexByte;
        }
        return hexString;
    },

    /**
     * Converts a hexadecimal number string to an ArrayBuffer.
     * 
     * @param {String} hexString
     * @returns {ArrayBuffer}
     */
    hex2ab: function(hexString) {
        if (hexString.length % 2 !== 0) {
            //throw Error("Must have an even number of hex digits to convert to bytes");
            hexString = "0" + hexString;
        }
        var numBytes = hexString.length / 2;
        var byteArray = new Uint8Array(numBytes);
        for (var i=0; i<numBytes; i++) {
            byteArray[i] = parseInt(hexString.substr(i*2, 2), 16);
        }
        return byteArray;
    },
    
    /**
     * Converts an ArrayBuffer to a String.
     * 
     * @param {ArrayBuffer} buf
     * @returns {String}
     */
    ab2str: function(buf) {
        var str = "";
        var byteArray = new Uint8Array(buf);
        for(var i = 0; i < byteArray.length; i++) {
            str += String.fromCharCode(byteArray[i]);
        }
        return str;
    },
    
    /**
     * Converts a String to an ArrayBuffer.
     * 
     * @param {type} str
     * @returns {ArrayBuffer}
     */
    str2ab: function(str) {
        var buf = new ArrayBuffer(str.length);
        var bufView = new Uint8Array(buf);
        for (var i = 0, strLen = str.length; i < strLen; i++) {
          bufView[i] = str.charCodeAt(i);
        }
        return buf;
    },
    
    /**
     * Converts an ArrayBuffer to a String.
     * 
     * @param {ArrayBuffer} buf
     * @param {boolean} base64Url
     * @returns {String}
     */
    ab2b64: function(buf, base64Url) {
        var data = "";
        var byteArray = new Uint8Array(buf);
        for(var i = 0; i < byteArray.length; i++) {
            data += String.fromCharCode(byteArray[i]);
        }
        var output = btoa(data);
        if (base64Url) {
            return output.replace(/\+/g, "-").replace(/\//g, "_").replace(/\=/g, "");
        }
        return output;
    },
    
    b642ab: function (base64) {
        var binaryString =  window.atob(base64);
        var len = binaryString.length;
        var bytes = new Uint8Array(len);
        for (var i = 0; i < len; i++)        {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    },
    
    b642str: function(base64) {
        return KRYPTOS.utils.ab2str(KRYPTOS.utils.b642ab(base64));
    },
    
    /**
     * Convert a JWK to an ArrayBuffer.
     * 
     * @param {JWK} jwk
     * @returns {ArrayBuffer}
     */
    jwk2ab: function(jwk) {
        return KRYPTOS.utils.str2ab(JSON.stringify(jwk));
    },
    
    /**
     * Convert ArrayBuffer to JWK.
     * 
     * @param {ArrayBuffer} ab
     * @returns {JWK}
     */
    ab2jwk: function(ab) {
        var str = KRYPTOS.utils.ab2str(ab);
        return JSON.parse(str);
    },
    
    /**
     * Convert ArrayBuffer to JSON.
     * 
     * @param {ArrayBuffer} ab
     * @returns {JSON}
     */
    ab2json: function(ab) {
        return KRYPTOS.utils.formatJson((KRYPTOS.utils.ab2str(ab)));
    },
    
    /**
     * Converts a base64 encoded JSON object to a Javascript object
     * @param {atring} base64
     * @returns {Object}
     */
    b642obj: function(base64) {
        var str = window.atob(base64);
        return JSON.parse(str);
    },
    
    obj2b64: function(obj) {
        var str = JSON.stringify(obj);
        return window.btoa(str);
    },
    
    aesKey2Jwk: function(key, extractable) {
        
        var dataType = Object.prototype.toString.call(key);
        dataType = dataType.substring(8, dataType.length - 1);
        var k = null;
        if (dataType === "String") {
            k = KRYPTOS.utils.hex2ab(key);
            
        }
        else {
            k = key;
        }
        var jwk = {
            alg: "A256CBC",
            extractable: extractable,  //MS
            ext: extractable,          // Web Crypto API
            k: KRYPTOS.utils.d2b64(k, true),
            kty: "oct"
        };
        return JSON.stringify(jwk);
    },
    
    intermediateAesKey2Jwk: function(key, extractable) {
        var dataType = Object.prototype.toString.call(key);
        dataType = dataType.substring(8, dataType.length - 1);
        var k = null;
        if (dataType === "String") {
            k = KRYPTOS.utils.hex2ab(key);
        }
        else {
            k = key;
        }
        var jwk = {
            alg: "A256CBC",
            extractable: extractable,  //MS
            ext: extractable,          // Web Crypto API
            k: KRYPTOS.utils.d2b64(k, true),
            key_ops: ["encrypt", "decrypt", "wrapKey", "unwrapKey"],
            kty: "oct"
        };
        return JSON.stringify(jwk);
    },
    
    hmacKey2Jwk: function(key, extractable) {
        
        var dataType = Object.prototype.toString.call(key);
        dataType = dataType.substring(8, dataType.length - 1);
        var k = null;
        if (dataType === "String") {
            k = KRYPTOS.utils.hex2ab(key);
            
        }
        else {
            k = key;
        }
        var jwk = {
            alg: "HS256",
            extractable: extractable,  //MS
            ext: extractable,          // Web Crypto API
            k: KRYPTOS.utils.d2b64(k, true),
            kty: "oct"
        };
        return JSON.stringify(jwk);
    },
    
    /**
     * Converts Arrays, ArrayBuffers, TypedArrays, and Strings to to either a 
     * Uint8Array or a regular Array depending on browser support.
     * You should use this when passing byte data in or out of crypto functions.
     * 
     * @param {mixed} data
     * @returns {Uint8Array|Array}
     */
    toSupportedArray: function(data) {

        // does this browser support Typed Arrays?
        var typedArraySupport = (typeof Uint8Array !== "undefined");

        // get the data type of the parameter
        var dataType = Object.prototype.toString.call(data);
        dataType = dataType.substring(8, dataType.length - 1);

        // determine the type
        switch (dataType) {

            // Regular JavaScript Array. Convert to Uint8Array if supported
            // else do nothing and return the array
            case "Array":
                return typedArraySupport ? new Uint8Array(data) : data;

                // ArrayBuffer. IE11 Web Crypto API returns ArrayBuffers that you have to convert
                // to Typed Arrays. Convert to a Uint8Arrays and return;
            case "ArrayBuffer":
                return new Uint8Array(data);

                // Already Uint8Array. Obviously there is support.
            case "Uint8Array":
                return data;

            case "Uint16Array":
            case "Uint32Array":
                return new Uint8Array(data);

                // String. Convert the string to a byte array using Typed Arrays if
                // supported.
            case "String":
                var newArray = typedArraySupport ? new Uint8Array(data.length) : new Array(data.length);
                for (var i = 0; i < data.length; i += 1) {
                    newArray[i] = data.charCodeAt(i);
                }
                return newArray;

                // Some other type. Just return the data unchanged.
            default:
                throw new Error("toSupportedArray : unsupported data type " + dataType);
        }

    },
    
    bytesToSize: function(bytes) {
        if (bytes === 0) return '0 Bytes';
        var k = 1000;
        var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        var i = Math.floor(Math.log(bytes) / Math.log(k));
        return (bytes / Math.pow(k, i)).toPrecision(3) + ' ' + sizes[i];
    },
    
    /**
     * Send JSON data.
     * 
     * @param {type} json
     * @param {type} resource
     * @param {type} type
     * @param {type} callback
     * @returns {void}
     */
    sendJson: function(json, resource, type, callback) {
        json._token = getToken();
        return $.ajax({
           url: "/" + resource + "/" + type,
           type: "POST",
           data: JSON.stringify(json),
           dataType: 'json',
           contentType: 'application/json; charset=UTF-8',
           success: function(response) {
                if (response._token) {
                    $('meta[name=_token]').attr('content', response._token);
                    KRYPTOS.session.setItem('_token', response._token);
                    document.dispatchEvent(new Event('onresettoken'));
                }
                if (callback){
                    callback(true, response);
                }
           },
           error: function(jqXHR, textStatus, errorMessage) {
               if (callback){
                   callback(false, $.parseJSON(jqXHR.responseText));
               }
           }
        });
    },
    
    getJson: function(params, resource, type, callback) {
        var queryString = params ? "?" + $.param(params) : "";
        var jqxhr = $.getJSON("/" + resource + "/" + type + queryString, function(data) {
            callback(true, data);
        });
        jqxhr.fail(function(error) {
            callback(false, error);
        });
    },
    
    timestamp: function(unixTimestamp) {
        return new Date(unixTimestamp).toDateString() + ' ' + new Date(unixTimestamp).toLocaleTimeString();
    },
    
    localDateTime: function(timestamp) {
        return new Date(timestamp).toLocaleDateString() + ' ' + new Date(timestamp).toLocaleTimeString();
    },
    
    ua2ea: function(u) {
        var emails = [];
        for (var i = 0; i < u.length; i++) {
            emails[i] = this.u2e(u[i]);
        }
        return emails;
    },
    
    ea2ue: function(e) {
        var usernames = [];
        for (var i = 0; i < e.length; i++) {
            usernames[i] = this.e2u(e[i]);
        }
        return usernames;
    },
    
    u2e: function(u) {
        return KRYPTOS.utils.escapeHTML(u.replace(/@ghostmail.com/gi, '') + '@ghostmail.com');
    },
    
    e2u: function(e) {
        return KRYPTOS.utils.escapeHTML(e.replace(/@.*/gi, ''));
    },
    
    formatEmails: function(emails) {
        var formatted = "";
        if (emails) {
            for(var i = 0; i < emails.length; i++) {
                if (emails.length - 1 === i) {
                    formatted += "<" + emails[i] + ">";
                }
                else {
                    formatted += "<" + emails[i] + ">, ";
                }
            }
        }
        return formatted;
    },
    
    mixed2ab: function(data, callback) {
        var mixed = [];
        for (var prop in data) {
            mixed.push(prop);
            mixed.push(data[prop]);
        }
        var blob = new Blob(mixed, {type: "application/octet-stream"});
        KRYPTOS.utils.readBlob(blob, function() {
            var reader = this;
            callback(reader.result);
        });
    },
    
    signRequest: function(request, url, callback) {
        if (url === "/messages/message") {
            KRYPTOS.utils.mixed2ab(request, function(result) {
                    return KRYPTOS.importIntermediateKeyUnwrapKey()
                        .then(KRYPTOS.unwrapPrivateSignKey)
                        .then(function(psk) {
                            if (KRYPTOS.MSR) {
                                var op = KRYPTOS.cryptoSubtle.sign({name: "RSASSA-PKCS1-v1_5", hash: {name: "SHA-256"}}, psk, new Uint8Array(request));
                                return KRYPTOS.msrPromise(op);
                            }
                            return KRYPTOS.cryptoSubtle.sign(KRYPTOS.RSASSA_PKCS1_v1_5, psk, new Uint8Array(request));
                        })
                        .then(function(signature) {
                            callback(KRYPTOS.utils.ab2hex(signature));
                        })
                        .catch(function(error) {
                            KRYPTOS.utils.log(error);
                        });
            });
        }
        else {
            callback(false);
        }
    },
    
    /**
     * Send a Blob file to the server.
     * 
     * @param {Object} data
     * @param {String} resource
     * @param {String} type
     * @param {function} callback
     * @param {function} uploadCallback
     * @returns {void}
     */
    sendData: function(data, resource, type, callback, uploadCallback) {        
        var fd = new FormData();
        data._token = getToken();
//        fd.append('_token', getToken());
        if (data) {
            for (var prop in data) {
                if(data.hasOwnProperty(prop)) {
                    fd.append(prop, data[prop]);
                }
             }
        }
        var url =  "/" + resource + "/" + type;
//        KRYPTOS.utils.signRequest(data, url, function(signature) {
//            if (signature) {
//                fd.append('signature', signature);
//            }
            return $.ajax({
                url: url,
                type: "POST",
                data: fd,
                cache: false,
                processData: false,
                contentType: false,
                success: function(response) {
                    if (response._token) {
                        $('meta[name=_token]').attr('content', response._token);
                        KRYPTOS.session.setItem('_token', response._token);
                        resetToken(); 
                    }
                    if (callback) {
                        callback(true, response);
                    }
                },
                xhr: function() {  // Custom XMLHttpRequest
                    var myXhr = $.ajaxSettings.xhr();
                    if(myXhr.upload){ // Check if upload property exists
                        myXhr.upload.addEventListener('progress', uploadCallback, false); // For handling the progress of the upload
                    }
                    return myXhr;
                },
                error: function(jqXHR, textStatus, errorMessage) {
                    //console.log($.parseJSON(jqXHR.responseText));
                    //document.dispatchEvent(new Event('on' + resource + type + 'error'));
                    if (callback) {
    //                    console.log($.parseJSON(jqXHR.responseText));
                        callback(false, $.parseJSON(jqXHR.responseText));
                     }
                }
            });
//        });
    },
    
    isEmpty: function(obj) {
        return obj === null || obj === undefined || Object.keys(obj).length === 0;
    }
    
};


/**
 * KRYPTOS checks if the browser is supported based on the browser features.
 * The crypto support is defined here.
 * 
 * @type type
 */
KRYPTOS.check = {
    
    UA: null,
    
    parseUA: function() {
        var parser = new UAParser();
        this.UA = parser.getResult();
    },
    
    support: function() {        
        this.promiseSupport();
        
        if (!this.cryptoSupport()) {
            this.msrCryptoSupport();
        }
      
        return true;
    },
    
    indexedDBSupport: function() {
        return window.indexedDB;
    },
    
    userMediaSupport: function() {
        
        return !!(navigator.getUserMedia || navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia || navigator.msGetUserMedia);
    },
    
    /**
     * User native browser Promises if the browser supports it else use the 
     * Promise polyfill
     * 
     * @returns {void}
     */
    promiseSupport: function() {
        KRYPTOS.Promise = window.Promise || ES6Promise.Promise;
    },
    
    /**
     * Use Web Crypto API if the browser supports it.
     * 
     * @returns {Boolean}
     */
    cryptoSupport: function() {
        KRYPTOS.crypto =  window.crypto;
        if (!KRYPTOS.crypto) {
            return false;
        }
        if (window.crypto.webkitSubtle) {
            KRYPTOS.SF = true;
        }
        KRYPTOS.cryptoSubtle = KRYPTOS.crypto.subtle;
        if (!KRYPTOS.cryptoSubtle) {
            return false;
        }
        return true;
    },
    
    // Not used
    isNative: function() {
        if (window.msCrypto) {
            return true;
        }
        return false;
    },
    
    // not used
    forceNative: function() {
        return false;
        // Try and force IE 11 old Web Crypto API implementation
        if (window.msCrypto) {
//            console.log('forceNative msCrypto');
            KRYPTOS.crypto =  window.msCrypto;
            KRYPTOS.cryptoSubtle = KRYPTOS.crypto.subtle;
            return true;
        }
        // TODO: Try and force SF 7+ incompleted Web Crypto API implementation
    },
    
    resetMsrCryptoSupport: function() {
        KRYPTOS.crypto = window.msrCrypto;
        KRYPTOS.cryptoSubtle = KRYPTOS.crypto.subtle;
    },
    
    /**
     * Load in the MSR Crypto Library
     * 
     * @returns {void}
     */
    msrCryptoSupport: function() {
        KRYPTOS.crypto = window.msrCrypto;
        KRYPTOS.cryptoSubtle = KRYPTOS.crypto.subtle;
        KRYPTOS.MSR = true;
        // TODO: move to session storage.
        var E = KRYPTOS.session.getItem('_e'); // Get some external entropy
        if (E) {
            E = KRYPTOS.utils.toSupportedArray(E);
            var entropy = [];
            for (var i = 0; i < E.length; i += 1) {
                entropy.push(E[i]);
            }
            KRYPTOS.crypto.initPrng(entropy);
        }
        else {
            console.log('Missing entropy!!');
        }
    }
    
};

// Load KRYPTOS when script is loaded.
document.addEventListener("DOMContentLoaded", function() {
    "use strict";
    KRYPTOS.check.support();
});