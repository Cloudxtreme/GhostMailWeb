/* global KRYPTOS, showWarningMessage, Inbox */

function resetToken() {
    $.ajaxSetup({
        headers: {
           'X-CSRF-Token': getToken()
        },
        statusCode: {
            401: function() {
                logout(true, false);
            },
            500: function() {}
        }
    });
}

function getToken() {
    return window.sessionStorage.getItem('_token') ? window.sessionStorage.getItem('_token') : $('meta[name=_token]').attr('content');
}

function appendToken(data) {
    return data + "&_token=" + getToken();
}

function setToken(token) {
    $('meta[name=_token]').attr('content', token);
}

resetToken();

document.addEventListener("onresettoken", function() {
    resetToken();
});

$("#register").validate({
    rules: {
        password_confirmation: {
            equalTo: "#password"
        }
    },
    submitHandler: function(form) {
        register(form);
        return false;
    }
});

$("#signin").validate({
    submitHandler: function(form) {
        login(form);
        return false;
    }
});

$("#recover").validate({
    submitHandler: function(form) {
        recover(form);
        return false;
    }
});

$("#contactus").validate({
    rules: {
        email_confirmation: {
            equalTo: "#email"
        }
    }
});

function register(form) {
    var $form = $(form), url = $form.attr('action');
    $form.find('span.ferror').text('');
    var password = $form.find('#password').val();
    var username = $form.find('#username').val().toLowerCase().replace(/@ghostmail.com/gi, '');
    username.toString();
    password.toString();

    if (username.match(password.replace(/([.*+?^${}()|\[\]\/\\])/g, "\\$1")) || password.match(username)) {
        $("#password").parent("a").siblings('.ferror').text("Please improve your password and don't include or partly include your username in it.").show('fast');
        return;
    }

    // Disallow form sending if pass input not valid (complex.js)
    if($form.find('#password').attr("data-valid") === 'false') {
        $("#password").parent("a").siblings('.ferror').text("Please make sure your password meets the \"Password must\" requirments.").show('fast');
        return;
    }

    $button = $form.find('button');
    $button.prop('disabled', true);
    $button.text('Creating account, please wait...');
    $form.find('span.ferror').text('');
    
    var data = {
        username: username
    };
    KRYPTOS.clear();
    resetToken();
    var posting = $.post(url + '/check', $.param(data, false));
    posting.done(function(response) {  
        $button.prop('disabled', true);
        KRYPTOS.setup(username, password, 'ghostmail.com', function(success, error) {
            if (success) {

                authenticate($form, $button, username, KRYPTOS.accountPassword, KRYPTOS.mailPassword, null);
            }
            else {

                $button.prop('disabled', false);
                $button.text('Free Sign Up');
                if (error.errors.hasOwnProperty('username')) {
                    $("#username").parent('a').siblings(".ferror").text(error.errors.username).show('fast');
                }
            }
        });
        
    }).fail(function( jqxhr ) {
        // enable button to able registration
        $button.prop('disabled', false);
        $button.text('Free Sign Up');
        var $er = $.parseJSON(jqxhr.responseText);
        if ($er.errors.hasOwnProperty('username')) {
            $("#username").parent('a').siblings(".ferror").text($er.errors.username[0]).show('fast');
        }
        if ($er.errors.hasOwnProperty('email')) {
            $("#email").siblings(".ferror").text($er.errors.email[0]).show('fast');
        }
    }); 
}



function recover(form, username, password, backupCode) {
    var $form = $(form), url = $form.attr('action');
    $form.find('span.ferror').text('');
    
    $form.find('button').prop('disabled', true);
    var data = {
        username: username,
        password: password,
        backup_code: backupCode
    };
    var posting = $.post(url, $.param(data, false));
    posting.done(function(response) {
        
        $('div.login-body').hide();
        $('div.recovered').show();
        
        
    }).fail(function( jqxhr ) {
        $form.find('button').prop('disabled', false);
        $form.find('button').text('Submit Backup Code');
        var $er = $.parseJSON(jqxhr.responseText);
        
        if ($er.error) {
            $("#backup_code").siblings(".ferror").text($er.error).show('fast');
        }
        else if ($er.errors.username) {
            $("#backup_code").siblings(".ferror").text($er.errors.username).show('fast');
        }
    }); 
}

function login(form) {
    var $form = $(form), url = $form.attr('action'), $button = $form.find('button');
    $button.prop('disabled', true);
    
    $form.find('span.ferror').text('');
    var username = $form.find('#username').val().toLowerCase().replace(/@ghostmail.com/gi, '');
    var password = $form.find('#password').val();
    var otp = $form.find('#tfa_code').val();
    var backupCode = $form.find('#backup_code').val();
    KRYPTOS.clear();
    KRYPTOS.init(username, password, 'ghostmail.com', function(username, accountPassword, mailPassword) {
        if (backupCode) {
            $form.find('button').text('Submitting, please wait...');
            recover(form, username, accountPassword, backupCode);
        }
        else {
            $button.text('Logging in, please wait...');
            authenticate($form, $button, username, accountPassword, mailPassword, otp);
        }

    });
}

function authenticate($form, $button, username, accountPassword, mailPassword, otp) {
    KRYPTOS.authenticate(username, accountPassword, otp, function(success, result) {
        
        if (!success) {
            if (otp) {
                $form.find('#tfa_code').val('');
                $("#tfa_code").siblings(".ferror").text(result).show('fast');
                $button.text('Authenticate');
            }
            else {
                $form.find('#password').val('');
                $("#username").siblings(".ferror").text(result).show('fast');
                $button.text('Login');
            }
            $button.prop('disabled', false);            
        }
        else {
            if (result.tfa === true) {
                $button.prop('disabled', false);
                showVerificationForm();
            }
            else {
                KRYPTOS.Keys.getIntermediateKey(result, mailPassword, accountPassword, function(success, error) {
                    if (success) {
                        $button.text('Loading GhostMail...');
                        window.location.replace("/mail");
                    }
                    else {
                        logout(false, true);
                    }
                    $form.find('#password').val('');
                });
            }
        }
    });
}

$('a.logout').on('click', function(e) {
    e.preventDefault();
    logout(false, true);
});

function logout(showWarning, fullLogout) {
    if (showWarning) {
        if (showWarningMessage) {
            showWarningMessage("Session Expired", "Your session has expired, you are being redirected to the login page...");
        }
    }
    try {
        if (Inbox.isChatEnabled()) {
            KRYPTOS.Chat.logout();
        }
    }
    catch(exception) {
        fullLogout = true;
    }
    KRYPTOS.clear();    
        
    if (fullLogout) {
        window.location.replace("/login");
        var logoutAction = $.post("/logout");
        logoutAction.done(function(response) {
            //console.log(response);
            window.location.replace("/login");
        }).fail(function( jqxhr ) {
            //console.log('error logging out');
        }); 
    }
    else {
        window.location.replace("/login");
    }
}

function initChangePassword() {
    $("#change-password").validate({
        rules: {
            password_confirmation: {
                equalTo: "#password"
            }
        },
        submitHandler: function(form) {
            changePassword(form);
            return false;
        }
    });
}

function changePassword(form) {
    var $form = $(form);
    
    var username = $form.find('#username').val();
    var oldPassword = $form.find('#old_password').val();
    var newPassword = $form.find('#password').val();
    
    if (username.indexOf(newPassword) !== -1 || newPassword.indexOf(username) !== -1) {
        showErrorMessage("Error", "Please improve your password and don't include or partly include your username in it.");
        return;
    } 
    
    if(oldPassword === newPassword){
        showErrorMessage("Error", "Please don't reuse your old password as a new password. Pick a new one.");
        return;
    }
    
    $form.find('button').prop('disabled', true);
    $form.find('button').text('Changing password, please wait...');
    $form.find('span.ferror').text('');
    
    KRYPTOS.changePassword(username, oldPassword, newPassword, 'ghostmail.com', function(success, error) {
        if (success) {
            
            showSuccessMessage("Password Changed", "Your password was changed successfully! For security reasons you are being logged out now!");
        }
        else {
            
            
            showErrorMessage("Error", "Your password has NOT been changed! For security reasons you are being logged out now!");
        }
        logout(false);
    });
}

function initComplexify() {
    $("#password").complexify({minimumChars:8}, function(valid, complexity) {
        if (!valid) {
            $('.progressbar').css({'width':complexity + '%', 'background':'#cc0000'});
        } else {
            $('.progressbar').css({'width':complexity + '%', 'background':'#78c582'});
        }
    });
}

function showBackupCodeForm() {
    $form = $('#signin');
    $button = $form.find('button');
    $('.tfa_input').hide();
    $('.tfa_input input').val('');
    $('.login_input').hide();
    $('.bc_input').show();
    $form.find('#backup_code').focus();
    $button.text('Submit Backup Code');
}

function showVerificationForm() {
    $form = $('#signin');
    $button = $form.find('button');
    $('.bc_input').hide();
    $('.bc_input input').val('');
    $('.login_input').hide();
    $('.tfa_input').show();
    $form.find('#tfa_code').focus();
    $button.text('Authenticate');
}

$(document).ready(function () {
    // focus on first input field
    var elle = $("input:text").get(0);
    if(typeof elle !== 'undefined') {        
        var elemLen = elle.value.length;
        elle.selectionStart = elemLen;
        elle.selectionEnd = elemLen;
        elle.focus();
    }
    
    $('a#go-recover').click(function(e) {
        e.preventDefault();
        showBackupCodeForm();
    });
     $('a#go-verify').click(function(e) {
        e.preventDefault();
        showVerificationForm();
    });
});
