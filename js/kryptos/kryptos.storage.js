/* global KRYPTOS, converse, locales, UNKNOWN, Handlebars */

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
 * The KRYPTOS Storage Module.
 * 
 */
KRYPTOS.Storage = function() {
    
    var keyStore = null;
    
    var uploadQueue = new Queue(5);
    
    var downloadQueue = new Queue(5);
    
    var filePartIv = new Uint8Array(KRYPTOS.utils.str2ab("KRYPTOS.GhostBox"));
    
    var filePartSize = 4194304;

    var ghostDrop = null;
    
    var breadcrumbs = [];
    
    var items = [];
    
    var rootFolder = null;
    
    var currentFolder = null;
    
    var owner = "";
    
    var storageArea = null;
    
    var templateStorageItem = Handlebars.templates['storage-item'];
    
    var templateStorageTransferItem = Handlebars.templates['storage-transfer-item'];
    
    var templateStorageItemInfo = Handlebars.templates['storage-item-info'];
    
    var templateBreadcrumbs = Handlebars.templates['storage-breadcrumbs'];
    
    var templateStorageFolderTree = Handlebars.templates['storage-folder-tree'];
    
    /**
     * Set up new key pairs for storage.
     * 
     * @param {function} callback
     * @returns {Promise}
     */
    var setup = function(callback) {
        $('.overlay').show();
        keyStore.setup(function(success, setupData) {
            if (success) {
                // Create root folder
                encryptNewItemAssignment(newDirectory('root'), function(directory, encryptedKey) {
                    setupData.reference_id = newReferenceId();
                    setupData.meta_data = directory;
                    setupData.encrypted_key = encryptedKey;
                    return KRYPTOS.utils.sendData(setupData, 'storage', 'setup', function(success, response) {
                        $('.overlay').hide();
                        if (success) {
                            if (callback) {
                                callback();
                            }
                        }
                        else {
                            showErrorMessage("Setup Error!", response.errors);
                        }
                    });
                });                
            }
            else {
                showErrorMessage("Setup Error!", setupData.errors);
            }
        });
    };
    
    var hasInit = function() {
        return keyStore && !keyStore.justSetUp();
    };
    
    var init = function(username) {
        owner = username;
        keyStore = keyStore || new KRYPTOS.KeyStore('storage', 's:');
        keyStore.setCachePsk(true);
        if (initGhostDrop()) {
            if (!keyStore.isLoaded() || keyStore.justSetUp()) {
                breadcrumbs = [];
                keyStore.setSetUp();
                keyStore.getPrivateKeys(getRoot);
                initCreateFolder();
                initFileUpload();
                initFolderUpload();
                initDeleteItem();
                initMoveItem();
                initCopyItem();
                initShareItem();
                initRenameItem();
                initProperties();
                initActions();
                storageArea = $('.storage-area');
                initGhostDropItems();
                initFolderTree();                
            }
        }
    };
    
    var initGhostDrop = function() {
        ghostDrop = document.getElementById("ghostdrop");
        if (ghostDrop === null) {
            return false;
        }
        ghostDrop.addEventListener("dragenter", dragenter, false);
        ghostDrop.addEventListener("dragleave", dragleave, false);
        ghostDrop.addEventListener("dragover", dragover, false);
        ghostDrop.addEventListener("drop", drop, false);
        
        return true;
    };
    
    var initGhostDropItems = function() {
        storageArea.on('dragstart', '.storage-item', function(e) {
            var draggedItemId = $(e.currentTarget).attr('data-item-id');
            e.originalEvent.dataTransfer.setData('text/plain', draggedItemId);
        });
        
        storageArea.on('dragenter', '.storage-item[data-item-type="directory"]', function(e) {
            e.stopPropagation();
            e.preventDefault();
        });
        
        storageArea.on('dragleave', '.storage-item[data-item-type="directory"]', function(e) {
            e.stopPropagation();
            e.preventDefault();
        });
        
        storageArea.on('dragover', '.storage-item[data-item-type="directory"]', function(e) {
            e.stopPropagation();
            e.preventDefault();
        });
        
        storageArea.on('drop', '.storage-item[data-item-type="directory"]', function(e) {
            e.stopPropagation();
            e.preventDefault();
            var targetItemId = $(e.currentTarget).attr('data-item-id');
            var dt = e.originalEvent.dataTransfer;
            var moveItemId = dt.getData("text/plain");
            if (moveItemId) { // Move item to folder
                moveItems(moveItemId, targetItemId);
            }
            else if (dt.files) { // Copy external user files to folder
                openFolder(targetItemId);
                handleFiles(dt.files);
            }
        });
    };
    
    var drop = function(e) {
        e.stopPropagation();
        e.preventDefault();
        var dt = e.dataTransfer;
        if (dt.files && dt.files.length > 0) {
            handleFiles(dt.files);
        }
    };
    
    var dragenter = function(e) {
        e.stopPropagation();
        e.preventDefault();
    };
    
    var dragleave = function(e) {
        e.stopPropagation();
        e.preventDefault();
    };

    var dragover = function(e) {
        e.stopPropagation();
        e.preventDefault();
    };
    
    var newReferenceId = function() {
        return KRYPTOS.utils.ab2hex(KRYPTOS.randomValue(32));
    };
    
    var resetFiles = function() {
        $('#upload-files').val('');
        $('#upload-files').focus();
    };
    
    // Max 10 files
    // Max 100 MB
    // Duplicate? Replace or rename?
    var validateFiles = function(files) {
        //Max files
        if (files.length > 10) {
            showErrorMessage("Max Files ", "Maximum 10 files can be uploaded at the same time.");
            resetFiles();
            return false;
        }
        // Max size
        for (var i = 0; i < files.length; i++) {
            if (files[i].size > 100000000) {
                showErrorMessage("Max size exceeded", "One or more files are bigger than max file upload size allowed, 100MB.");
                resetFiles();
                return false;
            }       
        }
        // Validate file names
        for (var i = 0; i < files.length; i++) {
            if (!validateItemName(files[i].name)) {
                return false;
            }
        }
        
        // Same name detected
        return true;
    };
    
    var handleFiles = function(files) {
        if ((files.length && files.length <= 0) || !validateFiles(files)) {
            return;
        }
        var promises = [];
        $('.overlay').show();

            
        for (var i = 0; i < files.length; i++) {
            promises.push(addNewFile(files[i], i));           
        }

        KRYPTOS.Promise.all(promises).then(function(result) {
            addChilds(result, function() {
                $('.overlay').hide();

                // 1. loop result and start file upload ui
                // 2. determine file parts and chunk up
                // 3. encrypt file part
                // 4. upload file part

                for (var i = 0; i < result.length; i++) {
                    // UPLOAD START!
                    insertFileTransfer(result[i].id, 'upload');

                    chunkFile(files[result[i].index], result[i].id, function(itemId) {

                    });
                }                
            });
        }).catch(function(error) {
            $('.overlay').hide();
            callback(false, error);
        });
       
    };
    
    var insertFileTransfer = function(itemId, transferType) {
        // Add to transfers
        var item = items[itemId];
        var obj = {
            id: item.item.id,
            type: KRYPTOS.utils.cleanString(item.item.plain.t, true),
            name: KRYPTOS.utils.formatLine(KRYPTOS.utils.cleanString(item.item.plain.n), 50),
            size: KRYPTOS.utils.bytesToSize(item.item.plain.s),
            bytes: KRYPTOS.utils.cleanString(item.item.plain.s, true),
            part_size: KRYPTOS.utils.cleanString(item.item.plain.ps, true),
            total_size: KRYPTOS.utils.cleanString(item.item.plain.s, true),
            icon: mimeTypeToIcon(item.item.plain.mt),
            is_upload: transferType === 'upload'
        };

        var html = templateStorageTransferItem(obj);
        $('.file-transfer-table table tbody.files').append(html);
        showFileTransfer();
        updateFileTransferCount();
    };
    
    /**
     * Read file input in chunks, encrypt in chunks and push to upload queue.
     * 
     * @param {type} file
     * @param {type} itemId
     * @param {type} callback
     * @returns {void}
     */
    var chunkFile = function(file, itemId, callback) {
        var partCount = getPartCount(file.size);
        var fileSize   = file.size;
        var chunkSize  = filePartSize; // bytes
        var offset     = 0;
        var partNumber = 0;
        var self       = this; // we need a reference to the current object
        var block      = null;

        var handler = function(evt) {
            if (evt.target.error === null) {
                offset += chunkSize;
                new KRYPTOS.Encrypter(null, null, null, null).encryptFilePart(evt.target.result, itemId, filePartIv, partNumber, function(result) {
                    items[result.id].item.plain.p.push({
                        p: result.part, // part
                        k: result.key, // key
                        m: result.hmac // mac
                    });
                    var sendData = [];
                    sendData['item_id'] = result.id;
                    sendData['part_no'] = result.part;
                    sendData['data'] = result.encrypted;
                    var job = {                       
                        run: uploadFilePart,
                        data: sendData,
                        queued: false,
                        oncompleted: function(refresh) {
                            if (refresh) {
                                uploadQueue.refresh();
                            }
                        },
                        onerror: function() {
                            console.log('onerror');
                        },
                        onexecuting: function() {
                            ++partNumber;
                            block(offset, chunkSize, file);
                        }
                    };

                    uploadQueue.push(job);
                });
            } 
            else {
                console.log("Read error: " + evt.target.error);
                return;
            }
            if (offset > fileSize) {
                callback(itemId);
                return;
            }
            
        };

        block = function(_offset, length, _file) {
            if (offset < fileSize) {
                var end = length + _offset;
                var r = new FileReader();
                var blob = _file.slice(_offset, length + _offset);
                r.onload = handler;
                r.readAsArrayBuffer(blob);
            }
            else {
                callback();
                return; 
            }
        };

        block(offset, chunkSize, file);
    };
    
    /**
     * Download a file in parts, push to the download queue, decrypt file part.
     * Join file parts when synchronized promises.
     * 
     * @param {type} itemId
     * @returns {undefined}
     */
    var downloadFile = function(itemId) {
        var promises = [];
        insertFileTransfer(itemId, 'download');
        for (var i = 0; i < items[itemId].item.plain.p.length; i++) {
            var part = items[itemId].item.plain.p[i];
            
            promises.push(
                     new KRYPTOS.Promise(function (resolve, reject) {
                        
                        var job = {                       
                            run: getFileChunk,
                            data: {
                                item_id: itemId,
                                part: part.p,
                                key: part.k,
                                mac: part.m
                            },
                            queued: false,
                            oncompleted: function(refresh, result) {
                                if (refresh) {
                                    downloadQueue.refresh();
                                }
                                resolve({
                                    id: result.id,
                                    part: result.part,
                                    file: result.file
                                    //url: URL.createObjectURL(new Blob([result.file], {type: "application/octet-stream"}))
                                });
                            },
                            onerror: function() {
                                console.log('onerror');
                            },
                            onexecuting: function() {
                                downloadQueue.refresh();
                            }
                        };

                        downloadQueue.push(job);                        
                    })
                        
            );
        }
        
        KRYPTOS.Promise.all(promises).then(function(fileParts) {
            if (fileParts.length > 0) {
                var blobs = [fileParts.length];
                for (var i = 0; i < fileParts.length; i++) {
                    blobs[i] = fileParts[i].file;
                }
                saveAs(new Blob(blobs, {type: items[fileParts[0].id].item.plain.mt}), items[fileParts[0].id].item.plain.n);
                $('.file-transfer-table table tbody.files tr[data-item-id="'+fileParts[0].id+'"]').remove();
                updateFileTransferCount();
                // Cleanup
//                for (var i = 0; i < blobs.length; i++) {
//                    blobs[i] = null;
//                }
//                blobs = null;
            }

        }).catch(function(error) {
            console.log(error);
            //callback(false, error);
        });
        
    };
    
    var isUploading = function(itemId) {
        return $('.file-transfer-table table tbody.files tr[data-item-id="'+itemId+'"]').length > 0;
    };
    
    // Called from download queue
    var getFileChunk = function(data, callback) {
        var transfer = $('.file-transfer-table table tbody.files tr[data-item-id="'+data.item_id+'"]');
        var lastLoaded = 0;
        KRYPTOS.API.downloadItem(data.item_id, data.part, function(filePart) {
            new KRYPTOS.Decrypter(KRYPTOS.utils.b642ab(data.key), filePartIv, filePart, KRYPTOS.utils.b642ab(data.mac), null, null, callback).decryptFilePart(data.item_id, data.part);
        }, function(e) {
            var loaded = e.loaded - lastLoaded;
            var bytesTransfered = loaded + parseInt(transfer.attr('data-item-bytes-transfered'));
            var totalBytes = parseInt(transfer.attr('data-item-total-size'));
            transfer.attr('data-item-bytes-transfered', bytesTransfered);
            var percent = Math.round(bytesTransfered / totalBytes * 100);
            if (percent > 100) {
                percent = 100;                    
            }            
            transfer.find('.progress-bar').attr('style', 'width:'+percent+'%');
            transfer.find('.progress-percent').html(percent + '%');
            lastLoaded = e.loaded;
        });
        
    };
    
    // Called from upload queue
    var uploadFilePart = function(sendData, callback) {
        var transfer = $('.file-transfer-table table tbody.files tr[data-item-id="'+sendData.item_id+'"]');
        var lastLoaded = 0;
        KRYPTOS.utils.sendData(sendData, 'storage', 'upload-item', function(success, response) {
            if (success === false) {
                showErrorMessage("Upload Error", "Something went wrong uploading the encrypted file part!");
            }
            else {
                // Upload done!
                items[sendData.item_id].uploads = items[sendData.item_id].uploads ? ++items[sendData.item_id].uploads : 1;
                if (items[sendData.item_id].uploads === getPartCount(items[sendData.item_id].item.plain.s)) {
                    keyStore.setCachePsk(true);
                    updateItem(items[sendData.item_id], function() {
                        transfer.remove();
                        updateFileTransferCount();
                    });                    
                }
                callback();
            }
        }, function(e) {                   
            if (e.lengthComputable) {
                var loaded = e.loaded - lastLoaded;
                var bytesTransfered = loaded + parseInt(transfer.attr('data-item-bytes-transfered')); //; - 592;
                var totalBytes = parseInt(transfer.attr('data-item-total-size'));
                transfer.attr('data-item-bytes-transfered', bytesTransfered);
                var percent = Math.round(bytesTransfered / totalBytes * 100);
                if (percent > 100) {
                    percent = 100;                    
                }
                transfer.find('.progress-bar').attr('style', 'width:'+percent+'%');
                transfer.find('.progress-percent').html(percent + '%');
                lastLoaded = e.loaded;
            }            
        });
    };
    
    var getPartCount = function(size) {
        return Math.ceil(size / filePartSize);
    };
    
    // API
    var addNewFile = function(file, index) {        
        return new KRYPTOS.Promise(function (resolve, reject) {
            var fileMetaData = newFile(file);
            var plainMetaData = fileMetaData.d;
            encryptNewItem(fileMetaData, function(metaData, key) {
                var referenceId = newReferenceId();
                var sendData = {
                    parent_id: currentFolderId(),
                    reference_id: referenceId,
                    type: 'file',
                    meta_data: metaData,
                    part_count: getPartCount(plainMetaData.s)
                };
                KRYPTOS.API.addItem(sendData, function(result) {
                    items[result.item.id] = result;
                    items[result.item.id].item.plain = plainMetaData;
                    items[result.item.id].item.plain_key = key;
                    items[result.item.id].item.reference_id = referenceId;
                    items[result.item.id].childs = [];
                    insertItem({id: result.item.id, plain: plainMetaData});

                    resolve({
                        id: result.item.id,
                        rid: referenceId,
                        key: key,
                        index: index,
                        type: 'file'
                    });
                });
            });
        });
    };
    
    var hasChildFolders = function(itemId) {
        if (KRYPTOS.utils.isEmpty(items[itemId].item.plain.ch)) {
            return false;
        }
        for (var i = 0; i < items[itemId].item.plain.ch.length; i++) {
            if (items[itemId].item.plain.ch[i].t === 'directory') {
                return true;
            }
        }
        return false;
    };
    
    var initFolderTree = function() {
        $('.css-treeview').on('click', 'div.tree-folder-item', function(e) {
            e.preventDefault();
            var type = $(this).closest('.css-treeview').attr('data-type');
            var popup = $('#' + type + '-item-popup');
            popup.find('div.tree-folder-item').removeClass('selected');
            popup.attr('data-selected-item-id', '');
            var itemId = $(this).find('input').attr('data-item-id');
            popup.attr('data-selected-item-id', itemId);
            $(this).addClass('selected');
            if (hasChildFolders(itemId)) {
                if (rootFolder.item.id === itemId) {
                    if (type === 'menu') {
                        openFolder(itemId);
                    }
                    return;
                } // Don't close root folder
                if ($(this).next().length > 0) {
                    // is open, remove childs and close
                    $(this).next().remove();
                    $(this).find('label i.fa-caret-down').addClass('fa-caret-right').removeClass('fa-caret-down');
                    $(this).find('label i.fa-folder-open').addClass('fa-folder').removeClass('fa-folder-open');
                    return;
                }
                else {
                    // not open, show childs and open
                    $(this).find('label i.fa-caret-right').addClass('fa-caret-down').removeClass('fa-caret-right');
                    $(this).find('label i.fa-folder').addClass('fa-folder-open').removeClass('fa-folder');
                    showFolderTree(type, itemId);
                }                
            }
            if (type === 'menu') {
                openFolder(itemId);
            }

        });
    };
    
    var showFolderTree = function(view, parentId, initial, skip) {
        var tree = $('#' + view + '-tree-view');
        
        var treeItems = {items: []};
        if (parentId) {
            var queryId = parentId + "" + (items[parentId].item.parent_id || "");
            tree.find('li.tree-folder div[id="item_id_' + queryId + '"]').next().remove();
            // Check if children was added already
            var len = tree.find('li.tree-folder div[id="item_id_' + queryId + '"]').next().length;
            if (len > 0) {
                return;
            }
        }
        else { // root
            parentId = rootFolder.item.id;
            treeItems.items.push({
                id: items[parentId].item.id,
                parent_id: items[parentId].item.parent_id,
                name: "Home",
                has_children: hasChildFolders(items[parentId].item.id),
                is_open: true
            });
            tree.html(templateStorageFolderTree(treeItems));
        }
        if (initial) {
            return;
        }
        if (skip) {
            insertFolderTree(tree, parentId);
        }
        else {
            getChildFolders(parentId, function(result) {
                insertFolderTree(tree, parentId);
            });
        }
    };
    
    var insertFolderTree = function(tree, parentId) {
        var treeItems = {items: []};
        for (var i = 0; i < items[parentId].childs.length; i++) {            
            if (items[parentId].childs[i].type === 'directory' && items[items[parentId].childs[i].id] && items[items[parentId].childs[i].id].item.plain) {
                var fullName = KRYPTOS.utils.cleanString(items[items[parentId].childs[i].id].item.plain.n);
                treeItems.items.push({
                    id: items[parentId].childs[i].id,
                    parent_id: items[parentId].childs[i].parent_id,
                    name: KRYPTOS.utils.formatLine(fullName, 7),
                    full_name: fullName,
                    has_children: hasChildFolders(items[parentId].childs[i].id),
                    is_open: false
                });
            }
        }
        if (!KRYPTOS.utils.isEmpty(treeItems.items)) {
            var queryId = parentId + "" + (items[parentId].item.parent_id || "");
            tree.find('li.tree-folder div[id="item_id_' + queryId + '"]').after(templateStorageFolderTree(treeItems));
            var menu = tree.find('li.tree-folder div[id="item_id_' + queryId + '"]').next();
            // Alphabetical order please
            var menuli = menu.children('li');
            menuli.sort(function(a, b) {
                var ac = a.getAttribute('data-name');
                var bc = b.getAttribute('data-name');
                return ac.localeCompare(bc);
            });
            menuli.detach().appendTo(menu);
        }
    };
    
    var showBreadcrumbs = function(itemId) {
        var breadcrumbsItems = {
            root_id: rootFolder.item.id,
            breadcrumbs: []
        };
        if (itemId && itemId !== rootFolder.item.id) {
            var item = items[itemId];
            do {
                breadcrumbsItems.breadcrumbs.unshift({
                    id: item.item.id,
                    name: item.item.plain.n
                });
                if (item.item.parent_id === rootFolder.item.id) {
                    item = null;
                    break;
                }
                item = item.item.parent_id === null ? null : items[item.item.parent_id];
            }
            while(item !== null);
        }

        var html = templateBreadcrumbs(breadcrumbsItems);
        $('#breadcrumbs').html(html);
    };
    
    var newDirectory = function(name) {
        return {
            s: null, // signature
            so: owner, // signature_owner
            iv: null,
            v: 1, // version
            d: {
                t: "directory", // type
                n: encodeURIComponent(name), // name
                c: new Date().getTime(), // created
                m: new Date().getTime(), // modified
                ch: [] // childs
            }
        };
    };
    
    var newFile = function(file) {
        return {
            s: null, // signature
            so: owner, // signature_owner
            iv: null,
            v: 1, // version
            d: {
                t: "file", // type
                n: encodeURIComponent(file.name), // name
                c: new Date().getTime(), // created
                m: file.modified || new Date().getTime(), // modified
                s: file.size, // size
                mt: file.type, // mimetype
                ps: filePartSize, // partsize
                p: [] // parts
            }
        };
    };
    
    
    var encryptNewItemAssignment = function(item, callback) {        
        var Encrypter = new KRYPTOS.Encrypter(item.d, null, false, function(success, result) {
            if (success) {
                item.s = result.signature;
                item.so = owner;
                item.iv = result.iv;
                item.d = result.message;
                callback(JSON.stringify(item), result.encrypted_key);
            }
            else {
                console.log(result);
            }
        });
        Encrypter.encryptNewItemAssignment(keyStore);
        
    };
    
    var encryptItemAssignment = function(key, recipients, callback) {        
        var Encrypter = new KRYPTOS.Encrypter("", recipients, false, function(success, result) {
            if (success) {
                callback(result);
            }
            else {
                console.log(result);
            }
        });
        Encrypter.encryptItemAssignment(keyStore, KRYPTOS.utils.b642ab(key));
        
    };
    
    var encryptNewItem = function(item, callback) {        
        var Encrypter = new KRYPTOS.Encrypter(item.d, null, false, function(success, result) {
            if (success) {
                item.s = result.signature;
                item.so = owner;
                item.iv = result.iv;
                item.d = result.message;
                callback(JSON.stringify(item), result.key);
            }
            else {
                console.log(result);
            }
        });
        Encrypter.encryptNewItem(keyStore);
        
    };
    
    var encryptExistingItem = function(directoryData, key, iv, callback) {
        var Encrypter = new KRYPTOS.Encrypter(directoryData, null, false, function(success, result) {
            if (success) {
                callback(result);
            }
            else {
                console.log(result);
            }
        });
        Encrypter.encryptExistingItem(keyStore, KRYPTOS.utils.b642ab(key), new Uint8Array(KRYPTOS.utils.b642ab(iv)));
        
    };
    
    var decryptItem = function(json, id, rid, key, callback) {
        var metaData = JSON.parse(json);
        var pvk = keyStore.getPvk();
        var Decrypter = new KRYPTOS.Decrypter(
                KRYPTOS.utils.b642ab(key), 
                new Uint8Array(KRYPTOS.utils.b642ab(metaData.iv)), 
                KRYPTOS.utils.b642ab(metaData.d), 
                KRYPTOS.utils.b642ab(metaData.s), 
                pvk, 
                null, 
                function(result, error) {
                    if (result === false) {
                        showErrorMessage("Some Error!", error);
                    }
                    else {
                        callback(result);
                    }

        });
        Decrypter.decryptItem(id, rid);
        
    };
    
    var decryptItemAssignment = function(data, callback) {
        var metaData = JSON.parse(data.item.meta_data);
        keyStore.getPdk(function(success, pdk) {
            if (success) {
                var Decrypter = new KRYPTOS.Decrypter(
                        KRYPTOS.utils.b642ab(data.item_key), 
                        new Uint8Array(KRYPTOS.utils.b642ab(metaData.iv)), 
                        KRYPTOS.utils.b642ab(metaData.d), 
                        KRYPTOS.utils.b642ab(metaData.s), 
                        keyStore.getPvk(), 
                        pdk, function(result, error) {
                            if (result === false) {
                                showErrorMessage("Some Error!", error);
                            }
                            else {
                                data.item.plain = result.json;
                                data.item.plain_key = result.key;
                                callback(data);
                            }

                });
                Decrypter.decryptItemAssignment();
            }
            else {
                showErrorMessage("Some Error!", pdk);
            }
        });
        
    };
    
    // API
    var getItem = function(itemId) {
        if (!KRYPTOS.utils.isEmpty(currentFolder.childs) && currentFolder.childs.length === currentFolder.item.plain.ch.length) {
            getChildren();
        }
        else {
            $('.overlay').show();
            KRYPTOS.API.getItem(itemId, function(data) {
                if (data.childs && !KRYPTOS.utils.isEmpty(data.childs)) {
                    currentFolder.childs = data.childs;
                    getChildren();
                }
                $('.overlay').hide();
            });
        }
    };
    
    // API
    var getRoot = function() {
        KRYPTOS.API.getRoot(function(data) {
            keyStore.setPublicKeys(data.public_keys);
            decryptItemAssignment(data.root, function(root) {
                rootFolder = currentFolder = root;
                showBreadcrumbs();
                items[root.item.id] = root;
                getChildren();
                showFolderTree('menu', null, true);
            });
        });
    };
    
    var getChildren = function() {
        storageArea.html('');
        for (var i = 0; i < currentFolder.childs.length; i++) {
            //from cache
            if (items[currentFolder.childs[i].id] && items[currentFolder.childs[i].id].item.plain) {
                insertItem(items[currentFolder.childs[i].id].item, true);                
            }
            else {
                for (var j = 0; j < currentFolder.item.plain.ch.length; j++) {
                    if (currentFolder.item.plain.ch[j].r === currentFolder.childs[i].reference_id) {
                        items[currentFolder.childs[i].id] = {
                            childs: [],
                            item: currentFolder.childs[i],
                            item_key: null,
                            parent: null
                        };
                        items[currentFolder.childs[i].id].item.plain_key = currentFolder.item.plain.ch[j].k;
                        decryptItem(currentFolder.childs[i].meta_data, currentFolder.childs[i].id, currentFolder.childs[i].reference_id, currentFolder.item.plain.ch[j].k, function(result) {
                            items[result.id].item.plain = result.plain;
                            items[result.id].item.plain.n = decodeURIComponent(items[result.id].item.plain.n);
                            insertItem(result, true);
                        });
                        break;
                    }
                }
            }
        }
    };
    
    var getChildFolders = function(parentId, callback) {
        if (!KRYPTOS.utils.isEmpty(items[parentId].item.plain.ch) && (items[parentId].childs.length !== 0 && items[parentId].item.plain.ch.length !== 0)) {
            callback(false);
        }
        else {
            $('.overlay').show();
            KRYPTOS.API.getItem(parentId, function(data) {
                items[parentId].childs = data.childs;
                var promises = [];
                  
                for (var i = 0; i < items[parentId].childs.length; i++) {
                    for (var j = 0; j < items[parentId].item.plain.ch.length; j++) {
                        if (items[parentId].item.plain.ch[j].r === items[parentId].childs[i].reference_id) {
                            items[items[parentId].childs[i].id] = {
                                childs: [],
                                item: items[parentId].childs[i],
                                item_key: null,
                                parent: null
                            };
                            items[items[parentId].childs[i].id].item.plain_key = items[parentId].item.plain.ch[j].k;
                            
                            promises.push(
                                new KRYPTOS.Promise(function (resolve, reject) {    
                                    decryptItem(items[parentId].childs[i].meta_data, items[parentId].childs[i].id, items[parentId].childs[i].reference_id, items[parentId].item.plain.ch[j].k, function(result) {
                                        items[result.id].item.plain = result.plain;
                                        resolve({});
                                        //insertItem(result);
                                    });
                                })
                            );
                    
                            break;
                        }
                    }
                }

                KRYPTOS.Promise.all(promises).then(function(result) {
                    $('.overlay').hide();
                    callback(true);

                }).catch(function(error) {
                    $('.overlay').hide();
                    //callback(false, error);
                });

            });
        }
    };
    
    var refreshItem = function(item) {
        $(".storage-item[data-item-id='"+item.item.id+"']").remove();
        insertItem(item.item);
    };
    
    var insertItem = function(item, menu) {
        item.plain.n = KRYPTOS.utils.cleanString(decodeURIComponent(item.plain.n));
        item.plain.t = KRYPTOS.utils.cleanString(item.plain.t);
        item.icon = item.plain.t === 'directory' ? 'fa-folder' : mimeTypeToIcon(item.plain.mt);
        if (menu) {
            showFolderTree('menu', items[item.id].item.parent_id, false, true);
        }
        var html = templateStorageItem(item);
        var len = $('.storage-item').length;
        if (len === 0) {
            $(html).appendTo(storageArea).show();
        }
        else {
            $('.storage-item').each(function(index) {
                var type = $(this).attr('data-item-type');
                var name = $(this).attr('title');
                var compare = null;
                if (item.plain.t === 'directory') {
                    if (type !== 'directory') { // before files
                        $(this).before(html).show();
                        return false;
                    }
                    else {
                        compare = (item.plain.n).localeCompare(name);
                        if (compare !== 1) {
                            $(this).before(html).show();
                            return false;
                        }
                    }
                }
                else if (item.plain.t === 'file') {
                    if (type === 'file') {
                        compare = (item.plain.n).localeCompare(name);
                        if (compare !== 1) {
                            $(this).before(html).show();
                            return false;
                        }
                    }
                }
                if (index === len - 1) { // last iteration
                    $(this).after(html).show();
                }
            });
        }
        
    };
    
    var initMoveItem = function() {
        $('.move-item').on('click', function () {
            $('#move-item-popup').attr('data-item-id', '');
            $('#move-item-popup').attr('data-item-id', getItemId(this));
            $('#move-item-popup').modal({
                keyboard: true,
                show: true
            });
            showFolderTree('move');
        });
        $('#move-item-popup button#confirm-move-item').on('click', function() {
            var popup = $('#move-item-popup');
            var newParentId = popup.attr('data-selected-item-id');
            var itemId = popup.attr('data-item-id');
            if (itemId) {
                 moveItems(itemId, newParentId);
            }
            $('#confirm-move-item').modal('hide');
            popup.attr('data-selected-item-id', '');
            popup.attr('data-item-id', '');
        });
    };
    
    var initRenameItem = function() {
        $('.rename-item').on('click', function () {
            $('#rename-item-popup').on('shown.bs.modal', function (e) {
                $('#rename-item-popup #rename-item').focus();
            });
            var itemId = getItemId(this);
            $('#rename-item-popup').attr('data-item-id', '');
            $('#rename-item-popup input#rename-item').val('');
            $('#rename-item-popup').attr('data-item-id', itemId);
            var title = items[itemId].item.plain.t === 'directory' ? "Rename Folder" : "Rename File";
            $('#rename-item-popup .modal-title').text(title);
            $('input#rename-item').val(items[itemId].item.plain.n);
            $('#rename-item-popup').modal({
                keyboard: true,
                show: true
            });
        });
        $('button#rename-item-button').on('click', function() {          
            var popup = $('#rename-item-popup');
            var itemId = popup.attr('data-item-id');
            var itemName = $('input#rename-item').val();
            if (validateItemName(itemName)) {
                $('#rename-item-popup').modal('hide');
                popup.attr('data-item-id', '');
                $('input#rename-item').val('');
                renameItem(itemId, itemName);
            }            
        });
    };
    
    var initShareItem = function() {
        $('.share-item').on('click', function () {
            $('#share-item-popup').attr('data-item-id', '');
            $('#share-item-popup').attr('data-item-id', getItemId(this));
            $('#share-item-popup').modal({
                keyboard: true,
                show: true
            });
            $('#item-shares').tagit({
                availableTags: KRYPTOS.Contacts.getAllEmails(),
                singleField: true,
                removeConfirmation: true
//                beforeTagAdded: function(event, ui) {
//                    return tagitBeforeHelper(event, ui, $('#to'));
//                }
            });
            $('#share-item-popup').on('shown.bs.modal', function (e) {
                $('input.ui-autocomplete-input').focus();
            });
            $('#share-item-popup').on('hide.bs.modal', function (e) {
                $("#item-shares").tagit("removeAll");
            });
        });
        
        $('button#share-item-button').on('click', function() {
           var popup = $('#share-item-popup');
            var itemId = popup.attr('data-item-id');
            if (itemId) {
                var emails = $('#item-shares').val();
                var role = $('#share-role').val();
                if (emails === '') {
                    showWarningMessage("Missing User", "Specify at least one GhostMail user you wish to share with.");
                    return;
                }
                else {
                    shareItem(itemId, emails, role, function() {
                        $('#share-item-popup').modal('hide');
                        popup.attr('data-selected-item-id', '');
                        popup.attr('data-item-id', '');
                    });
                }
            }
            
        });
    };
    
    var initCopyItem = function() {
        $('.copy-item').on('click', function () {
            $('#copy-item-popup').attr('data-item-id', '');
            $('#copy-item-popup').attr('data-item-id', getItemId(this));
            $('#copy-item-popup').modal({
                keyboard: true,
                show: true
            });
            showFolderTree('copy');
        });
        $('button#confirm-copy-item').on('click', function() {
           var popup = $('#copy-item-popup');
            var newParentId = popup.attr('data-selected-item-id');
            var itemId = popup.attr('data-item-id');
            if (itemId) {
                 copyItems(itemId, newParentId);
            }
            $('#copy-item-popup').modal('hide');
            popup.attr('data-selected-item-id', '');
            popup.attr('data-item-id', '');
        });
    };
    
    var initDeleteItem = function() {
        $('.delete-item').on('click', function () {
            $('#confirm-item-deletion').attr('data-item-id', '');
            $('#confirm-item-deletion').attr('data-item-id', getItemId(this));
            $('#confirm-item-deletion').modal({
                keyboard: true,
                show: true
            });
        });
        $('button#confirm-delete-item').on('click', function() {
           var itemId = $('#confirm-item-deletion').attr('data-item-id');
           if (itemId) {
                deleteItem(itemId);
           }
           else {
               $('#confirm-item-deletion').modal('hide');
           }
        });
    };
    
    // API
    var deleteItem = function(itemId) {
        $('.overlay').show();
        $('#confirm-item-deletion').modal('hide');
        var sendData = {
            item_id: itemId,
            confirm: true
        };
        KRYPTOS.API.deleteItem(sendData, function(result) {
            removeChild(itemId);
        });
    };

    // API
    var moveItem = function(itemId, parentId, referenceId, metaData, callback) {
        $('.overlay').show();
        var sendData = {
            item_id: itemId,
            parent_id: parentId,
            reference_id: referenceId,
            meta_data: JSON.stringify(metaData),
            confirm: true
        };
        KRYPTOS.API.moveItem(sendData, callback);
    };
    
    var initCreateFolder = function() {
        $('.create-folder').on('click', function () {
            $('#create-folder-popup').on('shown.bs.modal', function (e) {
                $('#folder-name').focus();
            });
            
            $('#create-folder-popup').modal({
                keyboard: true,
                show: true
            });
        });
        
        $('button#create-folder-button').on('click', function() {
            var folderName = $('input#folder-name').val();
            if (validateItemName(folderName)) {
                createNewFolder(folderName);
            }
        });
        
        $('input#folder-name').on('keyup', function(e) {
            if(e.keyCode === 13) { // Enter
                var folderName = $('input#folder-name').val();
                if (validateItemName(folderName)) {
                    createNewFolder(folderName);
                }
            }
        });
    };
    
    var validateItemName = function(itemName) {
        if (!KRYPTOS.utils.validName(itemName)) {
            showErrorMessage("Invalid Name", "Characters \\, /, ?, %, *, :, |, ', &quot;, &lt;, &gt;, &amp; and ; are not allowed.");
            return false;
        }
        if (existsIn(currentFolderId(), itemName, true)) {
            return false;
        }
        return true;
    };
    
    var existsIn = function(targetItemId, itemName, showError) {
        for (var i = 0; i < items[targetItemId].childs.length; i++) {
            if (items[items[targetItemId].childs[i].id] && itemName.toLowerCase() === items[items[targetItemId].childs[i].id].item.plain.n.toLowerCase()) {
                if (showError) {
                    if (currentFolder.childs[i].type === 'directory') {
                        showErrorMessage("Invalid Name", "A folder with that name already exists.");
                    }
                    else {
                        showErrorMessage("Invalid Name", "A file with that name already exists.");
                    }
                }
                return true;
            }
        }
        return false;
    };
    
    var openFolder = function(itemId) {
        if (itemId && items[itemId]) {
            breadcrumbs.push(itemId);
            items[currentFolderId()] = currentFolder;
            currentFolder = items[itemId];
            showBreadcrumbs(itemId);
            storageArea.html('');
            getItem(itemId);
        }        
    };
    
    // API
    var createNewFolder = function(name) {
        $('.overlay').show();
        $('input#folder-name').val('');
        $('#create-folder-popup').modal('hide');
        var folderMetaData = newDirectory(name);
        var plainMetaData = folderMetaData.d;
        encryptNewItem(folderMetaData, function(metaData, key) {
            var referenceId =  newReferenceId();
            var sendData = {
                parent_id: currentFolderId(),
                reference_id: referenceId,
                type: 'directory',
                meta_data: metaData,
                part_count: 0
            };
            KRYPTOS.API.addItem(sendData, function(result) {
                items[result.item.id] = result;
                items[result.item.id].item.plain = plainMetaData;
                items[result.item.id].item.plain_key = key;
                items[result.item.id].item.reference_id = referenceId;
                items[result.item.id].childs = [];
                insertItem({id: result.item.id, plain: plainMetaData});
                addChild(result.item.id, key, 'directory');
            });
        });
        
    };
    
    var currentFolderId = function() {
        return currentFolder.item.id;
    };
    
    var moveItems = function(itemId, targetItemId) {
        if (targetItemId === currentFolderId()) {
            return;
        }
        $('.overlay').show();
        $('#move-item-popup').modal('hide');
        var item = items[itemId].item;

        var metaData = JSON.parse(item.meta_data);
        var newMetaData = null;
        var referenceId = newReferenceId();
        var oldReferenceId = items[itemId].item.reference_id;
        item.plain.m = new Date().getTime();
        encryptExistingItem(item.plain, item.plain_key, metaData.iv, function(result) {
            newMetaData = {
                s: result.signature,
                so: owner,
                iv: result.iv,
                v: metaData.v,
                d: result.message
            };

            moveItem(item.id, targetItemId, referenceId, newMetaData, function() {
                newMetaData.v = newMetaData.v + 1; // keep version in sync (increased on server)
                items[itemId].item.meta_data = JSON.stringify(newMetaData);
                items[itemId].item.plain = item.plain;
                items[itemId].item.parent_id = targetItemId;
                items[itemId].item.reference_id = referenceId;
                updateTargetFolder(itemId, targetItemId, function() {
                    removeChild(item.id, oldReferenceId);
                });                   
            });
        });
    };
    
    var shareItem = function(itemId, emails, role, callback) {
        $('.overlay').show();
        var recipients = emails.toLowerCase().split(",");
        keyStore.getPublicKeys(recipients, function(success, message) {
            if (!success) {
                showErrorMessage("Share Error!", message);
            }
            else {
                var item = items[itemId];
                encryptItemAssignment(item.item.plain_key, recipients, function(result) {
                    var sendData = {
                        item_id: itemId,
                        users: result,
                        role: role
                    };
                    KRYPTOS.API.shareItem(sendData, function() {

                        $('.overlay').hide();
                        callback();
                    });
                });
            }
        });
    };
    
    var copyItems = function(itemId, targetItemId) {
        $('.overlay').show();
        $('#move-item-popup').modal('hide');
        var item = items[itemId].item;
        var plainMetaData = JSON.parse(item.meta_data);
        plainMetaData.d = item.plain;
        
        encryptNewItem(plainMetaData, function(metaData, key) {
            var referenceId = newReferenceId();
            var sendData = {
                item_id: itemId,
                parent_id: targetItemId,
                reference_id: referenceId,
                meta_data: metaData
            };
            KRYPTOS.API.copyItem(sendData, function(parent) { // Get parent folder to get new copied item id
                if (parent) {
                    var temp = [parent.childs.length];
                    for (var i = 0; i < parent.childs.length; i++) { // look up new child in plain childs
                        temp[i] = parent.childs[i];
                        for (var j = 0; j > items[parent.item.id].item.plain.ch.length; j++) {
                            if (parent.childs[i].reference_id === items[parent.item.id].item.plain.ch[j].r) {
                                temp.splice(i, 1);
                                break;
                            } 
                        }
                    }
                    var targetItem = items[targetItemId];
                    var newItem = temp[0];
                    items[newItem.id] = {
                                childs: [],
                                item: newItem,
                                item_key: null,
                                parent: null
                            };
                    items[newItem.id].item.plain = item.plain;
                    items[newItem.id].item.plain_key = key;
                    items[newItem.id].item.parent_id = targetItemId;
                    targetItem.item.plain.ch.push({r: referenceId, k: key, t: items[newItem.id].item.type});    
                    targetItem.item.plain.m = new Date().getTime();
                    updateItem(targetItem);
                }
                $('.overlay').hide();
            });

        });

    };

    /**
     * Add child items to the current folder.
     * 
     * @param {Array} childs
     * @param {function} callback
     * @returns {void}
     */
    var addChilds = function(childs, callback) {
        for (var i = 0; i < childs.length; i++) {
            currentFolder.item.plain.ch.push({r: childs[i].rid, k: childs[i].key, t: childs[i].type});
            currentFolder.childs.push(items[childs[i].id].item);
            
        }       
        currentFolder.item.plain.m = new Date().getTime();
        updateCurrentFolder(callback);
    };
    
    /**
     * Add a child item to the current folder.
     * 
     * @param {string} id
     * @param {string} key
     * @param {string} type
     * @returns {void}
     */
    var addChild = function(id, key, type) {
        currentFolder.item.plain.ch.push({r: items[id].item.reference_id, k: key, t: type});
        currentFolder.item.plain.m = new Date().getTime();
        currentFolder.childs.push(items[id].item);
        updateCurrentFolder();
    };
    
    var removeChild = function(itemId, referenceId) {
        var refId = referenceId ? referenceId : items[itemId].item.reference_id;
        var temp = [];
        for (var i = 0; i < currentFolder.item.plain.ch.length; i++) {
            if (currentFolder.item.plain.ch[i].r !== refId) {
                temp.push(currentFolder.item.plain.ch[i]);
            }
        }
        currentFolder.item.plain.ch = temp;
        temp = [];
        for (var i = 0; i < currentFolder.childs.length; i++) {
            if (currentFolder.childs[i].id !== itemId) {
                temp.push(currentFolder.childs[i]);
            }
        }
        currentFolder.childs = temp;
        $(".storage-item[data-item-id='"+itemId+"']").remove();
        currentFolder.item.plain.m = new Date().getTime();
        updateCurrentFolder();
    };
    
    var renameItem = function(itemId, name) {
        $('.overlay').show();
        var item = items[itemId];
        item.item.plain.n = encodeURIComponent(name);
        item.item.plain.m = new Date().getTime();
        updateItem(item, function() {
            refreshItem(item);
            showFolderTree('menu', item.item.parent_id);
        });
    };
    
    var updateTargetFolder = function(itemId, targetItemId, callback) {
        var item = items[itemId].item;
        var targetFolder = items[targetItemId];
        targetFolder.item.plain.ch.push({r: item.reference_id, k: item.plain_key, t: item.type}); // TODO
        targetFolder.childs.push(item);
        updateItem(targetFolder, callback);
    };
    
    // API
    var updateCurrentFolder = function(callback) {
        updateItem(currentFolder, callback);
    };
    
    var updateItem = function(item, callback) {
        var metaData = JSON.parse(item.item.meta_data);
        encryptExistingItem(item.item.plain, item.item.plain_key, metaData.iv, function(result) {
            var newMetaData = {
                s: result.signature,
                so: owner,
                iv: result.iv,
                v: metaData.v,
                d: result.message
            };
            var sendData = {
                item_id: item.item.id,
                meta_data: JSON.stringify(newMetaData),
                part_count: item.item.plain.p ? item.item.plain.p.length : 0
            };
            KRYPTOS.API.updateItem(sendData, function(result) {
                showFolderTree('menu');
                item.item.meta_data = result;
                items[item.item.id] = item;
                if (item.item.id === currentFolder.item.id) {
                    currentFolder = item;
                }
                $('.overlay').hide();
                if (callback) {
                    callback();
                }
            });
        });
    };
    
    var initFileUpload = function () {
        $('#upload-files').on('change', function() {
            var files = this.files;
            handleFiles(files);
        });
    };
    
    var initFolderUpload = function () {
        $('#upload-folder').on('change', function() {
            var files = this.files;            
            
            for (var i = 0; i < files.length; i++) {
               
            }           
        });
    };
    
    var showContextMenu = function(type, top, left, itemId) {
        $('.storage-item[data-item-id="' + itemId + '"]').addClass('selected');
        if (type === 'file' && isUploading(itemId)) {
            return;
        }
        var contextMenu = $('#' + type + '-properties');
        contextMenu.attr('data-item-id', itemId);
        contextMenu.css({position: "absolute", top: top, left: left});
        contextMenu.children('li.dropdown').addClass('open');
        
    };
    
    var initProperties = function() {
        $('.storage').on('contextmenu', function(e) {
            e.stopPropagation();
            e.preventDefault();
            var storageOffset = $('.storage').offset();
            $('.context-menu li.dropdown').removeClass('open');
            $('.storage-item').removeClass('selected');
            var element = $(e.target);
            var top = 0, left = 0;
            var type = "";
            var itemId = null;
            if (element.hasClass('directory') || element.hasClass('file')) {
                type = element.hasClass('directory') ? 'directory' : 'file';
                var parent = element.parent();
                parent.addClass('selected');
                itemId = parent.attr('data-item-id');
                var parentOffset = parent.offset();                
                top = parentOffset.top - storageOffset.top + e.offsetY;
                left = parentOffset.left - storageOffset.left + e.offsetX;
            }
            else if (element.hasClass('storage-item')) {
                type = element.hasClass('directory') ? 'directory' : 'file';
                element.addClass('selected');
                itemId = element.attr('data-item-id');
                var thisOffset = element.offset();
                top = thisOffset.top - e.offsetY;
                left = thisOffset.left - storageOffset.left + e.offsetX;
            }
            else if (element.hasClass('storage-area') || element.hasClass('ghostdrop')) {
                type = 'upload';
                var thisOffset = element.offset();
                top = thisOffset.top - storageOffset.top + e.offsetY;
                left = e.offsetX;
            }
            else {
                return;
            }
            showContextMenu(type, top, left, itemId);
        });
        
        $('.storage').on('click', '.storage-item .item-options', function(e) {
            e.preventDefault();
            $('.context-menu li.dropdown').removeClass('open');
            var storageOffset = $('.storage').offset();
            var parent = $(this).parent('.storage-item');
            var parentOffset = parent.offset();
            var top = parentOffset.top - storageOffset.top + e.offsetY;
            var left = parentOffset.left - storageOffset.left + e.offsetX;
            var type = parent.attr('data-item-type');
            var itemId = parent.attr('data-item-id');
            parent.addClass('selected');
            showContextMenu(type, top, left, itemId);
        });
        
        $('.storage').on('dblclick', 'div.directory', function(e) {
            e.preventDefault();
            var itemId = $(this).attr('data-item-id');
            openFolder(itemId);
        });
        $('.storage').on('dblclick', 'div.file', function(e) {
            e.preventDefault();
            var itemId = $(this).attr('data-item-id');
            if (isUploading(itemId)) {
                return;
            }
            downloadFile(itemId);
        });
        $('.storage').on('click', '.storage-item', function(e) {
            e.preventDefault();
            var target = $(e.target);
            $('.storage-item').removeClass('selected');
            if (!target.hasClass('item-options')) {
                $('.context-menu li.dropdown').removeClass('open');
            }
            $(this).addClass('selected');
        });
        $('.storage').on('click', function(e) {
            e.preventDefault();
            
            var target = $(e.target);
            if (!target.hasClass('directory') 
                    && !target.hasClass('file') 
                    && !target.hasClass('storage-item')
                    && !target.hasClass('item-options')) {
                $('.context-menu li.dropdown').removeClass('open');
                if (!target.hasClass('share-item')
                        && !target.hasClass('copy-item')
                        && !target.hasClass('move-item')
                        && !target.hasClass('rename-item')
                        && !target.hasClass('item-ino')) {
                    $('.storage-item').removeClass('selected');
                }
            }
        });
    };
    
    var getItemId = function(obj) {
        var parent = $(obj).closest('.context-menu');
        return parent.attr('data-item-id');
    };
    
    var initActions = function() {
        $('.upload-files').click(function(e) {
            e.preventDefault();
            $('#upload-files').click();
        });
        $('.upload-folder').click(function(e) {
            e.preventDefault();
            $('#upload-folder').click();
        });
        $('.open-folder').click(function(e) {
            e.preventDefault();
            openFolder(getItemId(this));
        });
        $('.item-info').click(function(e) {
            e.preventDefault();
            var item = items[getItemId(this)];
            showItemInfo(item.item);
        });
        $('.download-item').click(function(e) {
            e.preventDefault();
            downloadFile(getItemId(this));
        });
        $('#breadcrumbs').on('click', 'li a', function(e) {
            e.preventDefault();
            var itemId = $(this).attr('data-item-id');
            handleBreadcrumb(itemId);
        });
        $('#file-transfer .file-transfer-header').click(function(e) {
            e.preventDefault();
            toggleFileTransfer();
        });
        $('#file-transfer-toggle').click(function(e) {
            e.preventDefault();
            showFileTransfer();
        });
        
    };
    
    var updateFileTransferCount = function() {
        var count = $('#file-transfer tbody.files tr').length;
        $('.file-transfer-count').html(count);
        if (count === 0) {
            toggleFileTransfer();
        }
    };
    
    var toggleFileTransfer = function() {
        if ($('#file-transfer').is(':visible')) {
            $('#file-transfer').animate({
                'bottom': '-270px'
            }, 1000, function() {
                $('#file-transfer-toggle').show();
            });
            
        }
        else {
            showFileTransfer();
        }
    };
    
    var showFileTransfer = function() {
        if ($('#file-transfer').not(':visible')) {
            $('#file-transfer').show().animate({
                'bottom': '0px'
            }, 1200);
            $('#file-transfer-toggle').hide();
        }
    };
    
    var showItemInfo = function(item) {
        if (item) {
            var obj = {
                name: item.plain.n,
                type: item.type,
                icon: item.type === 'directory' ? 'fa-folder' : mimeTypeToIcon(item.plain.mt),
                size: KRYPTOS.utils.bytesToSize((item.type === 'directory' ? item.cache_item_size_recursive : item.plain.s)),
                created: item.plain.c === null ? "" : KRYPTOS.utils.localDateTime(item.plain.c),
                modified: item.plain.m === null ? "" : KRYPTOS.utils.localDateTime(item.plain.m)
            };
            var html = templateStorageItemInfo(obj);
            $('#item-info div.modal-body').html(html);
            $('#item-info').modal({
                keyboard: true,
                show: true
            });
        }
    };
    
    var handleBreadcrumb = function(itemId) {
        if (itemId === currentFolderId()) {
            return;
        }
        if (itemId === rootFolder.item.id) {
            breadcrumbs = [];
        }
        else {
            var temp = [];
            for (var i = 0; i < breadcrumbs.length; i++) {
                temp[i] = breadcrumbs[i];
                if (breadcrumbs[i] === itemId) {
                    break;
                }
            }
            breadcrumbs = [];
            breadcrumbs = temp;
        }
        currentFolder = items[itemId];
        showBreadcrumbs(itemId);
        getChildren();
    };
            
    return {
        hasInit: hasInit,
        init: init,
        setup: setup
    };
            
}();

