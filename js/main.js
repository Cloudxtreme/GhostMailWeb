$(document).ready(function () {
    
    var scroll_start = 0;
    var startchange = $('#scrolltrigger');
    var offset = startchange.offset();
     if (startchange.length){
        $(document).scroll(function() { 
           var size = window.getComputedStyle(document.body,':after').getPropertyValue('content');
           scroll_start = $(this).scrollTop();
           if(scroll_start > offset.top) {

                if( typeof businessPage !== 'undefined' && businessPage ) {
                    topBarColor = '#1b9ed6';
                } else {
                    topBarColor = '#3c4d64';
                }
                $(".navbar-fixed-top").css('background-color', topBarColor);
                
                $(".navbar-brand").css('top', '0.5em');
                if (size.indexOf("widescreen") !=-1) {
                    $("div.container div.navbar-header a.navbar-brand").css('background', 'url(img/gm-icon.png) no-repeat');
                }             
            } else {
                $('.navbar-fixed-top').css('background', 'transparent');
                $(".navbar-brand").css('top', '1em');
                if (size.indexOf("widescreen") !=-1) {
                    $("div.container div.navbar-header a.navbar-brand").css('background', 'none');
                } 
               
            }
        });
    }
    
    //extenal links should open in new window
    $(".container a[href^='http://']").attr("target","_blank");
    
    setTimeout(function() {
        $("#banner").slideDown(function()  {
           setTimeout(function() {             
             $("#banner").slideUp(); 
           }, 10000); //side up after 5 seconds
        });
    }, 500);
    $('#js-close-lang').on('click', function(){
        $("#banner").slideUp();
    });
    
});
