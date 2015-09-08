/* global KRYPTOS */

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
 * 
 * @param {ByteArray} encryptedKey
 * @param {ByteArray} iv
 * @param {ByteArray} cipherText
 * @param {ByteArray} signature
 * @param {CryptoKey} theirPublicKey
 * @param {CryptoKey} privateKey
 * @param {type} callback
 * @returns {void}
 */
KRYPTOS.Decrypter = function(encryptedKey, iv, cipherText, signature, theirPublicKey, privateKey, callback) {
    var key = encryptedKey;
    var iv = iv;
    var cipherText = cipherText;
    var publicKey = theirPublicKey;
    var privateKey = privateKey;
    var signature = signature;
    var callback = callback;
    var exportedFileSessionKey = null;
    var sessionKey = null;
    var hmacKey = null;
    
    var verifyEncryptedMessage = function() {
        if (KRYPTOS.MSR) {
            return msrVerifyEncryptedMessage();
        }
        return KRYPTOS.cryptoSubtle.verify(KRYPTOS.RSASSA_PKCS1_v1_5, publicKey, signature, cipherText); //cipherText
    };
    
    var msrVerifyEncryptedMessage = function() {
        var op = KRYPTOS.cryptoSubtle.verify({name: "RSASSA-PKCS1-v1_5", hash: {name: "SHA-256"}}, publicKey, KRYPTOS.utils.toSupportedArray(signature), KRYPTOS.utils.toSupportedArray(cipherText));
        return KRYPTOS.msrPromise(op);
    };
    
    var verifyEncryptedFile = function(verifyKey) {
        hmacKey = verifyKey;
        if (KRYPTOS.MSR) {
            return msrVerifyEncryptedFile(verifyKey);
        }
        return KRYPTOS.cryptoSubtle.verify(KRYPTOS.HMAC, verifyKey, signature, cipherText); //cipherText
    };
    
    var msrVerifyEncryptedFile = function(verifyKey) {
        var op = KRYPTOS.cryptoSubtle.verify(KRYPTOS.HMAC_ALGO, verifyKey, KRYPTOS.utils.toSupportedArray(signature), KRYPTOS.utils.toSupportedArray(cipherText)); //cipherText
        return KRYPTOS.msrPromise(op);
    };
    
    var verifyEncryptedInbound = function(verifyKey) {
        hmacKey = verifyKey;
        return KRYPTOS.cryptoSubtle.verify(KRYPTOS.HMAC, verifyKey, signature, cipherText); //cipherText
    };
    
    var handleMessageVerification = function(successful) {
        if (successful !== true) {
            throw "Verification Error: The sender could not be verified. Decryption of this message has been cancelled.";
        }        
    };
    
    var handleInboundMessageVerification = function(successful) {
        if (successful !== true) {
            throw "Verification Error: The sender could not be verified. Decryption of this message has been cancelled.";
        }
    };
        
    var handleFileVerification = function(successful) {
        if (successful !== true) {
            throw "Verification Error: The file integrity could not be verified. File corrupted.";
        }
        else {
            
        }
    };
    
    var decryptKey = function() {
        if (KRYPTOS.MSR) {
            return msrDecryptKey();
        }
        return KRYPTOS.cryptoSubtle.decrypt({name: "RSA-OAEP"}, privateKey, key);
    };
    
    var msrDecryptKey = function() {
        var op = KRYPTOS.cryptoSubtle.decrypt({name: "RSA-OAEP", hash: {name: "SHA-256"}}, privateKey, KRYPTOS.utils.toSupportedArray(key));
        return KRYPTOS.msrPromise(op);
    };
    
    var importSessionKey = function(keyBytes) {
        if (!keyBytes) {
            keyBytes = key;
        }
        if (KRYPTOS.MSR) {
            return msrImportSessionKey(keyBytes);
        }
        return KRYPTOS.cryptoSubtle.importKey("raw", keyBytes, KRYPTOS.AES_CBC_ALGO, KRYPTOS.NONEXTRACTABLE, KRYPTOS.ENCRYPT_USAGE);
    };
    
    var saveSessionKey = function(key) {
        sessionKey = key;
        return sessionKey;
    };
    
    var msrImportSessionKey = function(key) {
        // If safari native force web crypto api
        if (KRYPTOS.SF) {
            return window.crypto.webkitSubtle.importKey("raw", key, KRYPTOS.AES_CBC_ALGO, KRYPTOS.NONEXTRACTABLE, KRYPTOS.ENCRYPT_USAGE);
        }
        var op = KRYPTOS.cryptoSubtle.importKey(KRYPTOS.format(), KRYPTOS.msrKey(KRYPTOS.utils.ab2hex(key)), KRYPTOS.AES_CBC, KRYPTOS.NONEXTRACTABLE, ["encrypt", "decrypt"]);
        return KRYPTOS.msrPromise(op);
    };
    
    var decryptCipherText = function(sessionKey) {
        if (KRYPTOS.MSR) {
            return msrDecryptCipherText(sessionKey);
        }
        return KRYPTOS.cryptoSubtle.decrypt({name: "AES-CBC", iv: iv}, sessionKey, cipherText);
    };
    
    var msrDecryptCipherText = function(sessionKey) {
        // If safari native force web crypto api
        if (KRYPTOS.SF) {
            return window.crypto.webkitSubtle.decrypt({name: "AES-CBC", iv: iv}, sessionKey, cipherText);
        }
        else {
            var op = KRYPTOS.cryptoSubtle.decrypt({name: "AES-CBC", iv: KRYPTOS.utils.toSupportedArray(iv)}, sessionKey, KRYPTOS.utils.toSupportedArray(cipherText));
            return KRYPTOS.msrPromise(op);
        }
    };
    
    var handlePlainText = function(plainText) {
        var json = KRYPTOS.utils.ab2json(plainText);
        callback(json);
    };
    
    var handlePlainFile = function(plainFile) {
        callback(true, plainFile);
    };
    
    var exportFileSessionKey = function() {
        
        return KRYPTOS.cryptoSubtle.exportKey('raw', key);
    };
    
    var saveExportedFileSessionKey = function(exportedKey) {
        
        exportedFileSessionKey = exportedKey;
        return exportedFileSessionKey;
    };
    
    var importVerifyKey = function() {
        if (KRYPTOS.MSR) {
            return msrImportVerifyKey();
        }
        return KRYPTOS.cryptoSubtle.importKey('raw', key, KRYPTOS.HMAC_ALGO, KRYPTOS.NONEXTRACTABLE, ["sign", "verify"]);
    };
    
    var msrImportVerifyKey = function() {
        //var op = KRYPTOS.cryptoSubtle.importKey('jwk', KRYPTOS.utils.toSupportedArray(KRYPTOS.utils.hmacKey2Jwk(key)), KRYPTOS.HMAC_ALGO, KRYPTOS.NONEXTRACTABLE, ["sign", "verify"]);
        var op = KRYPTOS.cryptoSubtle.importKey('jwk', KRYPTOS.utils.toSupportedArray(KRYPTOS.utils.hmacKey2Jwk(KRYPTOS.utils.toSupportedArray(key), false)), KRYPTOS.HMAC_ALGO, KRYPTOS.NONEXTRACTABLE, ['sign', 'verify']);
        
        return KRYPTOS.msrPromise(op);
    };
    
    var importPublicVerifyKey = function() {
        if (KRYPTOS.MSR) {
            return msrImportPublicVerifyKey();
        }
        return KRYPTOS.cryptoSubtle.importKey("jwk", publicKey, {name: "RSASSA-PKCS1-v1_5", hash: {name: "SHA-256"}}, false, ["verify"]);
    };
    
    var msrImportPublicVerifyKey = function() {
        var op = KRYPTOS.cryptoSubtle.importKey("jwk", KRYPTOS.utils.toSupportedArray(JSON.stringify(publicKey)), {name: "RSASSA-PKCS1-v1_5", hash: {name: "SHA-256"}}, false, ["verify"]);
        return KRYPTOS.msrPromise(op);
        //return KRYPTOS.cryptoSubtle.importKey("jwk", KRYPTOS.exportedPublicSignKey, {name: "RSASSA-PKCS1-v1_5", hash: {name: "SHA-256"}}, false, ["verify"]);
    };
    
    var saveImportedPublicVerifyKey = function(publicVerifyKey) {
        publicKey = publicVerifyKey;
    };
    
    return {
        decrypt: function() {
            return importPublicVerifyKey()
                    .then(saveImportedPublicVerifyKey)
                    .then(verifyEncryptedMessage)
                    .then(handleMessageVerification)
                    .then(decryptKey)
                    .then(importSessionKey)
                    .then(decryptCipherText)
                    .then(handlePlainText)
                    .catch(function(error) {
                        KRYPTOS.utils.log(error);
                        callback(false, error);
                    });
        },
        decrypt3: function() {
            return decryptKey()
                    .then(importSessionKey)
                    .then(decryptCipherText)
                    .then(handlePlainText)
                    .catch(function(error) {
                        KRYPTOS.utils.log(error);
                        callback(false, error);
                    });
        },
        decryptFile: function() {
            return importVerifyKey()
//                    .then(saveExportedFileSessionKey)
//                    .then(importVerifyKey)
                    .then(verifyEncryptedFile)
                    .then(handleFileVerification)
                    .then(importSessionKey)
                    .then(decryptCipherText)
                    .then(handlePlainFile)
                    .catch(function(error) {
                        KRYPTOS.utils.log(error);
                        callback(false, error.message ? error.message : error);
                    });   
        },
        decrypt2: function(uuid) {
            return new KRYPTOS.Promise(function (resolve, reject) {                
                return importPublicVerifyKey()
                    .then(saveImportedPublicVerifyKey)
                    .then(verifyEncryptedMessage)
                    .then(handleMessageVerification)
                    .then(decryptKey)
                    .catch(function(error) {
                        KRYPTOS.utils.log(error);
                        resolve({uuid: uuid, failed: true, plain: {subject: "Incorrect key!!"}});
                    })
                    .then(importSessionKey)
                    .then(decryptCipherText)
                    .catch(function(error) {
                        KRYPTOS.utils.log(error);
                        resolve({uuid: uuid, failed: true, plain: {subject: "Could not decrypt message!!"}});
                    })
                    .then(function(plainText) {
                        if (plainText) {
                            var plain = KRYPTOS.utils.ab2json(plainText);
                            resolve({uuid: uuid, failed: false, plain: plain});
                        }
                    })
                    .catch(function(error) {
                        KRYPTOS.utils.log(error);
                        resolve({uuid: uuid, failed: true, plain: {subject: "Something went wrong!!"}});
                        //reject("DECRYPT 2: Something went wrong decrypting message " + error.message + "\n" + error.stack);
                    });
            });
        },
        decryptItemAssignment: function() {
            return importPublicVerifyKey() //.catch(function (error) {console.log('a'); console.log(error); KRYPTOS.utils.log(error);})
                    .then(saveImportedPublicVerifyKey)
                    .then(verifyEncryptedMessage) //.catch(function (error) {console.log('b'); console.log(error); KRYPTOS.utils.log(error);})
                    .then(handleMessageVerification)
                    .then(decryptKey) //.catch(function (error) {console.log('c'); console.log(error); KRYPTOS.utils.log(error);})
                    .then(saveSessionKey)
                    .then(importSessionKey) //.catch(function (error) {console.log('d'); console.log(error); KRYPTOS.utils.log(error);})
                    .then(decryptCipherText) //.catch(function (error) {console.log('e'); console.log(error); KRYPTOS.utils.log(error);})
                    .then(function(plainText) {
                        callback({
                            json: KRYPTOS.utils.ab2json(plainText),
                            key: KRYPTOS.utils.ab2b64(sessionKey)
                        });
                    })
                    .catch(function(error) {
                        KRYPTOS.utils.log(error);
                        callback(false, error);
                    });
        },
        decryptItem: function(itemId, referenceId) {
            return importPublicVerifyKey()
                    .then(saveImportedPublicVerifyKey)
                    .then(verifyEncryptedMessage)
                    .then(handleMessageVerification)
//                    .then(decryptKey)
                    .then(function() {
                        return key;
                    })
                    .then(importSessionKey)
                    .catch(function(error) {
                        KRYPTOS.utils.log(error);
//                        resolve({uuid: uuid, failed: true, plain: {subject: "Incorrect key!!"}});
                    })
                    .then(decryptCipherText)
                    .catch(function(error) {
                        KRYPTOS.utils.log(error);
//                        resolve({uuid: uuid, failed: true, plain: {subject: "Incorrect key!!"}});
                    })
                    .then(function(plainText) {
                        callback({
                            plain: KRYPTOS.utils.ab2json(plainText),
                            id: itemId,
                            rid: referenceId
                        });
                    })
                    .catch(function(error) {
                        KRYPTOS.utils.log(error);
                        callback(false, error);
                    });
        },
        decryptFilePart: function(id, partNumber) {
            return importVerifyKey()
                    .then(verifyEncryptedFile)
                    .then(handleFileVerification)
                    .then(importSessionKey)
                    .then(decryptCipherText)
                    .then(function(plainFile) {
                        callback({
                            id: id,
                            part: partNumber,
                            file: plainFile
                        });
                    })
                    .catch(function(error) {
                        KRYPTOS.utils.log(error);
                        callback(false, error.message ? error.message : error);
                    }); 
        }
    };
            
};


