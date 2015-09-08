
var ComponentsjQueryUISliders = function () {

    return {
        //main function to initiate the module
        init: function (value) {


            // range min
            $("#slider-range-min").slider({
                isRTL: Metronic.isRTL(),
                range: "min",
                value: value ? value : 24,
                min: 1,
                max: 168,
                slide: function (event, ui) {
                    var days = Math.floor(ui.value / 24);
                    var hours = ui.value % 24;
                    $("#slider-range-hours-amount").text(hours);
                    $("#slider-range-days-amount").text(days);
                    $("#autodestruct").val(ui.value);
                }
            });
            //$("#slider-range-hours-amount").text($("#slider-range-min").slider("value"));
            $("#slider-range-days-amount").text(1);
            if (value) {
                var days = Math.floor(value / 24);
                    var hours = value % 24;
                    $("#slider-range-hours-amount").text(hours);
                    $("#slider-range-days-amount").text(days);
                    $("#autodestruct").val(value);
            }
        }

    };

}();