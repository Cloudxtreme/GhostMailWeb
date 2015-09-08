// focus on first input field
var elle = $("input:text").get(0);
var elemLen = elle.value.length;
elle.selectionStart = elemLen;
elle.selectionEnd = elemLen;
elle.focus();

