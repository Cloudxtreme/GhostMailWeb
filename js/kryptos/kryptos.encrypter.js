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
 * @version 3.1
 */

/**
 * The KRYPTOS Encrypter module.
 * 
 * @param {String} plainText
 * @param {array} recipients
 * @param {integer} plainMode
 * @param {function} callback
 * @returns {KRYPTOS.Encrypter} the public methods
 */
KRYPTOS.Encrypter = function (plainText, recipients, plainMode, callback) {
    var autodestruct = null;
    if (plainText !== null) {
        autodestruct = plainText['autodestruct'];
    }    
    var plain = plainText;
    var plainMode = plainMode;
    var sessionKey = null;
    var exportedSessionKey = null;
    var encryptedPlainText = null;
    var signature = null;
    var encrypterCallback = callback;
    var sendData = [];
    var keyStore = null;
    var method = 'message';

    var generateSessionKey = function (usage) {        
        if (!usage) {
            usage = KRYPTOS.ENCRYPT_USAGE;
        }
        if (KRYPTOS.MSR) {
            return msrGenerateSessionKey(usage);
        }        
        return KRYPTOS.cryptoSubtle.generateKey(KRYPTOS.AES_CBC_ALGO, KRYPTOS.EXTRACTABLE, usage);
    };

    var msrGenerateSessionKey = function (usage) {
        return new KRYPTOS.Promise(function (resolve, reject) {
            resolve(KRYPTOS.randomValue(32));
        });
    };

    var saveSessionKey = function (generatedSessionKey) {
        sessionKey = generatedSessionKey;
        if (KRYPTOS.MSR) {
            return msrImportSessionKey(generatedSessionKey);
        }
        return sessionKey;
    };
    
    var importSessionKey = function(keyBytes) {
        if (KRYPTOS.MSR) {
            return msrImportSessionKey(keyBytes);
        }
        return KRYPTOS.cryptoSubtle.importKey("raw", keyBytes, KRYPTOS.AES_CBC_ALGO, KRYPTOS.NONEXTRACTABLE, KRYPTOS.ENCRYPT_USAGE);
    };
    
    var msrImportSessionKey = function (key) {
        var op = KRYPTOS.cryptoSubtle.importKey(KRYPTOS.format(), KRYPTOS.msrKey(KRYPTOS.utils.toSupportedArray(key)), KRYPTOS.AES_CBC, KRYPTOS.NONEXTRACTABLE, ["encrypt", "decrypt"]);
        return KRYPTOS.msrPromise(op);
    };
    
    var importHmacKey = function(raw) {
        if (KRYPTOS.MSR) {
            return msrImportHmacKey(raw);
        }
        return KRYPTOS.cryptoSubtle.importKey('raw', raw, KRYPTOS.HMAC_ALGO, KRYPTOS.NONEXTRACTABLE, ['sign', 'verify']);
    };
    
    var msrImportHmacKey = function(raw) {
        var op = KRYPTOS.cryptoSubtle.importKey('jwk', KRYPTOS.utils.toSupportedArray(KRYPTOS.utils.hmacKey2Jwk(KRYPTOS.utils.toSupportedArray(raw), false)), KRYPTOS.HMAC_ALGO, KRYPTOS.NONEXTRACTABLE, ['sign', 'verify']);
        return KRYPTOS.msrPromise(op);
    };

    var msrEncryptPlainText = function (sessionKey, iv) {
        var op = KRYPTOS.cryptoSubtle.encrypt({name: "AES-CBC", iv: iv}, sessionKey, KRYPTOS.utils.toSupportedArray(JSON.stringify(plain)));
        return KRYPTOS.msrPromise(op)
            .then(function (cipherText) {
                    return [iv, new Uint8Array(cipherText)];
                });
    };

    var encryptPlainText = function (sessionKey) {
        var iv = KRYPTOS.nonce();
        if (KRYPTOS.MSR) {
            return msrEncryptPlainText(sessionKey, iv);
        }        
        return KRYPTOS.cryptoSubtle.encrypt({name: "AES-CBC", iv: iv}, sessionKey, KRYPTOS.utils.str2ab(JSON.stringify(plain)))
                .then(function (cipherText) {
                    return [iv, new Uint8Array(cipherText)];
                });
    };

    var saveEncryptedPlainText = function (ivAndCiphertext) {
        encryptedPlainText = ivAndCiphertext;
        return sessionKey;
    };

    var exportSessionKey = function (key) {
        if (!key) {
            key = sessionKey;
        }
        if (KRYPTOS.MSR) {
            return key;
        }        
        return KRYPTOS.cryptoSubtle.exportKey(KRYPTOS.format(), key);
    };

    var saveExportedSessionKey = function (exportedKey) {
        exportedSessionKey = exportedKey;
        //return exportedSessionKey;
    };

    var signEncryptedPlainText = function (psk) {
        if (KRYPTOS.MSR) {
            return msrSignEncryptedPlainText(psk);
        }
        return KRYPTOS.cryptoSubtle.sign(KRYPTOS.RSASSA_PKCS1_v1_5, psk, new Uint8Array(encryptedPlainText[1]));
    };

    var msrSignEncryptedPlainText = function (psk) {
        var op = KRYPTOS.cryptoSubtle.sign({name: "RSASSA-PKCS1-v1_5", hash: {name: "SHA-256"}}, psk, new Uint8Array(encryptedPlainText[1]));
        return KRYPTOS.msrPromise(op);
    };

    var saveSignature = function (fileSignature) {
        signature = fileSignature; 
    };

    var encryptSessionKey = function (publicEncryptKey) {
        if (KRYPTOS.MSR) {
            return msrEncryptSessionKey(publicEncryptKey);
        }
        return KRYPTOS.cryptoSubtle.encrypt(KRYPTOS.RSA_OAEP_ALGO, publicEncryptKey, exportedSessionKey);
    };
    
    var msrEncryptSessionKey = function (publicEncryptKey) {
        var op = KRYPTOS.cryptoSubtle.encrypt(KRYPTOS.RSA_OAEP_ALGO, publicEncryptKey, sessionKey);
        return KRYPTOS.msrPromise(op);
    };
    
    var encryptSessionKeys = function() {
        var promises = [];
        if (plainMode) {
            promises.push(encryptRecipientSessionKey(recipients['from'][0]));
        }
        else {
            for (var prop in recipients) {
                if(recipients.hasOwnProperty(prop)) {
                    for (var i = 0; i < recipients[prop].length; i++) {
                        promises.push(encryptRecipientSessionKey(recipients[prop][i]));                
                    }
                }            
            }
        }
        
        return KRYPTOS.Promise.all(promises);
    };

    var packageResults = function () {
        
        var signatureLength = new Uint16Array([signature.byteLength]);
        return new Blob(
                [
                    new Uint16Array([KRYPTOS.LENGTH_256]), //keyLength, // 2 bytes
                    signatureLength, //2 bytes
                    new ArrayBuffer(KRYPTOS.LENGTH_256),//encryptedKey, // 256 bytes
                    signature, // 256 bytes
                    encryptedPlainText[0],
                    encryptedPlainText[1]
                ],
                {type: "application/octet-stream"}
        );
    };

    var sendPackage = function (blob) {        
        sendData['recipients'] = JSON.stringify(recipients);
        sendData['auto_destruct_hrs'] = autodestruct;
        sendData['message'] = blob;
        KRYPTOS.utils.sendData(sendData, 'messages', method, encrypterCallback);           
    };

    var encryptMessage = function () {
        return generateSessionKey()
                .then(saveSessionKey)
                .then(encryptPlainText)
                .then(saveEncryptedPlainText)
                .then(exportSessionKey)
                .then(saveExportedSessionKey)
                .then(KRYPTOS.importIntermediateKeyUnwrapKey)
                .then(KRYPTOS.unwrapPrivateSignKey)
                .then(signEncryptedPlainText)
                .then(saveSignature)
                .then(encryptSessionKeys)
                .then(packageResults)
                .then(sendPackage)
                .catch(function (error) {
                    KRYPTOS.utils.log(error);
                    if (encrypterCallback) {
                        encrypterCallback(false, error.message ? error.message : error);
                    }
                });
        
    };

    /**
     * Encrypt Session Key Promise, encrypts the message session key with the 
     * recipients public encrypt key.
     * 
     * @param {String} recipient
     * @returns {Promise}
     */
    var encryptRecipientSessionKey = function(recipient) {
        var username = KRYPTOS.utils.e2u(recipient);
        var publicKeys = JSON.parse(KRYPTOS.session.getItem(KRYPTOS.Keys.prefix + username));
        var aesKey = null;
    
        return new KRYPTOS.Promise(function(resolve, reject) {
            
            return KRYPTOS.importPublicEncryptKey(publicKeys.encrypt)
                    .then(function(publicKey) {
                        return encryptSessionKey(publicKey);
                    })
                    .then(function(encryptedSessionKey) {
                        aesKey = encryptedSessionKey;
                        return new Blob(
                                [
                                    encryptedSessionKey
                                ],
                                {type: "application/octet-stream"}
                        );
                    })
                    .then(function(blob) {
                        sendData['key_' + KRYPTOS.utils.dot2us(username)] = blob;
                        resolve({u: username, k: KRYPTOS.utils.ab2b64(aesKey)});
                    })
                    .catch(function (error) {
                        KRYPTOS.utils.log(error);
                        reject("encrypt key error: Something went wrong encrypting key " + error.message + "\n" + error.stack);
                    });
            
        });
        
    };
    
    /**
     * Encrypt File Promise, encrypts an individual file/attachment 
     * belonging to a message.
     * 
     * @param {ArrayBuffer} file
     * @param {string} id
     * @param {function} uploadCallback
     * @returns {Promise}
     */
    var encryptFile = function (file, id, uploadCallback) {
        var fileSessionKey = null;
        var exportedFileSessionKey = null;
        var encryptedFile = null;
        var result = [];
        result['id'] = id;
        return new KRYPTOS.Promise(function (resolve, reject) {

            return generateSessionKey()
                    // Save raw file session and export it
                    .then(function (key) {
                        
                        fileSessionKey = key;
                        if (KRYPTOS.MSR) {
                            exportedFileSessionKey = key;
                            return msrImportSessionKey(key).then(function(importedKey) {
                                fileSessionKey = importedKey;
                                return exportedFileSessionKey;
                            });
                        }
                        return KRYPTOS.cryptoSubtle.exportKey('raw', key);
                    })
                    // Save File Session Key
                    .then(function (exportedSessionKey) {
                        
                        result['key'] = KRYPTOS.utils.ab2hex(exportedSessionKey);
                        exportedFileSessionKey = exportedSessionKey;
                    })
                    // Encrypt File
                    .then(function () {
                        
                        var iv = KRYPTOS.nonce();
                        if (KRYPTOS.MSR) {
//                            KRYPTOS.check.forceNative();
                            var op = KRYPTOS.cryptoSubtle.encrypt({name: "AES-CBC", iv: iv}, fileSessionKey, KRYPTOS.utils.toSupportedArray(file));
                            return KRYPTOS.msrPromise(op)
                                    .then(function (cipherText) {
//                                        KRYPTOS.check.forceMsr();
                                        encryptedFile = [iv, new Uint8Array(cipherText)];
                                    }).catch(function (error) {
                                        KRYPTOS.utils.log(error);
//                                        KRYPTOS.check.forceMsr();
                                        reject("encryptFile2: Something went wrong encrypting file " + error.message + "\n" + error.stack);
                                    });
                        }
                        return KRYPTOS.cryptoSubtle.encrypt({name: "AES-CBC", iv: iv}, fileSessionKey, file)
                                    .then(function (cipherText) {                                        
                                        encryptedFile = [iv, new Uint8Array(cipherText)];
                                    });
                    })
                    // Import sign key
                    .then(function () {
                        if (KRYPTOS.MSR) {
                            var op = KRYPTOS.cryptoSubtle.importKey('jwk', KRYPTOS.utils.toSupportedArray(KRYPTOS.utils.hmacKey2Jwk(KRYPTOS.utils.toSupportedArray(exportedFileSessionKey), false)), KRYPTOS.HMAC_ALGO, KRYPTOS.NONEXTRACTABLE, ['sign', 'verify']);
                            return KRYPTOS.msrPromise(op);
                        }
                        return KRYPTOS.cryptoSubtle.importKey('raw', exportedFileSessionKey, KRYPTOS.HMAC_ALGO, KRYPTOS.NONEXTRACTABLE, ['sign', 'verify']);
                    })
                    // Sign File
                    .then(function (signKey) {
                        if (KRYPTOS.MSR) {
                            var op = KRYPTOS.cryptoSubtle.sign(KRYPTOS.HMAC_ALGO, signKey, encryptedFile[1]);
                            return KRYPTOS.msrPromise(op);
                        }
                        return KRYPTOS.cryptoSubtle.sign(KRYPTOS.HMAC_ALGO, signKey, encryptedFile[1]);
                    })
                    // Save HMAC signaure
                    .then(function (signature) {
                        result['hmac'] = KRYPTOS.utils.ab2hex(signature);
                    })
                    // Blob it up
                    .then(function () {
                        
                        return new Blob(
                                encryptedFile,
                                {type: "application/octet-stream"}
                        );
                        
                    })
                    // Upload file and resolve Promise!
                    .then(function(blob) {
                        sendData['attachment'] = blob;
                        KRYPTOS.utils.sendData(sendData, 'messages', 'attachment', function(success, response) {
                            if (success) {
                                result['uuid'] = response.uuid;
                                result['status'] = success;
                                resolve([result]);
                            }
                            else {
                                result['status'] = success;
                                result['message'] = response;
                                uploadCallback = null;
                                resolve([result]);
                                //reject("Something went wrong uploading the encrypted file " + response.message + "\n" + response.stack);
                            }
                        }, uploadCallback);                                
                    })
                    .catch(function (error) {
                        KRYPTOS.utils.log(error);
                        reject("encryptFile: Something went wrong encrypting file " + error.message + "\n" + error.stack);
                    });
        });
    };
    
    var encryptFilePart = function(file, id, iv, partNumber) {
        var zeroKey = new Uint8Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);
        var rawAesKey = null;
        var encryptedFile = null;
        
        return new KRYPTOS.Promise(function (resolve, reject) {
            
            // Import zeroKey as HMAC key
            return importHmacKey(zeroKey)
            // Sign File HMAC (file digest)
            .then(function (signKey) {
                if (KRYPTOS.MSR) {
                    var op = KRYPTOS.cryptoSubtle.sign(KRYPTOS.HMAC_ALGO, signKey, KRYPTOS.utils.toSupportedArray(file));
                    return KRYPTOS.msrPromise(op);
                }
                return KRYPTOS.cryptoSubtle.sign(KRYPTOS.HMAC_ALGO, signKey, file);
            })
            // Save plain HMAC to AES key
            .then(function(plainHmac) {
                rawAesKey = plainHmac;
                return rawAesKey;
            })
            // Import as AES key
            .then(importSessionKey)
            // Encrypt file part
            .then(function(aesKey) {               
                if (KRYPTOS.MSR) {
                    var op = KRYPTOS.cryptoSubtle.encrypt({name: "AES-CBC", iv: iv}, aesKey, KRYPTOS.utils.toSupportedArray(file));
                    return KRYPTOS.msrPromise(op);
                }
                return KRYPTOS.cryptoSubtle.encrypt({name: "AES-CBC", iv: iv}, aesKey, file);
                
            })
            // Save encrypted file part
            .then(function(cipherText) {
                encryptedFile = new Uint8Array(cipherText);
                return rawAesKey;
            })
            // Import raw AES key as HMAC key
            .then(importHmacKey)
            // Sign encrypted file with HMAC key
            .then(function(hmacKey) {
                if (KRYPTOS.MSR) {
                    var op = KRYPTOS.cryptoSubtle.sign(KRYPTOS.HMAC_ALGO, hmacKey, encryptedFile);
                    return KRYPTOS.msrPromise(op);
                }
                return KRYPTOS.cryptoSubtle.sign(KRYPTOS.HMAC_ALGO, hmacKey, encryptedFile);
            })
            .then(function(signature) {
                resolve({
                    id: id,
                    part: partNumber,
                    encrypted: new Blob([encryptedFile], {type: "application/octet-stream"}),
                    hmac: KRYPTOS.utils.ab2b64(signature),
                    key: KRYPTOS.utils.ab2b64(rawAesKey)
                });
            })
            .catch(function (error) {
                KRYPTOS.utils.log(error);
                reject("encryptFilePart: Something went wrong encrypting file " + error.message + "\n" + error.stack);
            });

        });
    };
    
    var encryptAssignmentKey = function() {
        var promises = [];
        
        for (var i = 0; i < recipients.length; i++) {
            promises.push(encryptRecipientAssignmentKey(recipients[i]));                
        }
        
        return KRYPTOS.Promise.all(promises);
    };
    
    /**
     * Encrypt Session Key Promise, encrypts the message session key with the 
     * recipients public encrypt key.
     * 
     * @param {String} recipient
     * @returns {Promise}
     */
    var encryptRecipientAssignmentKey = function(recipient) {
        var username = KRYPTOS.utils.e2u(recipient);
        var publicKeys = keyStore.getRecipientPublicKeys(username);
        return new KRYPTOS.Promise(function(resolve, reject) {
            
            return KRYPTOS.importPublicEncryptKey(publicKeys.encrypt)
                    .then(function(publicKey) {
                        return encryptSessionKey(publicKey);
                    })
                    .then(function(encryptedSessionKey) {
                        
                        resolve({
                                username: username,
                                key: KRYPTOS.utils.ab2b64(encryptedSessionKey)
                        });
   
                    })
                    .catch(function (error) {
                        KRYPTOS.utils.log(error);
                        reject("encrypt key error: Something went wrong encrypting key " + error.message + "\n" + error.stack);
                    });
            
        });
        
    };

    return {
        encrypt: function (plainMessage, sendMethod, uuid) {
            if (!plain || !recipients) {
                throw "Missing arguments.";
            }
            if (sendMethod) {
                method = sendMethod;
            }
            if (plainMessage) {
                sendData['subject'] = plainMessage['subject'];
                sendData['body'] = plainMessage['body'];
                sendData['plainMessage'] = true;
            }
            if (uuid) {
                sendData['uuid'] = uuid;
            }
            if (!KRYPTOS.utils.isEmpty(plainText['attachments'])) {
                for (var i = 0; i < plainText['attachments'].length; i++) {
                    sendData['attachment_' + plainText['attachments'][i].uuid] = plainText['attachments'][i].uuid;
                }
            }
            
            return encryptMessage();
        },
        encryptFile: function (file, id, callback, uploadCallback) {
            return encryptFile(file, id, uploadCallback).then(function(result) {
                callback(result);
            });
        },
        encryptChatMessage: function() {
             return generateSessionKey()
                    .then(saveSessionKey)
                    .then(encryptPlainText)
                    .then(saveEncryptedPlainText)
                    .then(exportSessionKey)
                    .then(saveExportedSessionKey)
                    .then(KRYPTOS.importIntermediateKeyUnwrapKey)
                    .then(KRYPTOS.unwrapPrivateSignKey)
                    .then(signEncryptedPlainText)
                    .then(saveSignature)
                    .then(encryptSessionKeys)
                    .then(function(sessionKeys) {
                        encrypterCallback(true, {
                            m: KRYPTOS.utils.ab2b64(encryptedPlainText[1]),
                            iv: KRYPTOS.utils.ab2b64(encryptedPlainText[0]),
                            s: KRYPTOS.utils.ab2b64(signature),
                            keys: sessionKeys
                        });
                    })
                    .catch(function (error) {
                        KRYPTOS.utils.log(error);
                        if (encrypterCallback) {
                            encrypterCallback(false, error.message);
                        }
                    });
        },
        encryptSignatureMessage: function() {
            return generateSessionKey()
                .then(saveSessionKey)
                .then(encryptPlainText)
                .then(saveEncryptedPlainText)
                .then(exportSessionKey)
                .then(saveExportedSessionKey)
                .then(KRYPTOS.importIntermediateKeyUnwrapKey)
                .then(KRYPTOS.unwrapPrivateSignKey)
                .then(signEncryptedPlainText)
                .then(saveSignature)
                .then(encryptSessionKeys)
                .then(function(sessionKeys) {
                    encrypterCallback(true, {
                        m: KRYPTOS.utils.ab2b64(encryptedPlainText[1]),
                        iv: KRYPTOS.utils.ab2b64(encryptedPlainText[0]),
                        s: KRYPTOS.utils.ab2b64(signature),
                        k: sessionKeys[0].k
                    });
                })
                .catch(function (error) {
                    KRYPTOS.utils.log(error);
                    if (encrypterCallback) {
                        encrypterCallback(false, error.message);
                    }
                });
        },
        encryptNewItemAssignment: function(keyStore) {
            return generateSessionKey() //.catch(function (error) {console.log('e1'); console.log(error); KRYPTOS.utils.log(error);})
                    .then(saveSessionKey)
                    .then(encryptPlainText) //.catch(function (error) {console.log('e2'); console.log(error); KRYPTOS.utils.log(error);})
                    .then(saveEncryptedPlainText)
                    .then(exportSessionKey) //.catch(function (error) {console.log('e3'); console.log(error); KRYPTOS.utils.log(error);})
                    .then(saveExportedSessionKey)
                    .then(keyStore.getPsk) //.catch(function (error) {console.log('e4'); console.log(error); KRYPTOS.utils.log(error);})
                    .then(signEncryptedPlainText) //.catch(function (error) {console.log('e5'); console.log(error); KRYPTOS.utils.log(error);})
                    .then(saveSignature)
                    .then(keyStore.getPek) //.catch(function (error) {console.log('e6'); console.log(error); KRYPTOS.utils.log(error);})
                    .then(KRYPTOS.importPublicEncryptKey) //.catch(function (error) {console.log('e7'); console.log(error); KRYPTOS.utils.log(error);})
                    .then(encryptSessionKey) //.catch(function (error) {console.log('e8'); console.log(error); KRYPTOS.utils.log(error);})
                    .then(function(key) {
                        encrypterCallback(true, {
                            message: KRYPTOS.utils.ab2b64(encryptedPlainText[1]),
                            iv: KRYPTOS.utils.ab2b64(encryptedPlainText[0]),
                            signature: KRYPTOS.utils.ab2b64(signature),
                            key: KRYPTOS.utils.ab2b64(exportedSessionKey),
                            encrypted_key: new Blob(
                                [key],
                                {type: "application/octet-stream"}
                            )
                        });
                    })
                    .catch(function (error) {
                        KRYPTOS.utils.log(error);
                        if (encrypterCallback) {
                            encrypterCallback(false, error);
                        }
                    });
        },
        
        encryptItemAssignment: function(kStore, existingKey) {
            keyStore = kStore;
            saveExportedSessionKey(existingKey);
            return encryptAssignmentKey()
                    .then(function(result) {
                        encrypterCallback(true, result);
                    })
                    .catch(function (error) {
                        console.log(error);
                        KRYPTOS.utils.log(error);
                        if (encrypterCallback) {
                            encrypterCallback(false, error);
                        }
                    });
        },
        
        // PSK should be cached previously
        encryptNewItem: function(keyStore) {
            return generateSessionKey() //.catch(function (error) {console.log('a'); console.log(error); KRYPTOS.utils.log(error);})
                    .then(saveSessionKey)
                    .then(encryptPlainText) //.catch(function (error) {console.log('b'); console.log(error); KRYPTOS.utils.log(error);})
                    .then(saveEncryptedPlainText)
                    .then(exportSessionKey) //.catch(function (error) {console.log('c'); console.log(error); KRYPTOS.utils.log(error);})
                    .then(saveExportedSessionKey)
//                    .then(KRYPTOS.importIntermediateKeyUnwrapKey).catch(function (error) {console.log('d'); console.log(error); KRYPTOS.utils.log(error);})
                    .then(keyStore.getPsk) //.catch(function (error) {console.log('e'); console.log(error); KRYPTOS.utils.log(error);})
                    .then(signEncryptedPlainText) //.catch(function (error) {console.log('f'); console.log(error); KRYPTOS.utils.log(error);})
                    .then(saveSignature)                    
                    .then(function() {
                        encrypterCallback(true, {
                            message: KRYPTOS.utils.ab2b64(encryptedPlainText[1]),
                            iv: KRYPTOS.utils.ab2b64(encryptedPlainText[0]),
                            signature: KRYPTOS.utils.ab2b64(signature),
                            key: KRYPTOS.utils.ab2b64(exportedSessionKey)
                        });
                    })
                    .catch(function (error) {
                        KRYPTOS.utils.log(error);
                        if (encrypterCallback) {
                            encrypterCallback(false, error);
                        }
                    });
        },
        
        encryptExistingItem: function(keyStore, existingKey) {
            return importSessionKey(existingKey) //.catch(function (error) {console.log('a1'); console.log(error); KRYPTOS.utils.log(error);})
                    .then(encryptPlainText) //.catch(function (error) {console.log('b1'); console.log(error); KRYPTOS.utils.log(error);})
                    .then(saveEncryptedPlainText)
                    .then(keyStore.getPsk) //.catch(function (error) {console.log('d1'); console.log(error); KRYPTOS.utils.log(error);})
                    .then(signEncryptedPlainText) //.catch(function (error) {console.log('e1'); console.log(error); KRYPTOS.utils.log(error);})
                    .then(saveSignature)                    
                    .then(function() {
                        encrypterCallback(true, {
                            message: KRYPTOS.utils.ab2b64(encryptedPlainText[1]),
                            iv: KRYPTOS.utils.ab2b64(encryptedPlainText[0]),
                            signature: KRYPTOS.utils.ab2b64(signature)
                        });
                    })
                    .catch(function (error) {
                        KRYPTOS.utils.log(error);
                        if (encrypterCallback) {
                            encrypterCallback(false, error);
                        }
                    });
        },
        
        /*
         * 1. AES Key: Get HMAC of plain file part with 32 0 bytes key
         * 2. Encrypt file part with HMAC -> AES key
         * 2. HMAC: Get HMAC of encrypted file part
         * 3. partsize = 4194304
         */
        encryptFilePart: function(file, id, iv, partNumber, callback) {
            return encryptFilePart(file, id, iv, partNumber, callback).then(function(result) {
                callback(result);
            });
        }

    };
};



