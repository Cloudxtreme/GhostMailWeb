jQuery.fn.getCursorPosition = function() {
    if(this.length === 0) return -1;
    return $(this).getSelectionStart();
};

jQuery.fn.setCursorPosition = function(position){
    if(this.length === 0) return this;
    return $(this).setSelection(position, position);
};

jQuery.fn.getSelection = function() {
    if(this.length === 0) return this;
    var s = $(this).getSelectionStart();
    var e = $(this).getSelectionEnd();
    return this[0].value.substring(s,e);
};

jQuery.fn.getSelectionStart = function() {
    if(this.length === 0) return this;
    var input = this[0];
 
    var pos = input.value.length;
 
    if (input.createTextRange) {
        var r = document.selection.createRange().duplicate();
        r.moveEnd('character', input.value.length);
        if (r.text === '') 
        pos = input.value.length;
        pos = input.value.lastIndexOf(r.text);
    } else if(typeof(input.selectionStart)!== "undefined")
    pos = input.selectionStart;
 
    return pos;
};

jQuery.fn.getSelectionEnd = function() {
    if(this.length === 0) return this;
    var input = this[0];
 
    var pos = input.value.length;
 
    if (input.createTextRange) {
        var r = document.selection.createRange().duplicate();
        r.moveStart('character', -input.value.length);
        if (r.text === '') 
        pos = input.value.length;
        pos = input.value.lastIndexOf(r.text);
    } else if(typeof(input.selectionEnd)!== "undefined")
    pos = input.selectionEnd;
 
    return pos;
};

jQuery.fn.setSelection = function(selectionStart, selectionEnd) {
    if(this.length === 0) return this;
    console.log(this);
    var input = this[0];
 
    if (input.createTextRange) {
        console.log('createTextRange');
        var range = input.createTextRange();
        range.collapse(true);
        range.moveEnd('character', selectionEnd);
        range.moveStart('character', selectionStart);
        range.select();
    } else if (input.setSelectionRange) {
        console.log('setSelectionRange');
        //input.focus();
        input.setSelectionRange(selectionStart, selectionEnd);
        input.focus();
    }
    else {
        console.log('setSelection not supported');
    }
 
    return this;
};