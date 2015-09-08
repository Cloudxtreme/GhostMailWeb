toastr.options = {
  "closeButton": true,
  "debug": false,
  "positionClass": "toast-top-right",
  "onclick": null,
  "showDuration": "4000",
  "hideDuration": "1000",
  "timeOut": "4000",
  "extendedTimeOut": "1000",
  "showEasing": "swing",
  "hideEasing": "linear",
  "showMethod": "fadeIn",
  "hideMethod": "fadeOut"
}
function showSuccessMessage(title, msg) {
    $('.overlay').hide();
    var $toast = toastr['success'](msg, title);
}
function showErrorMessage(title, msg) {
    $('.overlay').hide();
    var $toast = toastr['error'](msg, title);
}
function showInfoMessage(title, msg) {
    $('.overlay').hide();
    var $toast = toastr['info'](msg, title);
}
function showWarningMessage(title, msg) {
    $('.overlay').hide();
    var $toast = toastr['warning'](msg, title);
}


