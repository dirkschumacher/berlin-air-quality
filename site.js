var checkForAlerts = function(domContainer, value, thresholdHigh, thresholdMidlevel) {
    domContainer.removeClass("alert-over-threshold");
    domContainer.removeClass("alert-midlevel");
    if (+value > thresholdHigh) {
        domContainer.addClass("alert-over-threshold");
    } else if (+value > thresholdMidlevel) {
        domContainer.addClass("alert-midlevel");
    }
};
var baseApiUrl = "https://e7kxav3rg1.execute-api.eu-central-1.amazonaws.com/production/api";
var firstTimeLoad = true;
var updateNumbers = function() {
    $.get(baseApiUrl + "/v1/current", function(data) {
        $("#last-updated").text((new Date(Date.parse(data.measurement_datetime))).toString());
        $("#value-temp").text(data.temp);
        $("#value-wind").text(data.wind_speed);
        $("#value-wind-direction").text(data.wind_direction);
        $("#value-pm10-high-city").text(data.high_pm10_value_city);
        $("#value-pm10-high-traffic").text(data.high_pm10_value_street);
        $("#value-pm10-high-city-location").text(data.high_pm10_location_city);
        $("#value-pm10-high-traffic-location").text(data.high_pm10_location_street);

        // thresholds from umweltbundesamt
        checkForAlerts($("#pm10-traffic-container"), data.high_pm10_value_street, 50, 30);
        checkForAlerts($("#pm10-city-container"), data.high_pm10_value_city, 50, 30);

        $("#value-no2-high-city").text(data.high_no2_value_city);
        $("#value-no2-high-traffic").text(data.high_no2_value_street);
        $("#value-no2-high-city-location").text(data.high_no2_location_city);
        $("#value-no2-high-traffic-location").text(data.high_no2_location_street);

        // thresholds from umweltbundesamt
        checkForAlerts($("#no2-traffic-container"), data.high_no2_value_street, 200, 120);
        checkForAlerts($("#no2-city-container"), data.high_no2_value_city, 200, 120);

        $("#value-ozone-city-low").text(data.low_ozon03_value_city);
        $("#value-ozone-city-high").text(data.high_ozon03_value_city);
        $("#value-ozone-city-low-location").text(data.low_ozon03_location_city);
        $("#value-ozone-city-high-location").text(data.high_ozon03_location_city);
        $("#value-ozone-suburb-low").text(data.low_ozon03_value_suburb);
        $("#value-ozone-suburb-high").text(data.high_ozon03_value_suburb);
        $("#value-ozone-suburb-low-location").text(data.low_ozon03_location_suburb);
        $("#value-ozone-suburb-high-location").text(data.high_ozon03_location_suburb);

        // ozone threshold from umweltbundesamt
        checkForAlerts($("#ozone-city-icon"),
            Math.max(data.low_ozon03_value_city, data.high_ozon03_value_city),
            180, 108);
        checkForAlerts($("#value-ozone-city-low"), data.high_ozon03_value_city, 180, 108);
        checkForAlerts($("#value-ozone-city-high"), data.high_ozon03_value_city, 180, 108);
        checkForAlerts($("#ozone-suburb-icon"),
            Math.max(data.low_ozon03_value_suburb, data.high_ozon03_value_suburb),
            180, 108);
        checkForAlerts($("#value-ozone-suburb-low"), data.high_ozon03_value_suburb, 180, 108);
        checkForAlerts($("#value-ozone-suburb-high"), data.high_ozon03_value_suburb, 180, 108);
        if (firstTimeLoad) {
            $("#loading-indicator").hide();
            $("#main-content-container").show();
            firstTimeLoad = false;
        }
        window.setTimeout(updateNumbers, 1000 * 60 * 60);
    });
};

// manages the toggling of chart containers
var makeOnToggleChartCallback = function(container, callback) {
    return function() {
        if (!container.is(":visible")) {
            container.find(".chart").empty();
            return;
        }
        container.find(".loading-indicator").show();
        callback();
    };
};

// creates an NVD3 time series from a given mappable thing
var createNVD3Series = function(data, keyName, xPropertyName, yPropertyName) {
    return {
        values: data.map(function(d) {
            return {
                x: Date.parse(d[xPropertyName]),
                y: +d[yPropertyName]
            };
        }),
        key: keyName
    };
};

var prepareCharts = function() {
    var getLast48Hours,
        renderTimeseries;

    // register event handlers
    // handle pm10 clicks
    var registerTSEventHander = function(code, tickValues) {
        $("#expand-" + code + "-time-series").click(function() {
            var container = $("#" + code + "-time-series-container");
            container.toggle(makeOnToggleChartCallback(container, function() {
                getLast48Hours()
                    .done(renderTimeseries(container, code, tickValues));
            }));
        });
    };
    registerTSEventHander("pm10", [30, 50]);
    registerTSEventHander("no2", [120, 200]);

    // gets the data
    // returns promise
    getLast48Hours = function() {
        return $.get(baseApiUrl + "/v1/last-48-hours");
    };

    renderTimeseries = function(container, code, tickValues) {
        return function(data) {
            nv.addGraph(function() {
                var chart = nv.models.lineChart()
                    .margin({
                        left: 100
                    })
                    //.useInteractiveGuideline(true)
                    .showLegend(true)
                    .showYAxis(true)
                    .showXAxis(true);

                chart.xAxis
                    .tickFormat(function(d) {
                        return d3.time.format("%d %B %H:%M")(new Date(d));
                    }).rotateLabels(-45)
                var xScale = d3.time.scale();
                xScale
                    .domain(data.map(function(d) {
                        return d.measurement_datetime;
                    }))
                    .ticks(d3.time.hour, 1);
                chart.xScale(xScale)

                chart.yAxis
                    .axisLabel(code.toUpperCase() + " in µg/m³");
                var chartData = [
                    createNVD3Series(data, "City stations", "measurement_datetime", "high_" + code + "_value_city"),
                    createNVD3Series(data, "Traffic stations", "measurement_datetime", "high_" + code + "_value_street")
                ];
                console.log(chartData);
                var maxValue = Math.max(
                    Math.max.apply(null, chartData[0].values.map(function(d) {
                        return +d.y
                    })),
                    Math.max.apply(null, chartData[1].values.map(function(d) {
                        return +d.y
                    }))
                );

                // set pollutant depend tickvalues
                chart.yAxis.tickValues(tickValues.filter(function(t) {
                    return t <= maxValue;
                }));
                chart.forceY([0, maxValue]);

                container.find(".loading-indicator").hide();
                d3.select(container.find(".chart").get(0))
                    .datum(chartData)
                    .call(chart);

                //Update the chart when window resizes.
                nv.utils.windowResize(chart.update);
                return chart;
            });
        };
    };
};
var prepareStats = function() {
    var getStats, renderTimeseries;
    $("#show-stats-icon").click(function() {
        var container = $("#stats-container");
        container.toggle(makeOnToggleChartCallback(container, function() {
            getStats().done(function(data) { renderTimeseries(container, data); });
        }));
    });

    // returns a promise for stats
    getStats = function() {
        return $.get(baseApiUrl + "/v1/visits");
    };

    renderTimeseries = function(container, data) {
        nv.addGraph(function() {
            var chart = nv.models.lineChart()
                .margin({
                    left: 100
                })
                //.useInteractiveGuideline(true)
                .showLegend(true)
                .showYAxis(true)
                .showXAxis(true);

            chart.xAxis
                .tickFormat(function(d) {
                    return d3.time.format("%Y-%m-%d")(new Date(d));
                }).rotateLabels(-45)
            var xScale = d3.time.scale();
            xScale
                .domain(data.map(function(d) {
                    return d.day;
                }))
                .ticks(d3.time.day, 1);
            chart.xScale(xScale);

            var chartData = [
                createNVD3Series(data, "Pageimpressions", "date", "page_impressions"),
                createNVD3Series(data, "Unique visits", "date", "unique_visits")
            ];
            container.find(".loading-indicator").hide();
            d3.select(container.find(".chart").get(0))
                .datum(chartData)
                .call(chart);

            //Update the chart when window resizes.
            nv.utils.windowResize(chart.update);
            return chart;
        });
    };
};
$(document).ready(function() {
    prepareCharts();
    prepareStats();
    updateNumbers();

    // this simply counts visitors; did not want to use google analytics et al.
    // does not store any PII
    $.get("https://murmuring-ridge-57765.herokuapp.com/api/v1/count-visitor");
});
