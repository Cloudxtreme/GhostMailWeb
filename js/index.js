$(document).ready(function () {

    initComplexify();

    $('.js-feature').mouseover(function () {
        $(this).find('.feature-info').show();
        $(this).css("background-color", '#3c4d64');
        $(this).find('.icon').hide();
    }).mouseout(function () {
        $(this).find('.feature-info').hide();
        $(this).css("background-color", '');
        $(this).find('.icon').show();
    });
    
    $('.tooltipz').click(function(e){
        e.preventDefault();
    });

});
