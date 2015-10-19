/* global KRYPTOS, Handlebars, showErrorMessage, Layout, Metronic, URL, ComponentsjQueryUISliders, Sanitize */
"use strict";

/**
 * Inbox
 * 
 * @name Inbox 
 * @copyright Copyright © GhostCom GmbH 2014 - 2015.
 * @license Apache License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0
 * @version 3.0
 */
var Inbox = function () {
    
    var contentContainer = $('#inbox-content');
    var storageContainer = $('#storage-content');
    var content = $('.inbox-content');
    var storage = $('.storage-content');
    var loading = $('.inbox-loading');
    var listListing = '';
    var notification = new Notifications();
    var sound = null;
    var templateInbox = Handlebars.templates['inbox'];
    var templateSent = Handlebars.templates['sent'];
    var templateDrafts = Handlebars.templates['drafts'];
    var templateStarred = Handlebars.templates['starred'];
    var templateBusiness = Handlebars.templates['business'];
    var templateViewMail = Handlebars.templates['view-mail'];
    var templateAttachmentsUpload = Handlebars.templates['attachments-upload'];
    var templateAttachmentsDownload = Handlebars.templates['attachments-download'];
    var templateNotifications = Handlebars.templates['notifications'];
    var sanitizer = new Sanitize(Sanitize.Config.MAIL);
    var emailList = new Array();
    var recipientsSecure = null;    
    var wysihtml5Editor = null;
    var editor = null;
    var chatTimer = null;
    var titleUpdating = false;
    var titleChat = false;
    var originalTitle = '';
    var active = 0;
    var username = $('#confirm-password input#username').val();
    var currentPage = 1;
    var currentType = 'inbox';
    var currentRecipient = '';
    
    var chatEnabled = true;

    var userSettings = null;

    var loadUserSettings = function() {
        $.getJSON('/users/settings', function(data) {
            if (data == null) {
                userSettings = null;
            } else {
                userSettings = data;
            }
        });
    };

    // sound disabled
    var loadSound = function() {
//        sound = document.createElement('audio');
//        sound.setAttribute('src', '/sounds/Electronic_Chime.mp3');
    };
    
    // sound disabled
    var playSound = function() {
//        sound.play();
    };
    
    var titleBlinkEffect = function() {
        if (titleUpdating) {
            return;
        }
        if (KRYPTOS.Chat.getUnreadMessages() <= 0) {
            return;
        }
        
        titleUpdating = true;
        var newTitle = 'Chat ('+ KRYPTOS.Chat.getUnreadMessages() +')';
        if (titleChat) {
            $('title').text(originalTitle);
            titleChat = false;
        } else {
            $('title').text(newTitle);
            titleChat = true;
        }
        titleUpdating = false;
    };
    
    var updateTitle = function(newCount) {
        if (titleUpdating && !titleChat) return;
        titleUpdating = true;
        var currentTitle = $('title').text();
        var newTitle = "";
        if ( currentTitle.indexOf("hat") == -1 ) {
            newTitle = currentTitle.replace(/ \((\d*)\)/g, '');
            if (newCount > 0 ) {
                newTitle = newTitle.replace(/ -/g, ' ('+ newCount + ') -');
            }
            $('title').text(newTitle);
            originalTitle = $('title').text();
        }
        titleUpdating = false;
    };
    
    var mailCheck = function(skipNotification) {
        $.ajax({
            type: "GET",
            cache: false,
            url: 'messages/check?active=' + active,
            dataType: "json", 
            success: function (data) {
                var currentCount = $('.badge.unread-mails:first').html();
                updateTitle(data.unread_count);
                $('.last-mail-check').html(data.last_check);
                $('.total-count').html(data.total_count);
                $('.unread-sent-count').html(data.unread_sent_count);
                $('.unread-notifications-count').html(data.notifications_unread_count > 0 ? data.notifications_unread_count : '');            
                $('.storage-bar .formatted-line').html(data.storage.formatted_line);
                $('.storage-bar .progress-bar').attr('style', 'width:'+data.storage.used_percentage+'%');
                if (data.drafts_count <= 0) {
                    $('.drafts-mails').html('');
                }
                else {
                    $('.drafts-mails').html('('+data.drafts_count+')');
                }
                
                if (data.notifications_unread_count <= 0) {
                    $('.ghostmail-notifications').html('<li><a href="javascript:;"><span class="details">No new notifications</span></a></li>');
                }
                else {
                    var html = templateNotifications({notifications: data.notifications});
                    $('.ghostmail-notifications').html(html);
                }
                if (data.unread_count && data.unread_count !== 0) {
                    if (parseInt(currentCount) < data.unread_count) {
                        //console.log('skipNotification');
                        //console.log(skipNotification);
                        if (skipNotification !== true) {
                            playSound();
                            notification.notify("GhostMail", "You've got a new GhostMail!");
                        }
                        // auto load inbox only when visible
                        if (content.children('table').hasClass('load-inbox-view')) {
                            loadInbox($('.inbox-nav > li.inbox > a'), 'inbox');
                        }
                        
                    }
                    $('.badge.unread-mails').html(data.unread_count);
                    $('.no-badge.unread-mails').html('('+data.unread_count+')');
                    $('.unread-count').html(data.unread_count);
                    $('.unread-mails').show();
                }
                else if (data.unread_count === 0) {
                    $('.badge.unread-mails').html(data.unread_count);
                    $('.no-badge.unread-mails').html('('+data.unread_count+')');
                    $('.unread-count').html(data.unread_count);
                    $('.unread-mails').hide();
                }
                
                var currentRequestCount = $('.contact-requests:first').html();
                
                if (data.requests_count && data.requests_count !== 0) {
                    if (parseInt(currentRequestCount) < data.requests_count) {
                        playSound();
                        // auto load contacts only when visible
                        if (content.children('table').hasClass('load-contacts-view')) {
                            loadContacts();
                        }
                    }
                    $('.contact-requests').html(data.requests_count);
                    $('.contact-requests').show();
                }
                else if (data.requests_count === 0) {
                    $('.contact-requests').html();
                    $('.contact-requests').hide();
                }
            },
            error: function (xhr, ajaxOptions, thrownError) {

            }
        });
        checkDraft(function(){});
    };
    
    var checkDraft = function(callback) {
        var $saveDraftButon = $('.inbox-content button.save-draft');
        if ($saveDraftButon.length > 0) {
            if ($saveDraftButon.is(':disabled')) { // Save already in progress (manual click or other)
                callback();
                return;
            }
            saveDraft(callback);
        }
        else {
            callback();
        }
    };
    
    var loadInbox = function(el, type, page, recipient, skipNotification) {
        active = 0;
        $(".Metronic-alerts").remove();
        mailCheck(skipNotification);
        $('.overlay').show();
        var title = $('.inbox-nav > li.' + type + ' a').attr('data-title');   
        var params = page ? "?" + $.param({
            page: page
        }) : '';
        currentRecipient = recipient;
        if (currentRecipient) {
            params += "&" + $.param({recipient: recipient});
        }
        else {
            currentRecipient = '';
            $('.mail-search-form').find('input[name="recipient"]').val('');
        }
        listListing = type;
        loading.show();
        clearContent(function() {
            toggleButton(el);
            menuTop('inbox-menu-item');   
            showMenu('mail');
            showSection(type);
            currentType = type;
            currentPage = page;
            if (type === 'drafts') {
                $('.mail-search-form').hide();
            }
            else if (type === 'sent') {
                $('.mail-search-form input[name=recipient]').prop('placeholder', 'Search by receiver');
                $('.mail-search-form').show();
            }
            else {
                $('.mail-search-form input[name=recipient]').prop('placeholder', 'Search by sender');
                $('.mail-search-form').show();
            }
            $.ajax({
                type: "GET",
                cache: false,
                url: 'mail/' + type + params,
                dataType: "json", 
                success: function (data) {
                    toggleButton(el);

                    leftMenu(type);
                    $('.inbox-header > h1').text(title).show();

                    if(data.prompt_email && type === 'inbox' && !data.no_more_popup){
                        addAltEmail();
                    }

                    KRYPTOS.utils.getMessages(data, function(success, mails) {

                        if (!success) {
                            showErrorMessage("Unexpected Error", mails);
                            loading.hide();
                            return;
                        }


                        var html = "";
                        if (!mails) {
                            html = "<p>No mails.</p>";
                        }
                        else {
                            mails.recipient = currentRecipient;                        
                            switch (type) {
                                case 'inbox': html = templateInbox(mails); break;
                                case 'sent': html = templateSent(mails); break;
                                case 'drafts': html = templateDrafts(mails); break;
                                case 'starred': html = templateStarred(mails); break;
                                case 'business': html = templateBusiness(mails); break;
                            }
                        }
                        content.html(html);
                        loading.hide();
                        if (Layout.fixContentHeight) {
                            Layout.fixContentHeight();
                        }
                        Metronic.initUniform();
                        $('.overlay').hide();
                    });                

                },
                error: function (xhr, ajaxOptions, thrownError) {

                    $('.overlay').hide();
                }
            });
        });        
        
        $('body').on('change', '.mail-group-checkbox', function () {
            var set = $('.mail-checkbox');
            var checked = $(this).is(":checked");
            $(set).each(function () {
                $(this).prop("checked", checked);
            });
        });
    };
    
    var loadPage = function (el, type, title, menu, callback) {
        active = 0;
        var url = 'mail/' + type;
        
        $(".Metronic-alerts").remove();

        $('.mail-search-form').hide();
        $('.inbox-header > h1').text(title).show();
        
        clearContent(function() {
            toggleButton(el);
            menuTop(menu + '-menu-item');
            showMenu(menu);
            leftMenu(type);       
            showSection(type);

            if (type === 'storage' && KRYPTOS.Storage.hasInit()) {
                return;
            }
            loading.show();

            $.ajax({
                type: "GET",
                cache: false,
                url: url,
                dataType: "html",
                success: function (res) {
                    toggleButton(el);
                    loading.hide();
                    showContent(type, res);
                    Metronic.initUniform();
                    if (type === 'password') {

                        initComplexify();
                        initChangePassword();
                        $('.tooltipz').click(function(e){
                            e.preventDefault();
                        });
                    }
                    else if (type === 'storage') {
                        KRYPTOS.Storage.init(username);
                    }
                    if (callback) {
                        callback();
                    }

                },
                error: function (xhr, ajaxOptions, thrownError) {
                    toggleButton(el);
                },
                async: true
            });
        });        
        
    };

    var loadMessage = function (el, messageId, from, to, cc, type, isUnread, recipientType) {
        active = 0;
        loading.show();
        $('.overlay').show();
        clearContent(function() {
            toggleButton(el);
            showMenu('mail');
            $('.mail-search-form').hide();
            $('.inbox-header > h1').text('').hide();
            if (isUnread) {
                KRYPTOS.Messages.read(recipientType + ':' + messageId, function(result) {});
            }

            var json = KRYPTOS.Messages.get(messageId);

            if (json) {
                showMail(json, messageId, from, to, cc);
                toggleButton(el);
            }
            else if (type === 'system' || type === 'notification') {
                $.getJSON('/messages/mail?type=' + type + '&message_id=' + messageId, function(message) {

                    from = "The GhostMail Team";
                    showMail(message, messageId, from, to, cc);
                    toggleButton(el);
                    KRYPTOS.Messages.add(messageId, message);
                });
            }
            else if (type === 'plain') {
                KRYPTOS.utils.getInboundMessage(messageId, function (json) {
                        KRYPTOS.Messages.add(messageId, json);
                        showMail(json, messageId, from, to, cc);
                        toggleButton(el); 
                    });
            }
            else {
                KRYPTOS.utils.getMessage(messageId, from, function (json) {
                    KRYPTOS.Messages.add(messageId, json);
                    showMail(json, messageId, from, to, cc);
                    toggleButton(el); 
                });
            }
        });        
    };
    
    var initEditor = function() {
        editor = $('div#eg-basic');
        editor.editable({
            key: 'Njfg1ceJ-7rA-21yB2twt==',
            theme: 'custom',
            placeholder: '',
            imageUpload: false,
            fileUploadURL: '',
            imageUploadURL: '',
            pastedImagesUploadURL: '',
            inlineMode: false,
            allowScript: false,
            allowStyle: true,
            allowComments: false,
            spellcheck: true,
            allowedTags: ['p', 'a', 'h1', 'h2', 'h3', 'div', 'h4', 'h5', 'h6', 'hr', 'blockquote', 'span', 'br', 'table', 'tbody', 'tfoot', 'thead', 'th', 'td', 'tr', 'u', 'ul', 'li', 'dd', 'dl', 'dt', 'ol', 'em', 'i', 'b', 'strong', 'code'],
            //allowedAttrs: ['href', 'style'],
            buttons: ['bold', 'italic', 'underline', 'fontSize', 'fontFamily', 'color', 'formatBlock', 'insertOrderedList', 'insertUnorderedList', 'align', 'outdent', 'indent', 'undo', 'redo']
        });
        editor.focus(function() {
            editor.editable('focus');
        });
    };
    
    var initTagit = function(to, cc1, cc2, bcc) {
        $('#to').tagit({
            availableTags: KRYPTOS.Contacts.getAllEmails(),
            singleField: true,
            removeConfirmation: true,
            beforeTagAdded: function(event, ui) {
                return tagitBeforeHelper(event, ui, $('#to'));
            },
            afterTagAdded: function(event, ui) {
                return tagitAfterHelper(event, ui, $('#to'));                
            }            
        });
        if (to) {
            $('#to').tagit('createTag', to);
        }
        $('#cc').tagit({
            availableTags: KRYPTOS.Contacts.getAllEmails(),
            singleField: true,
            removeConfirmation: true,
            beforeTagAdded: function(event, ui) {
                return tagitBeforeHelper(event, ui, $('#cc'));
            },
            afterTagAdded: function(event, ui) {
                return tagitAfterHelper(event, ui, $('#cc'));                
            }
        });
        if (cc1) {
            var cc1a = cc1.split(",");
            for (var i = 0; i < cc1a.length; i++) {
                $('#cc').tagit('createTag', cc1a[i]);
            }
        }
        if (cc2) {
            var cc2a = cc2.split(",");
            for (var i = 0; i < cc2a.length; i++) {
                $('#cc').tagit('createTag', cc2a[i]);
            }
        }
        $('#bcc').tagit({
            availableTags: KRYPTOS.Contacts.getAllEmails(),
            singleField: true,
            removeConfirmation: true,
            beforeTagAdded: function(event, ui) {
                return tagitBeforeHelper(event, ui, $('#bcc'));
            },
            afterTagAdded: function(event, ui) {
                return tagitAfterHelper(event, ui, $('#bcc'));                
            }
        });
        if (bcc) {
            var bcc1 = bcc.split(",");
            for (var i = 0; i < bcc1.length; i++) {
                $('#bcc').tagit('createTag', bcc1[i]);
            }
        }
    };
    
    var isItAnEmail = function(email){
        var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(email);
    };
    
    var isItAGhostMail = function(email) {
        var rht = "";
        if(Array.isArray(email)){
            rht = email[0].split("@")[1];
        } else {
            rht = email.split("@")[1];
        }
        return rht === "ghostmail.com";
    };
    
    var displayMailUnsafeUI = function(toggle) {
        switch(toggle){
            case true:
            case 1:
                $('#unsecure-send').css('border', '9px solid #D4242F');                            
                $('#unsafe-mail').fadeIn('slow');
                $('#autodestruct-slider').fadeOut('slow');
                $('.fileinput-button').fadeOut('slow');
                $('#plock').removeClass('fa-lock').addClass('fa-unlock-alt');                
                $('<input>').attr({type:'hidden',id:'usec',name:'usec',value:'1'}).appendTo('#compose');
                break;
            case false:
            default:
                $('#unsecure-send').css('border', 'none');                            
                $('#unsafe-mail').fadeOut('slow');
                $('#autodestruct-slider').fadeIn('slow');
                $('.fileinput-button').fadeIn('slow');
                $('#plock').removeClass('fa-unlock-alt').addClass('fa-lock');
                $('#usec').remove();
                break;
        }
    };
    
    var showAlert = function(messageTxt, closePreviousAlerts) {
        Metronic.alert({
            container: '.inbox-header',/// alerts parent container(by default placed after the page breadcrumbs)
            place: 'prepend', // append or prepent in container 
            type: 'danger',  // alert's type
            message: messageTxt,  // alert's message
            close: 1, // make alert closable
            reset: closePreviousAlerts, // close all previouse alerts first
            focus: 1, // auto scroll to the alert after shown
            closeInSeconds: 0, // auto close after defined seconds
            icon: 'warning' // put icon before the message
        });
    };
    
    var pollCurrentEmailList = function(){
        var toEl = $('input#to').val();
        var ccEl = $('input#cc').val();
        var bccEl = $('input#bcc').val();
        emailList = '';
        if(!!toEl) {
            emailList = toEl;
            if(!!ccEl || !!bccEl) emailList += ',';
        }
        if(!!ccEl) {
            emailList += ccEl;
            if(!!bccEl) emailList += ',';
        }
        if(!!bccEl) emailList += bccEl;
        
        if (emailList === '') {
            recipientsSecure = null;
            displayMailUnsafeUI(false);
            return;
        }
        var emailArray = emailList.split(",");
        
        $.each(emailArray, function(i, val) {
            recipientsSecure = isItAGhostMail(val);
        });
    };
    
    var tagitBeforeHelper = function(event, ui, selector) {
        if (!ui.duringInitialization) {
            pollCurrentEmailList();
            var tagArray = ui.tagLabel.split(/[\s,|;]+/);
            if (tagArray.length>1) {
                
                for (var i=0,max=tagArray.length;i<max;i++) {
                    var CurrEmail = tagArray[i];
                    if(isItAnEmail(CurrEmail)){                        
                        selector.tagit("createTag", tagArray[i]);                       
                    }                    
                }          
                return false;
                
            } else {
                if(isItAnEmail(tagArray)){
                        if(isItAGhostMail(tagArray)){
                            if(recipientsSecure === false && recipientsSecure !== null){
                                showAlert("You can't send to both a GhostMail email and an unsecure email at the same time." , 1);
                                return false;
                            }
                            displayMailUnsafeUI(false);
                            recipientsSecure = true;
                        } else {                           
                            if(recipientsSecure === true && recipientsSecure !== null){
                                showAlert("You can't send to both a GhostMail email and an unsecure email at the same time.", 1);
                                return false;
                            }
                            displayMailUnsafeUI(true);
                            recipientsSecure = false;
                        }
                     
                }  else {
                    return false;
                }               
            }      
        }
    };
    
    var tagitAfterHelper = function(event, ui, selector) {
        if(recipientsSecure) {
            $('i.epadlock').addClass('fa-lock-alt').css('color', '#3B4D64');
        } else {
            $('i.epadlock').addClass('fa-unlock-alt').css('color', '#D4242F');
        }
    };
    
    var attachmentsMeta = [];
    var maxSize = 20000000;
    var totalSize = 0;
    
    var initFileUpload = function () {
        attachmentsMeta = [];
        totalSize = 0;

        $('#fileupload').on('change', function() {
            var files = this.files;
            
            
            
            for (var i = 0; i < files.length; i++) {
                var duplicate = false;
                for (var j = 0; j < attachmentsMeta.length; j++) {
                    if (attachmentsMeta[j].name === files[i].name) {
                        duplicate = true;
                        showErrorMessage("Duplicate attachment", KRYPTOS.utils.cleanString(files[i].name) + " has already been attached.");
                        break;
                    }
                }
                if (!duplicate) {
                    totalSize += files[i].size;
                    if (totalSize > maxSize) {
                        showErrorMessage("Max size exceeded", KRYPTOS.utils.cleanString(files[i].name) + " has not been attached. Total attachment size allowed 20MB.");
                        totalSize -= files[i].size;
                    }
                    else {
                        KRYPTOS.utils.readFile(files[i], function(blob, meta) {
                            attachmentsMeta.push(meta);
                            var fileMeta = meta;
                            fileMeta.size = KRYPTOS.utils.bytesToSize(meta.size);
                            fileMeta.url = URL.createObjectURL(new Blob([blob], {type: "application/octet-stream"}));

                            var html = templateAttachmentsUpload(fileMeta);
                            $('.inbox-compose-attachment table tbody.files').append(html);
                            
                            new KRYPTOS.Encrypter(null, null, false, null).encryptFile(blob, meta.id, function(result) {
                                if (!result[0].status) {
                                    KRYPTOS.utils.error(showErrorMessage, 'Upload Error', result[0].message);
                                    $('.inbox-compose-attachment table tbody.files tr[data-fileid="'+meta.id+'"] .progress-bar').attr('style', 'width:0%');
                                    $('.inbox-compose-attachment table tbody.files tr[data-fileid="'+meta.id+'"] .progress-percent').html('0%');
                                    $('.inbox-compose-attachment table tbody.files tr td.delete button').show().click();
                                }                                
                                else {
                                    for (var j = 0; j < attachmentsMeta.length; j++) {
                                        if (attachmentsMeta[j].id === result[0]['id']) {

                                            attachmentsMeta[j].hmac = result[0]['hmac'];
                                            attachmentsMeta[j].key = result[0]['key'];
                                            attachmentsMeta[j].uuid = result[0]['uuid'];
                                            $('.inbox-compose-attachment table tbody.files tr[data-fileid="'+result[0]['id']+'"]').attr('data-uuid', result[0]['uuid']);
                                            $('.inbox-compose-attachment table tbody.files tr td.uploaded button').show();
                                            $('.inbox-compose-attachment table tbody.files tr td.delete button').show();
                                        }
                                    }
                                }
                            }, function(e) {
                                
                                if (e.lengthComputable) {
                                    var percent = Math.round(e.loaded / e.total * 100);                                    
                                    $('.inbox-compose-attachment table tbody.files tr[data-fileid="'+meta.id+'"] .progress-bar').attr('style', 'width:'+percent+'%');
                                    $('.inbox-compose-attachment table tbody.files tr[data-fileid="'+meta.id+'"] .progress-percent').html(percent + '%');  
                                }
                            });
                            
                        });
                    }
                }
            }           
        });
        
        $('.inbox-compose-attachment').on('click', 'table tbody.files tr td.delete button', function() {
            $(this).off('click');
            
            var $upload = $(this).parent('td').parent('tr');
            var uuid = $upload.attr('data-uuid');
            var temp = [];
            $upload.remove();
            for (var j = 0; j < attachmentsMeta.length; j++) {
                if (attachmentsMeta[j].uuid === uuid) {                    
                    totalSize -= attachmentsMeta[j].bytes;                    
                    continue;
                }
                temp.push(attachmentsMeta[j]);
            }
            attachmentsMeta = [];
            attachmentsMeta = temp;
        });
    };
    
    var initFileDownload = function(uuid, attachmentsMetaData, from) {
        
        attachmentsMeta = attachmentsMetaData;
        for (var i = 0; i< attachmentsMetaData.length; i++) {
            var html = templateAttachmentsDownload(attachmentsMetaData[i]);
            $('.inbox-compose-attachment table tbody.files').append(html);
        }
        
        $('.inbox-compose-attachment').on('click', 'table tbody.files tr.enabled', function() {
            var $aRow = $(this);
            
            var fileId = $aRow.attr('data-fileid');
            var totalSize = $aRow.attr('data-size');
            var key, hmac, type;
            for (var i = 0; i< attachmentsMetaData.length; i++) {
                if (attachmentsMetaData[i]['uuid'] === fileId) {
                    type = attachmentsMetaData[i]['type'];
                    key = attachmentsMetaData[i]['key'];
                    hmac = attachmentsMetaData[i]['hmac'];
                    break;
                }
            }
            if (key && hmac) {
                $('.inbox-compose-attachment table tbody.files tr[data-fileid="'+fileId+'"] .progress-bar').attr('style', 'width:0%');
                $('.inbox-compose-attachment table tbody.files tr[data-fileid="'+fileId+'"] .progress-percent').html('0%');
                KRYPTOS.utils.getAttachment(uuid, fileId, key, hmac, function (success, attachment) {
                    if (success) {
//                        var url = URL.createObjectURL(new Blob([attachment], {type: type}));
                        var $fileNameSelector = $aRow.find('span.filename');
                        var fileName = $fileNameSelector.text();
//                        $fileNameSelector.html('<a href="' + url + '" download="' + fileName + '">' + fileName + '</a>');
//                        $aRow.removeClass('enabled');
                        $aRow.find('button').html('<i class="fa fa-unlock"></i>'); 
                        $aRow.find('button').prop('title', 'Click on the file name to view');
                        saveAs(new Blob([attachment], {type: type}), fileName);
                    }
                    else {
                        showErrorMessage("Attachment Error", attachment);
                    }
                }, function(e) {
                    $('.inbox-compose-attachment table tbody.files tr[data-fileid="'+fileId+'"] .progress').show();
                    $('.inbox-compose-attachment table tbody.files tr[data-fileid="'+fileId+'"] .progress-percent').show();
                    if (totalSize > 0) {
                        var percent = Math.round(e.loaded / totalSize * 100);                                    
                        $('.inbox-compose-attachment table tbody.files tr[data-fileid="'+fileId+'"] .progress-bar').attr('style', 'width:'+percent+'%');
                        $('.inbox-compose-attachment table tbody.files tr[data-fileid="'+fileId+'"] .progress-percent').html(percent + '%');                            
                    }
                });
            }
            else {
                showErrorMessage("Attachment Not Found", "Something went wrong!");
            }
        });
    };

    var loadCompose = function (el, uuid, type, from, to, cc) {
        if (!userSettings) loadUserSettings();
        active = 1;
        var url = 'mail/compose';
        attachmentsMeta = [];
        loading.show();
        clearContent(function() {
            toggleButton(el);
            menuTop('compose-menu-item');
            showMenu('mail');
            $('.mail-search-form').hide();

            // load the form via ajax
            $.ajax({
                type: "GET",
                cache: false,
                url: url,
                dataType: "html",
                success: function (res) {
                    toggleButton(el);

                    $('.inbox-nav > li.active').removeClass('active');
                    $('a.compose').parent('li').addClass('active');
                    if (uuid) {
                        $('.inbox-header > h1').text(type).show();
                    }
                    else {
                        $('.inbox-header > h1').text('Compose').show();
                    }

                    loading.hide();
                    content.html(res);

                    initFileUpload();
                    initEditor();

                    if (userSettings['settings.mail.signatures.enable'] == 1) {
                        var messageObj = JSON.parse(userSettings['settings.mail.signatures']);
                        KRYPTOS.getPrivateDecryptionKey( function (success, pdk) {
                            if (success) {
                                messageObj.key = KRYPTOS.utils.b642ab(messageObj.k);
                                messageObj.iv = KRYPTOS.utils.b642ab(messageObj.iv);
                                messageObj.message = KRYPTOS.utils.b642ab(messageObj.m);
                                messageObj.signature = KRYPTOS.utils.b642ab(messageObj.s);
                                KRYPTOS.Keys.getPublicKey(username, 'verify', function(pvk) {
                                    new KRYPTOS.Decrypter(messageObj.key, messageObj.iv, messageObj.message, messageObj.signature, pvk, pdk, function(plainText) {
                                        //               (encryptedKey  , iv           , cipherText        , signature           , theirPublicKey, privateKey, callback)
                                        if (plainText) {
                                            if (uuid) {
                                                //var json = KRYPTOS.Messages.get(uuid);
                                                if (type === 'Reply') {
                                                    var timeFrom = KRYPTOS.utils.timestamp(KRYPTOS.Messages.get(uuid).timestamp) + ' from ' + from;
                                                    var editorContent = decodeURIComponent(plainText.text) +
                                                        "<br><br>" + timeFrom + "<br>------------------------------<br>" +
                                                        decodeURIComponent(KRYPTOS.utils.unescapeJson(KRYPTOS.Messages.get(uuid).body));
                                                    plainText.text = editorContent;
                                                    //editor.editable('setHTML', decodeURIComponent(plainText.text), true);
                                                    focusEditor(plainText.text);
                                                } else if (type === 'Forward' ) {
                                                    var subject = decodeURIComponent(KRYPTOS.Messages.get(uuid).subject);
                                                    if(subject.indexOf("FW: ") === -1) {
                                                        subject = "FW: " + subject;
                                                    }
                                                    var timestamp = KRYPTOS.utils.timestamp(KRYPTOS.Messages.get(uuid).timestamp);
                                                    var editorContent = "<br><br>------------ Forwarded message ------------<br>From: "+
                                                        from+"<br>Date: "+timestamp+"<br>Subject: "+subject+"<br>" +
                                                        decodeURIComponent(KRYPTOS.utils.unescapeJson(KRYPTOS.Messages.get(uuid).body));
                                                    plainText.text = decodeURIComponent(plainText.text) + editorContent;
                                                } else {
                                                    plainText.text = KRYPTOS.Messages.get(uuid).body;
                                                }
                                            }
                                            editor.editable('setHTML', decodeURIComponent(plainText.text), true);
                                        }
                                    }).decrypt();
                                });
                            }
                        });
                    }

                    ComponentsjQueryUISliders.init();

                    if (type === 'Compose' || type === 'Forward') {
                        if (to) {
                            initTagit(to);
                        }
                        else {
                            initTagit();
                        }
                        $('ul.tagit li.tagit-new input').focus();                        
                    }
                    handleCCInput();

                    $('input:radio[name="autodest"]').change(function() {
                        if($(this).val() === 'yes') {
                           $('#ad-slider-s').show();
                        }
                        if($(this).val() === 'no') {
                           $('#ad-slider-s').hide();
                        }
                    });

                    if (uuid) {
                        if (type === 'Reply') {
                            showReply(KRYPTOS.Messages.get(uuid), uuid, from, to || cc);
                        }
                        else if (type === 'Forward') {
                            showForward(KRYPTOS.Messages.get(uuid), uuid, from, to, cc);
                        }
                        else {
                            var $form = $('form#compose');
                            $form.find('input[name="message_id"]').val(uuid);
                            showDraft(KRYPTOS.Messages.get(uuid), uuid, from);
                        }
                    }
                },
                error: function (xhr, ajaxOptions, thrownError) {
                    toggleButton(el);
                },
                async: true
            });
        });
    };

    var handleCCInput = function () {
        var the = $('.inbox-compose .mail-to .inbox-cc'); //anchor text > open CC input
        var input = $('.inbox-compose .input-cc'); // CC input
        the.hide();
        input.show();        
        $('.close', input).click(function () {
            input.hide();
            the.show();
        });
    };

    var handleBCCInput = function () {

        var the = $('.inbox-compose .mail-to .inbox-bcc');
        var input = $('.inbox-compose .input-bcc');
        the.hide();
        input.show();
        $('.close', input).click(function () {
            input.hide();
            the.show();
        });
    };

    var toggleButton = function (el) {
        if (typeof el === 'undefined') {
            return;
        }
        if (el.attr("disabled")) {
            el.attr("disabled", false);
        } else {
            el.attr("disabled", true);
        }
    };
    
    var menuTop = function(item) {
        $('ul.nav.navbar-nav li').removeClass('active');
        $('ul.nav.navbar-nav li a.' + item).parent('li').addClass('active');
        $('ul.nav.navbar-nav li a.' + item).addClass('active');
    
        // logout button in mobile menu to white (under 992px wide)
        $('ul.nav.navbar-nav li a.logout').removeClass('active');
        $('div.page-header div.container a.logout i.icon-key').removeClass('active');
        if(item === 'inbox-menu-item'){
            $('ul.nav.navbar-nav li a.logout').addClass('active');
            $('div.page-header div.container a.logout i.icon-key').addClass('active');
        }       
    };
    
    var showMenu = function(menu) {
        $('.inbox-nav').hide();
        $('#' + menu + "-menu").show();
    };
    
    var showSection = function(type) {
        if (type === 'storage') {
            contentContainer.hide();
            storageContainer.show();
        }
        else {
            storageContainer.hide();
            contentContainer.show();
        }
    };
    
    var showContent = function(type, html) {
        if (type === 'storage') {
            if (storage.length > 0) {
                storage.html(html);
            }
        }
        else {
            content.html(html);
        }        
    };
    
    var clearContent = function(callback) {
        checkDraft(function() {
            content.html('');
            callback();
        });
    };

    var leftMenu = function(item) {
        $('.inbox-nav > li.active').removeClass('active');
        $('.inbox-nav > li.' + item).addClass('active');
    };
    
    var showMail = function (json, uuid, from, to, cc) {
        window.opener = null;
        loading.hide();
        $('.overlay').hide();
        var show_starring = false;

        if (json.recipient_type === 'from') {
            show_starring = false;
        } else {
            show_starring = true;
        }
//        console.log('------------');
//        console.log(decodeURIComponent(json.body));
//        console.log('------------');
        
        clearContent(function() {
            var sanitized = json.type === 'system' ? decodeURIComponent(json.body) : KRYPTOS.utils.sanitize(sanitizer, decodeURIComponent(json.body));
//            var str = '<p>We need to look into this issue as soon as possible.</p><p>Ajay try first if you can verify what he is saying, sending an email. Insert the &lt;meta... code with inspect element in chrome (not in the compose area)</p><p>Thanks!</p><p>Greetings,</p><p>Firstly, I wanted to say thank you for developing such a great service! I\'ve enjoyed using GhostMail so far.</p><p>While exchanges mail with two test accounts I created, I found that input such as the following two examples are not escaped in mail bodies and are not protected against using Content-Security-Policy headers:</p><ol>  <li><meta http-equiv="refresh" content="0;url=http://ericrafaloff.com"/></li></ol><p>The above will refresh the page and redirect the victim to whatever URL is specified. This works across all browsers. The result is that upon opening an email on GhostMail containing the above, I am immediately redirected to another website.</p><p>The above can also lead to js evaluation in certain browsers. Chrome seems to prevent eval\'ing js specified after the url=. However, some research shows that older versions of Chrome don\'t and I have yet to explore using other browsers to test this. Seems nasty.</p><ol>  <li>&lt;meta http-equiv="Set-Cookie" content="COOKIE_NAME=test; path=/; expires=Thursday, 20-May-18 00:12:00 GMT"&gt;</li></ol><p>This effectively forces the client to set a cookie. I have yet to explore this attack avenue much, but I believe it to be quite dangerous since cookies are used to persist sessions and identify unique users.</p><p>Please let me know if you require any additional information.</p><p>Have a nice day!</p><p>____________________________________</p><p>GhostCom GmbH</p><p>Mickey Joe</p><p>CTO &amp; Co-Founder</p><p><a href="https://www.ghostmail.com">https://www.ghostmail.com</a>&nbsp;&nbsp;</p><p><a href="https://www.facebook.com/SecureGhostMail">https://www.facebook.com/SecureGhostMail</a>&nbsp;</p><p>@SecureGhostMail</p><p>mickey@ghostmail.com</p>';
//            var sanitized = KRYPTOS.utils.sanitize(sanitizer, str);
//            console.log('------------');
//            console.log(sanitized);
//            console.log('------------');
//            console.log(json);
            var html = templateViewMail({
                page: currentPage,
                type: currentType,
                recipient: currentRecipient,
                uuid: uuid,
                subject: json.subject,
                recipient_type: json.recipient_type,
                from: from,
                to: to,
                cc: cc,
                show_starring: show_starring,
                is_starred: json.is_starred,
                is_business: json.is_business,
                tof: KRYPTOS.utils.formatEmails(to),
                ccf: KRYPTOS.utils.formatEmails(cc),
                timestamp: new Date(json.timestamp).toDateString() + ' ' + new Date(json.timestamp).toLocaleTimeString(),
                body: sanitized,//decodeURIComponent(json.body),
                has_attachments: json.attachments && !KRYPTOS.utils.isEmpty(json.attachments_meta)
            });
            content.html(html);
            if (json.attachments_meta) {
                initFileDownload(uuid, json.attachments_meta, from);
            }
        });        
    };
    
    var focusEditor = function(editorContent) {
        var ft = setTimeout(function () {
            editor.editable('setHTML', editorContent, true);
            editor.editable('focus');
            clearTimeout(ft);
         }, 100);
    };

    var showReply = function (json, uuid, from, replyAll) {
        if (replyAll) {  
            var to = JSON.parse(json.to), cc = JSON.parse(json.cc);
            var me = KRYPTOS.utils.u2e(username);
            if (json.recipient_type === 'to' && !KRYPTOS.utils.isEmpty(to)) {
                for (var i = 0; i < to.length; i++) {
                    if (to[i] === me) {
                        delete to[i];
                    }
                }
            }
            else if (json.recipient_type === 'cc' && !KRYPTOS.utils.isEmpty(cc)) {
                for (var i = 0; i < cc.length; i++) {
                    if (cc[i] === me) {
                        delete cc[i];
                    }
                }
            }

            if (!KRYPTOS.utils.isEmpty(to) || !KRYPTOS.utils.isEmpty(cc)) {
                handleCCInput();
            }
            initTagit(from, to.toString(), cc.toString());
        }
        else {
            initTagit(from);
        }
        
        $('textarea#message').css('visibility', 'hidden');
        
        var subject = json.subject;
        if(subject.indexOf("RE: ") === -1) {
            subject = "RE: " + subject;
        } 
        $('input#subject').val(subject);
        
        var timeFrom = KRYPTOS.utils.timestamp(json.timestamp) + ' from ' + from;
        var editorContent = "<br><br>" + timeFrom + "<br>------------------------------<br>" + decodeURIComponent(KRYPTOS.utils.unescapeJson(json.body));
        focusEditor(editorContent);

    };
    
    var showDraft = function (json, uuid, from) {
        var to = JSON.parse(json.to), cc = JSON.parse(json.cc), bcc = JSON.parse(json.bcc);
        if (!KRYPTOS.utils.isEmpty(cc)) {
            handleCCInput();
        }
        if (!KRYPTOS.utils.isEmpty(bcc)) {
            handleBCCInput();
        }
        initTagit(to.toString(), cc.toString(), null, bcc.toString());
        var subject = json.subject;
        $('textarea#message').css('visibility', 'hidden');
        $('input#subject').val(subject);
        var editorContent = decodeURIComponent(KRYPTOS.utils.unescapeJson(json.body));
        if (json.auto_destruct_hrs > 0) {
            $('#ad-slider-s').show();
            $('input#autodest_0').prop("checked", "checked");
            ComponentsjQueryUISliders.init(json.auto_destruct_hrs);
        }        
        focusEditor(editorContent);
        if (json.attachments_meta) {
            attachmentsMeta = json.attachments_meta;
            initFileDownload(uuid, json.attachments_meta, from);
        }
    };
    
    var showForward = function (json, uuid, from, to, cc) {
        
        var recipients = "";
        if (to) {
            recipients += "To: " + to + "<br>";
        }
        if (cc) {
            recipients += "Cc: " + cc + "<br>";
        }
        
        var subject = json.subject;
        if(subject.indexOf("FW: ") === -1) {
            subject = "FW: " + subject;
        } 
        $('input#subject').val(subject);
        
        var timestamp = KRYPTOS.utils.timestamp(json.timestamp);
        var editorContent = "<br><br>------------ Forwarded message ------------<br>From: "+from+"<br>Date: "+timestamp+"<br>Subject: "+subject+"<br>"+recipients+"<br><br>" + decodeURIComponent(KRYPTOS.utils.unescapeJson(json.body));
        editor.editable('setHTML', editorContent, true);
        if (json.attachments_meta) {
            initFileDownload(uuid, json.attachments_meta, from);
        }
    };
    
    var confirmDeletionDialog = function(uuid, callback) {
        $('#confirm-deletion').modal({
            keyboard: true,
            show: true
        });
        $('button#confirm-delete').on('click', function() {
            $(this).off('click');
            var $input = $(this);
            $input.text('Deleting, please wait...');
            $input.prop('disabled', true);
            KRYPTOS.Messages.delete(uuid, function(result) {
                $input.text('Confirm Delete');
                $input.prop('disabled', false);
                if (result) {
                    if (callback) {
                        callback();
                    }
                    else {
                        loadInbox($(this), 'inbox');
                    }
                }
                $('#confirm-deletion').modal('hide');
            });
        });
    };
    
    var addAltEmail = function() {
        $('#alt-email').modal({
            keyboard: false,
            show: true,
            backdrop: 'static'
        });
        $('button#add-alt-email').on('click', function() {
            var $form = $('form.update-settings');
            changeSettings($form, function(success, response) {
                    
                    if (success) {
                        showSuccessMessage("Email Updated", "Your Alternative Email was updated successfully.");
                        $('#alt-email').modal('hide');
                    }
                    else { /* Create generic function for error handling */
                        var errorMessage = '';
                        if (response.errors) {
                            var $err = response.errors;
                            for (var prop in $err) {
                                if($err.hasOwnProperty(prop)) {
                                    errorMessage += $err[prop] + "<br><br>";
                                }
                            }
                        } else if(response.error) {
                            errorMessage = response.error;
                        }
                        showErrorMessage("Update Error", errorMessage);
                    }
                //notNow();
            });                       
        });

        $('button#dismiss-alt-email, button#dismiss-close-alt-email').on('click', function() {
            notNow();
        });
        $('button#never-show-popup').on('click', function() {
            neverShowPopup();
        });
    };
    
    var notNow = function() {
        KRYPTOS.utils.sendJson({}, 'sessions', 'not-now', function(success, response) {});
      
    };
    var neverShowPopup = function() {
        KRYPTOS.utils.sendJson({}, 'sessions', 'never-popup', function(success, response) {});     
    };
    
    var confirmContactDeletionDialog = function(username) {
        $('#confirm-deletion').modal({
            keyboard: true,
            show: true
        });
        $('button#confirm-delete').on('click', function() {
            $(this).off('click');
            var $input = $(this);
            $input.text('Deleting, please wait...');
            $input.prop('disabled', true);
            KRYPTOS.Contacts.remove(username, function(success, result) {
                $input.text('Confirm Delete');
                $input.prop('disabled', false);
                if (success) {
                    showSuccessMessage("Contact(s) Deleted!", "The contact(s) were deleted successfully.");
                    loadContacts();
                }
                else {
                    showSuccessMessage("Error", "Could not delete contact(s)");
                }
                $('#confirm-deletion').modal('hide');
            });
        });
    };
    
    var loadContacts = function() {
        loadPage($('a.contacts-menu-item'), 'contacts', 'Contacts', 'contacts', function() {
            setContactStatus();
        });
        // need timeout to make contacts left menu item add class active
        setTimeout(function() {$('li.contacts').addClass('active');},10);
    };
    
    var setContactStatus = function() {
        if (chatEnabled) {
            var contacts = KRYPTOS.Chat.getContacts();
            if (contacts) {
                if (contacts.length > 0) {
                    for (var i = 0; i < contacts.length; i++) {
                        KRYPTOS.Chat.setContactStatus(contacts[i].user_id, contacts[i].chat_status);
                    }
                }
            }
        }
    };

    var addContact = function(form, callback) {
        
        var url = form.prop('action');
        var button = form.find('button');
        var input = form.find('input');
        
        if (input.val() === '') {
            return;
        }
        
        button.prop('disabled', true);
        $('.overlay').show();

        var data = form.serialize();
        var posting = $.post(url, appendToken(data));
        posting.done(function(response) {
            
            loadContacts();
            showSuccessMessage("Contact Added", response.username);

            form.find('input').val('');


        }).fail(function(jqxhr) {

            $('.overlay').hide();
            // enable button to able registration
            button.prop('disabled', false);

            var $er = $.parseJSON(jqxhr.responseText);
            if ($er.errors.username) {
                showErrorMessage("Error", $er.errors.username);
            }
            else {
                var errorMessage = "";
                if ($er) {
                    for (var prop in $er) {
                        if($er.hasOwnProperty(prop)) {
                            errorMessage += "<br><br>";
                        }
                     }
                }
                showErrorMessage("Error", errorMessage);
            }
        });
      
    };


    var changeSignature = function(form, callback) {
        var url = form.prop('action');
        var button = form.find('#setting-button');
        var chkBoxSignEnable = form.find('input#enable_email_signature');
        var enableSign = 0;

        if (chkBoxSignEnable[0].checked) enableSign = 1;

        // Encrypt Signature

        button.prop('disabled', true);
        button.text('Updating, please wait...');

        promptPassword(function (password) {
            $('.overlay').show();

            var plain = editor.editable('getHTML', false, true);
            var dataToEnc = {
                id:   0,
                name: 'default',
                text: encodeURIComponent(plain)
            };

            KRYPTOS.Keys.getRecipientsPublicKeys([username], function (success, message) {
                if (success) {
                    var Encrypter = new KRYPTOS.Encrypter(dataToEnc, {to: [username]}, false, function (success, result) {
                        if (success) {
                            var dataToSend = {
                                'password' : password,
                                'signatures.enable': enableSign,
                                'signature': JSON.stringify(result)
                            };

                            KRYPTOS.utils.sendData(dataToSend, 'settings', 'signature', function (success, response) {
                                $('.overlay').hide();
                                if (success) {
                                    if (response.success) {
                                        showSuccessMessage("Account Updated", response.success);
                                    } else if (response.info) {
                                        showInfoMessage("Account Info", response.info);
                                    } else {
                                        showSuccessMessage("Account Updated", "Your account has been updated successfully");
                                    }
                                    loadUserSettings();
                                    loadInbox($('.inbox-nav > li.inbox > a'), 'inbox');
                                } else {
                                    // enable button to able registration
                                    button.prop('disabled', false);
                                    button.text('Save Changes');
                                    showErrorMessage('Verification Error', 'We could not verify your password, please insert the correct password!');
                                }
                            });
                        } else {
                            console.log('changeSignature - Error on Encryption.');
                        }
                    });
                    Encrypter.encryptSignatureMessage();
                } else {
                    console.log('changeSignature - Error getting Public Key.');
                }
            });
        });
    }



    var changeSettings = function(form, callback) {
        var url = form.prop('action');
        var button = form.find('button');
        var doSign = form.find('#has-email-signature');
        var data = null;
        var posting = null;

        promptPassword(function (password) {
            button.prop('disabled', true);
            button.text('Updating, please wait...');
            $('.overlay').show();

                data = form.serialize() + "&password=" + password;
                posting = $.post(url, data);


                posting.done(function (response) {
                    $('.overlay').hide();
                    if (callback) {
                        callback(true, response);
                    }
                    else {

                        if (response.success) {
                            showSuccessMessage("Account Updated", response.success);
                        }
                        else if (response.info) {
                            showInfoMessage("Account Info", response.info);
                        }
                        else {
                            showSuccessMessage("Account Updated", "Your account has been updated successfully");
                        }

                        loadInbox($('.inbox-nav > li.inbox > a'), 'inbox');
                    }

                }).fail(function (jqxhr) {
                    $('.overlay').hide();
                    if (callback) {

                        callback(false, $.parseJSON(jqxhr.responseText));
                    }
                    else {
                        // enable button to able registration
                        button.prop('disabled', false);
                        button.text('Save Changes');


                        var $er = $.parseJSON(jqxhr.responseText);
                        if ($er.errors.verify) {
                            showErrorMessage("Verification Error", $er.errors.verify);
                        }
                        else {
                            var errorMessage = "";
                            if ($er.errors) {
                                for (var prop in $er.errors) {
                                    if ($er.errors.hasOwnProperty(prop)) {
                                        errorMessage += $er.errors[prop] + "<br><br>";
                                    }
                                }
                            }
                            showErrorMessage("Error in " + prop, errorMessage);
                        }
                    }
                });
        });
    };
    
    var invite = function(form) {
        var url = form.prop('action');
        var button = form.find('button');
        
            button.prop('disabled', true);
            button.text('Submitting, please wait...');
            var data = form.serialize();
            var posting = $.post(url, data);
            posting.done(function(response) {
                button.prop('disabled', false);
                button.text('Invite');
                $("#emails").val('');
                $("#message").val('');
                var emailsSent = "";
                for (var i = 0; i < response.email.length; i++) {
                    emailsSent += response.email[i] + "<br />";
                }
                showSuccessMessage("Invitation(s) Sent", "An invitation was sent to the following emails:<br />" + emailsSent);

            }).fail(function(jqxhr) {
                
                // enable button to able registration
                button.prop('disabled', false);
                button.text('Invite');
                var $er = $.parseJSON(jqxhr.responseText);
                if ($er.errors.username) {
                    showErrorMessage("Invitation(s) Not Sent", $er.errors.username);
                }
                else {
                    showErrorMessage("Invitation(s) Not Sent", $er.errors.email);
                }
            });
            
    };


    var saveDraft = function(callback) {
        var $form = $('form#compose');
        var $button = $form.find('button.save-draft');
        var $deleteButton = $form.find('button.inbox-discard-btn');
        $button.prop('disabled', true);
        $deleteButton.prop('disabled', true);
        var from = $form.find('input[name="from"]').val();

        var autodestruct = parseInt($form.find('input[name="autodestruct"]').val());
        var to = $form.find('input[name="to"]').val();
        var cc = $form.find('input[name="cc"]').val();
        var bcc = $form.find('input[name="bcc"]').val();
        var usec = $form.find('input[name="usec"]').val();
        var fSubject = $form.find('input[name="subject"]').val();
        var uuid = $form.find('input[name="message_id"]').val();
        var plain = editor.editable('getHTML', false, true);
        var autosave = autodestruct || to || cc || bcc || usec || fSubject || plain || attachmentsMeta.length;

        if (autosave) {        
            var recipients = {
                to: [],
                cc: [],
                bcc: [],
                from: [from]
            };

            if (to) {
               recipients.to = to.toLowerCase().split(",");
            }
            if (cc) {
                recipients.cc = cc.toLowerCase().split(",");
            }
            if (bcc) {
                recipients.bcc = bcc.toLowerCase().split(",");
            }

            // Check if some attachments are still uploading
            if (!KRYPTOS.utils.isEmpty(attachmentsMeta)) {
                for (var j = 0; j < attachmentsMeta.length; j++) {
                    if (attachmentsMeta[j].uuid === null) {
                        showErrorMessage("Attachments not uploaded yet", "Please wait for the attachments to finish uploading.");
                        return;
                    }
                }
            }

            KRYPTOS.Keys.getRecipientsPublicKeys([from], function(success, message) {
                if (!success) {
                    $button.prop('disabled', false);
                    $form.find('textarea, input').prop('disabled', false);
                    showErrorMessage("Draft Not Saved!", message);
                }
                else {
                    var plainText = {
                        timestamp: new Date().getTime(),
                        subject: encodeURIComponent(fSubject),
                        body: encodeURIComponent(plain),
                        autodestruct: autodestruct,
                        attachments: attachmentsMeta
                    };

                    var Encrypter = new KRYPTOS.Encrypter(plainText, recipients, true, function(success, message) {
                        if (success) {
                            if (message.uuid) {
                                $form.find('input[name="message_id"]').val(message.uuid);
                            }
                        }
                        else {
                            $form.find('textarea, input').prop('disabled', false);
                            KRYPTOS.utils.error(showErrorMessage, 'Draft Not Sent!', message);
                        }
                        $button.prop('disabled', false);
                        $deleteButton.prop('disabled', false);
                        if (callback) {
                            callback(success);
                        }
                    });

                    if (usec) {
                        var plainMess = [];
                        plainMess['subject'] = KRYPTOS.utils.escapeHTML(fSubject);
                        plainMess['body'] = editor.editable('getHTML', true, true);
                        Encrypter.encrypt(plainMess, 'draft', uuid);
                    } else {
                        Encrypter.encrypt(null, 'draft', uuid);
                    }

                }

            });
        }
        else {
            $button.prop('disabled', false);
            $deleteButton.prop('disabled', false);
            if (callback) {
                callback(true);
            }
        }
    };
    
    var sendMail = function() {
        var $form = $('form#compose');
                var $button = $form.find('button.send');
                var $buttonDraft = $form.find('button.save-draft');
                var from = $form.find('input[name="from"]').val();
                
                var autodestruct = parseInt($form.find('input[name="autodestruct"]').val());
                var to = $form.find('input[name="to"]').val();
                var cc = $form.find('input[name="cc"]').val();
                var bcc = $form.find('input[name="bcc"]').val();
                var usec = $form.find('input[name="usec"]').val();
                var fSubject = $form.find('input[name="subject"]').val();
                var plain = editor.editable('getHTML', false, true);
                // Check if any recipients
                if (to === '' && cc === '' && bcc === '') {
                    showErrorMessage("No recipients", "Please specify at least one recipient.");
                    return;
                }
                if (fSubject === '') {
                    showErrorMessage("No Subject", "Please write a Subject for the Email.");
                    return;
                }

                if (plain === '') {
                    showErrorMessage("No Message", "Please write a Message for the Email.");
                    return;
                }

                var recipients = {
                    to: [],
                    cc: [],
                    bcc: [],
                    from: [from]
                };

                var emails = [from];
                if (to) {
                   recipients.to = to.toLowerCase().split(",");
                   emails = emails.concat(recipients.to);
                }
                if (cc) {
                    recipients.cc = cc.toLowerCase().split(",");
                    emails = emails.concat(recipients.cc);
                }
                if (bcc) {
                    recipients.bcc = bcc.toLowerCase().split(",");
                    emails = emails.concat(recipients.bcc);
                }
                
                if(usec) emails = emails.splice(0, 1);

                // Check if some attachments are still uploading
                if (!KRYPTOS.utils.isEmpty(attachmentsMeta)) {
                    for (var j = 0; j < attachmentsMeta.length; j++) {
                        if (attachmentsMeta[j].uuid === null) {
                            showErrorMessage("Attachments not uploaded yet", "Please wait for the attachments to finish uploading.");
                            return;
                        }
                    }
                }
                
                $buttonDraft.prop('disabled', true);
                $button.prop('disabled', true);
                //Start spinner
                $('.overlay').show();
                var uuid =  $form.find('input[name="message_id"]').val();
                KRYPTOS.Keys.getRecipientsPublicKeys(emails, function(success, message) {

                if (!success) {
                    $button.prop('disabled', false);
                    $buttonDraft.prop('disabled', false);
                    $form.find('textarea, input').prop('disabled', false);
                    showErrorMessage("Mail Not Sent!", message);
                }
                else {
                    var plainText = {
                        timestamp: new Date().getTime(),
                        subject: encodeURIComponent(fSubject),
                        to: KRYPTOS.utils.u2e(KRYPTOS.utils.escapeHTML(to)),
                        body: encodeURIComponent(plain),
                        autodestruct: autodestruct,
                        attachments: attachmentsMeta
                    };

                    var Encrypter = new KRYPTOS.Encrypter(plainText, recipients, usec, function(success, error) {
                        if (success) {
                            active = 0;
                            attachmentsMeta = [];
//                            showSuccessMessage("Mail Sent!", "The mail was sent successfully.");                                    
                            loadInbox($(this), 'inbox');
                            setContactStatus();
                        }
                        else {
                            $button.prop('disabled', false);
                            $buttonDraft.prop('disabled', false);
                            $form.find('textarea, input').prop('disabled', false);
                            KRYPTOS.utils.error(showErrorMessage, 'Mail Not Sent!', error);
                        }                            
                    });

                    if(usec){
                        var plainMess = [];
                        plainMess['subject'] = KRYPTOS.utils.escapeHTML(fSubject);
                        plainMess['body'] = plain;
                        Encrypter.encrypt(plainMess, 'message', uuid);
                    } else {
                        Encrypter.encrypt(null, 'message', uuid);
                    }

                }

            });
    };

    return {
        
        getUsername: function() {
            return username;
        },
        isChatEnabled: function() {
            return chatEnabled;
        },
        disableChat: function() {
            chatEnabled = false;
        },
        
        getNotifier: function() {
            return notification;
        },
        
        //main function to initiate the module
        init: function () {

            loadUserSettings();

            $('.inbox').on('propertychange change click keyup input paste', 'input#to, input#cc, input#bcc', function(e) {
               pollCurrentEmailList();
            });

            // Stared / Un Stared
            $('.inbox').on('click', 'i.js_star', function(e) {
                e.preventDefault();
                var $i = $(this);
                var $mid = null;
                var $tmpMail = null;
                if ($i.parent().is('a')) {
                    $mid = $i.parent().attr('data-messageid');
                } else {
                    $mid = $i.parent().parent().attr('data-messageid');
                }
                if ($i.hasClass('fa-star-o')) {
                    KRYPTOS.Messages.star($mid, function(result) {
                        if (result) {
                            // un-stared => stared
                            // update cache
                            $tmpMail = KRYPTOS.Messages.get($mid);
                            $tmpMail.is_starred = 1;
                            KRYPTOS.Messages.add($mid, $tmpMail);
                            $i.removeClass('fa-star-o');
                            $i.addClass('fa-star');
                            $i.css('color', '#f7ca18');
                            // trigger database update
                        }
                    });
                } else {
                    KRYPTOS.Messages.unstar($mid, function(result) {
                        if (result) {
                            // stared => un-stared
                            // update cache
                            $tmpMail = KRYPTOS.Messages.get($mid);
                            $tmpMail.is_starred = 0;
                            KRYPTOS.Messages.add($mid, $tmpMail);
                            $i.removeClass('fa-star');
                            $i.addClass('fa-star-o');
                            $i.css('color', '#c1c1c1');
                            // trigger database update
                        }
                    });

                }
            });

            // Business / Un Business
            $('.inbox').on('click', 'i.fa-briefcase', function(e) {
                e.preventDefault();
                var $i = $(this);
                var $mid = null;
                var $tmpMail = null;
                if ($i.parent().is('a')) {
                    $mid = $i.parent().attr('data-messageid');
                } else {
                    $mid = $i.parent().parent().attr('data-messageid');
                }
                if ($i.hasClass('js_business-o')) {
                    KRYPTOS.Messages.business($mid, function(result) {
                        if (result) {
                            // un-business => business
                            $tmpMail = KRYPTOS.Messages.get($mid);
                            $tmpMail.is_business = 1;
                            KRYPTOS.Messages.add($mid, $tmpMail);
                            $i.removeClass('js_business-o');
                            $i.addClass('js_business');
                            $i.css('color','#777777');
                        }
                    });
                } else {
                    KRYPTOS.Messages.unbusiness($mid, function(result) {
                        if (result) {
                            // business => un-business
                            $tmpMail = KRYPTOS.Messages.get($mid);
                            $tmpMail.is_business = 0;
                            KRYPTOS.Messages.add($mid, $tmpMail);
                            $i.removeClass('js_business');
                            $i.addClass('js_business-o');
                            $i.css('color','#c1c1c1');
                        }
                    });
                }
            });


            // Handle next page load in all mailboxes
            $('.inbox').on('click', 'a.btn-paging', function(e) {
                e.preventDefault();
                var $a = $(this);
                currentPage = $a.attr('data-page');
                currentType = $a.attr('data-type');
                currentRecipient = $a.attr('data-recipient');
                loadInbox($('.inbox-nav > li.inbox > a'), currentType, currentPage, currentRecipient);
            });
            $('.inbox').on('click', 'a.back-button', function(e) {
                e.preventDefault();
                var $a = $(this);
                var currentPage = $a.attr('data-prev-page');
                var currentType = $a.attr('data-prev-type');
                var currentRecipient = $a.attr('data-prev-recipient');
                loadInbox($('.inbox-nav > li.inbox > a'), currentType, currentPage, currentRecipient);
            });
            
            $('.inbox').on('submit', 'form.mail-search-form', function() {
                
                var recipient = $(this).find('input[name="recipient"]').val();
                loadInbox($('.inbox-nav > li.inbox > a'), currentType, 1, recipient);
                return false;
            });
            
            $('.inbox').on('submit', 'form#form-contact-username', function() {
                
                addContact($(this));
                return false;
            });
            
            $('.inbox').on('click', 'tr.unread td .click-to-accept', function() {
                var username = $(this).closest('tr.unread').attr('data-username');
                if (username) {
                    $('.overlay').show();
                    KRYPTOS.Contacts.accept(username, function(success, message) {
                        
                        if (success) {
                            loadContacts();
                            showSuccessMessage("Contact Accepted", message.username);
                        }
                        else {
                            showErrorMessage("Error", message.username);
                        }
                    });
                    return false;
                }
            });
            
            $('.inbox').on('click', 'tr td .click-to-chat', function() {
                var jid = $(this).closest('tr').attr('data-jid');
                if (chatEnabled) {
                    KRYPTOS.Chat.openChat(jid);
                }
            });
            
            $('.inbox').on('click', 'tr td .click-to-mail', function() {
                var email = $(this).closest('tr').attr('data-email');
                loadCompose($(this), null, 'Compose', null, email);
            });
            
            $('.inbox').on('click', 'span.click-to-mail', function() {
                // TODO: only if type system
                var email = $(this).attr('data-email');
                loadCompose($(this), null, 'Compose', null, email);
            });
            
            $('.inbox').on('submit', 'form.update-settings', function() {
                
                changeSettings($(this));
                return false;
            });

            $('.inbox').on('submit', 'form.update-signature', function() {
                changeSignature($(this));
                return false;
            });
            
            $('.inbox').on('submit', 'form.setup-2fa', function() {
                var $form = $(this);
                
                changeSettings($form, function(success, response) {
                    
                    var $button = $form.find('button');
                    $button.prop('disabled', false);
                    
                    if (success) {
                        $button.text('Activate Two-Factor Authentication');
                        $form.find('.2fa_qr_code_input').show();
                        $form.find('.2fa_code_input').show();
                        $form.find('#2fa_code').focus();
                        $form.find('#qr_code').html('<img src="'+response.qr+'">');
                        $form.prop('action', 'settings/activate2fa');
                        $form.removeClass('setup-2fa').addClass('activate-2fa');
                    }
                    else {
                        $button.text('Enable Two-Factor Authentication');
                        showErrorMessage("Verification Error", response.error);
                    }
                });
                return false;
            });
            
            $('.inbox').on('submit', 'form.activate-2fa', function() {
                var $form = $(this);
                
                changeSettings($form, function(success, response) {
                    
                    
                    var $button = $form.find('button');
                    $button.prop('disabled', false);
                    
                    if (success) {
                        $button.hide();
                        $form.find('.2fa_qr_code_input').hide();
                        $form.find('.2fa_code_input').hide();
                        $form.find('.2fa_backup_code_input').show();
                        $('.2fa_backup_code_input').show();
                        $form.find('#backup_code').prop('value', response.backup_code);
                        $form.find('#2fa_status').prop('value', 'Enabled');                        
                        showSuccessMessage("Two-Factor Authentication enabled!", "Congratulations! Next time you log in to GhostMail you will have to enter a verification code generated on your mobile device.");
                    }
                    else {
                        $button.text('Activate Two-Factor Authentication');
                        showErrorMessage("Verification Error", response.error);
                    }
                });
                return false;
            });
            
             $('.inbox').on('click', 'form.activate-2fa a.2fa_backup_code_input', function() {
                
                loadPage($('.inbox-nav > li.two-factor > a'), 'two-factor', 'Two-Factor Authentication', 'settings');
                return false;
             });
            
            $('.inbox').on('click', 'form.enabled-2fa button.show-qr', function() {
                var $form = $('form.enabled-2fa');
                $form.prop('action', 'settings/show-qr');
                var $b1 = $form.find('button.show-qr');
                var $b2 = $form.find('button.disable-2fa');
                changeSettings($form, function(success, response) {
                    
                    $b1.text('Show QR Code');
                    $b2.text('Disable Two-Factor Authentication');
                    if (success) {                        
                        $form.find('.2fa_qr_code_input').show();
                        $form.find('#qr_code').html('<img src="'+response.qr+'">');                        
                    }
                    else {
                        showErrorMessage("Some Error", response.error);
                    }
                    $form.prop('action', '');
                    $b1.prop('disabled', false);
                    $b2.prop('disabled', false);
                });
                return false;
            });
            
            $('.inbox').on('click', 'form.enabled-2fa button.disable-2fa', function() {
                var $form = $('form.enabled-2fa');
                $form.prop('action', 'settings/disable2fa');
                var $b1 = $form.find('button.show-qr');
                var $b2 = $form.find('button.disable-2fa');
                changeSettings($form, function(success, response) {
                      
                    $b1.text('Show QR Code');
                    $b2.text('Disable Two-Factor Authentication');
                    if (success) {                        
                        $form.find('.2fa_qr_code_input').show();
                        $form.find('#qr_code').html('<img src="'+response.qr+'">');
                        showSuccessMessage("Two-Factor Authentication disabled!", "Two-Factor Authentication has been disabled successfully.");
                        loadPage($('.inbox-nav > li.two-factor > a'), 'two-factor', 'Two-Factor Authentication', 'settings');
                    }
                    else {
                        showErrorMessage("Some Error", response.error);
                        $form.prop('action', '');
                        $b1 = $form.find('button.show-qr');
                        $b2 = $form.find('button.disable-tfa');
                        $b1.prop('disabled', false);
                        $b2.prop('disabled', false);
                    }                    
                });
                return false;
            });
            
            $('.inbox').on('submit', 'form.activate-storage', function() {
                KRYPTOS.Storage.setup(function() {
                    loadPage($(this), 'storage', 'GhostBox', 'storage');
                });
                return false;
            });

            // handle compose btn click
            $('.inbox').on('click', '.compose-btn a', function () {
                loadCompose($(this), null, 'Compose');
            });
            
            $('a.inbox-menu-item').on('click', function () {
                loadInbox($(this), 'inbox');
            });
            
            $('a.storage-menu-item').on('click', function () {
                loadPage($(this), 'storage', 'GhostBox', 'storage');
            });

            // handle compose btn click
            $('a.compose-menu-item').on('click', function () {
                loadCompose($(this), null, 'Compose');
            });
            
            $('a.toggle-controlbox').on('click', function (e) {
                e.preventDefault();
                if (chatEnabled) {
                    KRYPTOS.Chat.toggleControl(e);
                }
            });
            
            // handle discard btn
            $('.inbox').on('click', '.inbox-discard-btn', function (e) {
                e.preventDefault();
                var uuid = $('form#compose').find('input[name="message_id"]').val();
                if (uuid) {
                    confirmDeletionDialog("draft:" + uuid, function() {
                        loadInbox($('.inbox-nav > li.inbox > a'), 'drafts');
                    });
                }
                else {
                    loadInbox($(this), listListing);
                }
            });

            // handle reply button click
            $('.inbox').on('click', '.reply-btn', function () {
                loadCompose($(this), $(this).attr('data-messageid'), 'Reply', $(this).attr('data-from'), $(this).attr('data-to'), $(this).attr('data-cc'));
            });
            
            // handle forward button click
            $('.inbox').on('click', '.forward-btn', function () {
                loadCompose($(this), $(this).attr('data-messageid'), 'Forward', $(this).attr('data-from'), $(this).attr('data-to'), $(this).attr('data-cc'));
            });
            
            // handle delete button click
            $('.inbox').on('click', '.contact-delete-btn', function () {
                var username = $(this).attr('data-username');
                if (!username) return;
                confirmContactDeletionDialog(username);
            });
            
            // handle multiple delete button click
            $('.inbox').on('click', '.multiple-contact-delete-btn', function () {
                var usernames = $('input.mail-checkbox:checked').map(function() {
                    return this.value;
                }).get().join(',');
                if (!usernames) return;
                confirmContactDeletionDialog(usernames);
            });
            
            // handle delete button click
            $('.inbox').on('click', '.delete-btn', function () {
                var uuid = $(this).attr('data-messageid');                
                if (!uuid) return;
                confirmDeletionDialog(uuid);
            });
            // handle print button click
            $('.inbox').on('click', '.print-btn', function () {
                window.print();
            });
            $('.inbox').on('click', '.unread-btn', function () {
                var uuid = $(this).attr('data-messageid');                
                if (!uuid) return;

                KRYPTOS.Messages.unread(uuid, function(result) {
                    loadInbox($('.inbox-nav > li.inbox > a'), 'inbox', null, null, true);
                });             
            });
            
            // handle multiple delete button click
            $('.inbox').on('click', '.multiple-delete-btn', function () {
                var uuids = $('input.mail-checkbox:checked').map(function() {
                    return this.value;
                }).get().join(',');                
                if (!uuids) return;
                confirmDeletionDialog(uuids);
            });
            
            $('.inbox').on('click', '.multiple-read-btn', function () {
                var uuids = $('input.mail-checkbox:checked').map(function() {
                    return this.value;
                }).get().join(',');
                if (!uuids) return;
                    
                KRYPTOS.Messages.read(uuids, function(result) {
                    loadInbox($('.inbox-nav > li.inbox > a'), 'inbox');
                });          
            });
            
            $('.inbox').on('click', '.multiple-unread-btn', function () {
                var uuids = $('input.mail-checkbox:checked').map(function() {
                    return this.value;
                }).get().join(',');
                if (!uuids) return;

                    KRYPTOS.Messages.unread(uuids, function(result) {
                        loadInbox($('.inbox-nav > li.inbox > a'), 'inbox', null, null, true);
                    });             
            });

            // handle view message
            $('.inbox-content').on('click', 'tr.view-mail td.view-message', function () {
                var messageId = $(this).parent('tr.view-mail').attr('data-messageid');
                var recipientType = $(this).parent('tr.view-mail').attr('data-recipient-type');
                var from = $(this).parent('tr.view-mail').attr('data-from');
                
                var to = $(this).parent('tr.view-mail').attr('data-to');
                var cc = $(this).parent('tr.view-mail').attr('data-cc');
                if (to) {
                    to = JSON.parse(to);
                }
                if (cc) {
                    cc = JSON.parse(cc);
                }
                
                var isUnread = $(this).parent('tr.view-mail').attr('data-read') === 'false';
                var type = $(this).parent('tr.view-mail').attr('data-type');
                
                if (recipientType === 'draft') {
                    loadCompose($(this), messageId, 'Compose', from, to, cc);
                }
                else {
                    loadMessage($(this), messageId, from, to, cc, type, isUnread, recipientType);
                }
            });
            
            $('.inbox-nav > li.password > a').on('click', function () {
                loadPage($(this), 'password', 'Change Password', 'settings');
            });
            
            $('a.settings-menu-item, .inbox-nav > li.settings > a').on('click', function () {
                loadPage($(this), 'settings', 'General Settings', 'settings');
            });
            
            $('.inbox-nav > li.two-factor > a').on('click', function () {
                loadPage($(this), 'two-factor', 'Two-Factor Authentication', 'settings');
            });
            
            $('.inbox-nav > li.contacts-settings > a').on('click', function () {
                loadPage($(this), 'contacts-settings', 'Contacts Settings', 'settings');
            });
            
            $('.inbox-nav > li.notifications > a').on('click', function () {
                loadPage($(this), 'notifications', 'Notifications Settings', 'settings');
            });

            $('.inbox-nav > li.signature > a').on('click', function () {
                loadUserSettings();
                loadPage($(this), 'signature', 'Email Signature', 'settings', function() {
                    initEditor();

                    // Decrypt Signature

                    var messageObj = JSON.parse(userSettings['settings.mail.signatures']);
                    if (userSettings['settings.mail.signatures'] != null) {

                        KRYPTOS.getPrivateDecryptionKey( function (success, pdk) {
                            if (!success) {
                                console.log('pdk problem!');
                                return;
                            }
                            messageObj.key = KRYPTOS.utils.b642ab(messageObj.k);
                            messageObj.iv = KRYPTOS.utils.b642ab(messageObj.iv);
                            messageObj.message = KRYPTOS.utils.b642ab(messageObj.m);
                            messageObj.signature = KRYPTOS.utils.b642ab(messageObj.s);

                            //var pvk = KRYPTOS.Keys.getPublicKey(from, 'verify');
                            KRYPTOS.Keys.getPublicKey(username, 'verify', function(pvk) {
                                new KRYPTOS.Decrypter(messageObj.key, messageObj.iv, messageObj.message, messageObj.signature, pvk, pdk, function(plainText) {
                                    //               (encryptedKey  , iv           , cipherText        , signature           , theirPublicKey, privateKey, callback)

                                    if (plainText) {
                                        focusEditor(decodeURIComponent(plainText.text));
                                    }

                                }).decrypt();
                            });

                        });
                    }
                    //if (dSign != null) focusEditor(dSign);
                });
            });


            $('.inbox-nav > li.auto-destruction > a').on('click', function () {
                loadPage($(this), 'auto-destruction', 'Auto Destruction Settings', 'settings');
            });
            
            //$('.inbox-nav > li.signature > a').on('click', function () {
            //    loadPage($(this), 'signature', 'Signature', 'settings', function() {
            //        initEditor();
            //    });
            //});
            
            $('a.contacts-menu-item').on('click', function () {
                loadContacts();
                $('.inbox-nav > li.active').removeClass('active');
                $('a.compose').parent('li').addClass('active');
            });
            
            $('a.invite-menu-item').on('click', function () {
                loadPage($(this), 'invite', 'Invite', 'invite', function() {
                    jQuery.validator.addMethod("multiple_emails", function(value, element) {
                        if (this.optional(element)) {
                            return true;
                        }

                        var mails = value.split(/,|;/);
                        for(var i = 0; i < mails.length; i++) {
                            // taken from the jquery validation internals
                            if (!/^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(mails[i])) {
                                return false;
                            }
                        }

                        return true;
                    }, "Please specify a email address or a comma separated list of addresses");
                    
                    $(".inbox #invite-friends").validate({
                        rules: {
                            emails: {multiple_emails: true}
                        },
                        submitHandler: function(form) {
                            
                            invite($(form));
                            return false;
                        }
                    });
               });
            });

            // handle inbox listing
            $('.inbox-nav > li.inbox > a').click(function () {
                loadInbox($(this), 'inbox');
            });
            
            // handle sent listing
            $('.inbox-nav > li.sent > a').click(function () {
                loadInbox($(this), 'sent');
            });

            // handle draft listing
            $('.inbox-nav > li.drafts > a').click(function () {
                loadInbox($(this), 'drafts');
            });

            // handle starred listing
            $('.inbox-nav > li.starred > a').click(function () {
                loadInbox($(this), 'starred');
            });

            // handle business listing
            $('.inbox-nav > li.business > a').click(function () {
                loadInbox($(this), 'business');
            });

            // handle trash listing
            $('.inbox-nav > li.trash > a').click(function () {
                loadInbox($(this), 'trash');
            });

            //handle compose/reply cc input toggle
            $('.inbox-content').on('click', '.mail-to .inbox-cc', function () {
                handleCCInput();
            });

            //handle compose/reply bcc input toggle
            $('.inbox-content').on('click', '.mail-to .inbox-bcc', function () {
                handleBCCInput();
            });
            
            $('.inbox').on('click', '.inbox-view a', function(e) {
                e.preventDefault();
                KRYPTOS.utils.safeOpen($(this));
            });
            
            $('body').on('click', '.chat-message-content a', function(e) {
                e.preventDefault();                
                KRYPTOS.utils.safeOpen($(this));
            });
            
            loadSound();
            
            //handle loading content based on URL parameter
            if (Metronic.getURLParameter("a") === "view") {
                loadMessage();
            } else if (Metronic.getURLParameter("a") === "compose") {
                loadCompose();
            } else {
                $('.inbox-nav > li.inbox > a').click();
            }
            
            $('.inbox-content').on('click', 'button.save-draft', function (e) {
                e.preventDefault();
                saveDraft();                
            });

            $('.inbox-content').on('click', 'button.send', function (e) {
                e.preventDefault();                
                sendMail(); 
                
            });
            setInterval(mailCheck, 30000);
            
            $(window).focus(function() {
                KRYPTOS.Chat.reset();
                if (chatTimer !== null) {
                    clearInterval(chatTimer);
                }
                $('title').text(originalTitle);
            });
            
            $(window).blur(function() {
                KRYPTOS.Chat.count();
                chatTimer = setInterval(titleBlinkEffect, 1500);
            });
            
            notification.request();
        }
        
    };

}();

function promptPassword(callback, force) {
    // Get Session Variable
    $.getJSON('/sessions/just-registered', function(data) {
        if (data[1]) {
            callback(null);
        } else {
            $('button#verify-password').off('click');
            $('#confirm-password input#password').off('keydown');

            $('#confirm-password').modal({
                keyboard: force === true,
                show: true,
                backdrop: 'static'
            });

            $('#confirm-password').on('shown.bs.modal', function (e) {
                $('#confirm-password input#password').focus();
            });

            $('#confirm-password input#password').val('');

            $('button#verify-password').on('click', function() {
                var username = $('#confirm-password input#username').val();
                var password = $('#confirm-password input#password').val();
                var $button = $('button#verify-password');
                if (username === '' || password === '') {
                    return false;
                }
                $button.text('Verifying password, please wait...');
                $button.prop('disabled', true);
                KRYPTOS.init(username, password, 'ghostmail.com', function(username, accountPassword, mailPassword) {
                    $button.text('Verify Password');
                    $button.prop('disabled', false);
                    $('#confirm-password').modal('hide');
                    callback(accountPassword);
                });
            });

             //Press Enter on Confirm Password Dialog
            $('#confirm-password input#password').on('keydown', function(event){
                if ( event.which == 13 ) {
                    $('button#verify-password').click();
                }
            });

            // verify password
            //var verifypassword = function() {
            //    var username = $('#confirm-password input#username').val();
            //    var password = $('#confirm-password input#password').val();
            //    var $button = $('button#verify-password');
            //    if (username === '' || password === '') {
            //        return false;
            //    }
            //    $button.text('Verifying password, please wait...');
            //    $button.prop('disabled', true);
            //    KRYPTOS.init(username, password, 'ghostmail.com', function(username, accountPassword, mailPassword) {
            //        $button.text('Verify Password');
            //        $button.prop('disabled', false);
            //        $('#confirm-password').modal('hide');
            //        callback(accountPassword);
            //    });
            //};

            //$('button#verify-password').on('click', function () {
            //    verifypassword();
            //});

        }
    });
}

document.addEventListener("DOMContentLoaded", function () { 
    "use strict";
    window.opener = null;
    $('button#verify-password').prop('disabled', false);
    $('button#confirm-delete').prop('disabled', false);
    Metronic.init();
    Layout.init();
    $('.overlay').show();

    if (KRYPTOS.session.getItem('iak') && KRYPTOS.session.getItem('_token')) {
        KRYPTOS.Keys.getPrivateKeys(function(result) {
            KRYPTOS.Keys.getContactsPublicKeys(function() {
                Inbox.init();

                if (KRYPTOS.session.getItem('has_storage') === 'false') {
                    KRYPTOS.Storage.init(Inbox.getUsername());
                    KRYPTOS.Storage.setup();
                }
                try {
                    if (Inbox.isChatEnabled()) {
                        KRYPTOS.Chat.init(Inbox.getUsername(), Inbox.getNotifier());
                    }
                }
                catch(exception) {
                    console.log(exception);
                }
            });            
        });
    }
    else {
        window.location.replace("/login?f=1");
    }
});
