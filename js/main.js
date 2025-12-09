(() => {
  const ctx = document.getElementById(chart_name);
  const slider = document.getElementById("x-value-slider");
  const xValueDisplay = document.getElementById("x-value-display");
  const yValueDisplay = document.getElementById("y-value-display");
  const areaUnderCurveDisplay = document.getElementById(
    "area-under-curve-display"
  );
  // prettier-ignore
  const CURRENCY_SYMBOLS = ["$", "¢", "€", "£", "¥", "₹", "₩", "₽", "₺", "₪", "₫", "฿", "₴", "₦", "₱"];
  // prettier-ignore
  const QUANTITY_WORDS = ["units", "items", "widgets", "things", "count"];
  const TE_ID = document.currentScript.getAttribute("data-te-ids");

  var activePoint = null;
  var myChart; // Intentionally "global" within this code.

  let value_inputs = document.querySelectorAll(".y-values input");
  let validated = validateInitialValues();
  if (!validated) {
    alert(
      "Initial y values do not match your restrictions. See console for details."
    );
    return;
  }

  ///////////////// Script Loading //////////////////
  // Load the other scripts from the "media" section of all places,
  // because then we can ensure they load in order.
  // This gets skipped if we're testing things outside the LXP.
  ///////////////////////////////////////////////////
  if (
    window.location.href.includes("lxp.huit.harvard.edu") ||
    window.location.href.includes("harvardonline.harvard.edu")
  ) {
    let media_object = window.lxp.te[TE_ID].media;
    let media_names = Object.keys(media_object);
    let reverse_lookup = {};
    media_names.forEach((name) => {
      reverse_lookup[media_object[name].filename] = name;
    });
    let scripts = [];
    // Script load order is defined in the javascript section of the TE.
    script_load_order.forEach((name) => {
      if (name in reverse_lookup) {
        scripts.push(media_object[reverse_lookup[name]].publicUrl);
      } else {
        console.error(`Error: Script ${name} not found in media object.`);
      }
    });
    scripts.forEach((script) => {
      let scriptTag = document.createElement("script");
      scriptTag.src = script;
      // Make sure they load in order.
      scriptTag.async = false;
      document.head.appendChild(scriptTag);
    });
  }

  //////////// Initial Setup ////////////

  // Set initial values from the chart_config variable.
  value_inputs.forEach((el, index) => {
    el.value = chart_config[chart_name].y.values[index];
    el.setAttribute(
      "aria-label",
      `y value at x=${chart_config[chart_name].x.values[index]}`
    );
  });

  // Wait for the Chart.js and chart annotation libraries to load
  if (
    window.location.href.includes("lxp.huit.harvard.edu") ||
    window.location.href.includes("harvardonline.harvard.edu")
  ) {
    let waiter = setInterval(function () {
      if (typeof Chart !== "undefined") {
        clearInterval(waiter);
        let annotation_waiter = setInterval(function () {
          try {
            if (Chart.registry.plugins.items.annotation !== undefined) {
              if (chart_name !== "undefined") {
                if (typeof Chart !== "undefined") {
                  clearInterval(annotation_waiter);
                  initializeChart();
                }
              }
            }
          } catch (e) {
            console.log("Waiting for Chart annotation plugin to load...");
            return;
          }
        }, 100);
      }
    }, 100);
  }
  else {
    initializeChart();
  }

  function initializeChart() {
    myChart = makeChart(ctx, chart_config[chart_name]);
    // set pointer event handlers for canvas element
    ctx.onpointerdown = down_handler;
    ctx.onpointerup = up_handler;
    ctx.onpointermove = null;

    // Adjust the slider max value based on the chart x values
    slider.min = Math.min(...chart_config[chart_name].x.values);
    slider.max = Math.max(...chart_config[chart_name].x.values);
    slider.value = (slider.min + slider.max) / 2;
    slider.step = chart_config[chart_name].x.precision || 0.1;

    setEventListeners();
    annotateWithVertical(
      Chart.getChart(ctx),
      Number(slider.value),
      interpolateValues(Chart.getChart(ctx), Number(slider.value))
    );
  }

  ////////// Validate initial y values ////////
  function validateInitialValues() {
    temp = Array.from(chart_config[chart_name].y.values);
    temp.sort(function (a, b) {
      return a - b;
    });
    if (
      JSON.stringify(temp) !==
        JSON.stringify(chart_config[chart_name].y.values) &&
      chart_config[chart_name].restrictions.monotonic_increasing
    ) {
      console.error(
        "Error: y.values must be in increasing order if you want monotonic increasing."
      );
      return false;
    }
    temp = Array.from(chart_config[chart_name].y.values);
    temp.sort(function (a, b) {
      return b - a;
    });
    if (
      JSON.stringify(temp) !==
        JSON.stringify(chart_config[chart_name].y.values) &&
      chart_config[chart_name].restrictions.monotonic_decreasing
    ) {
      console.error(
        "Error: y.values must be in decreasing order if you want monotonic decreasing."
      );
      return false;
    }
    return true;
  }

  /////////////// Event Listeners ///////////////
  function setEventListeners() {
    // Update chart when y value inputs change
    value_inputs.forEach((el, index) => {
      el.addEventListener("input", function () {
        const chart = Chart.getChart(ctx);
        chart.data.datasets[0].data[index] = Number(this.value) || 0;
        chart.update();
        annotateWithVertical(
          chart,
          Number(slider.value),
          interpolateValues(chart, Number(slider.value))
        );
      });
    });

    // Update the displayed x and y values based on the slider position
    slider.addEventListener("input", function () {
      const xValue = Number(this.value);

      const chart = Chart.getChart(ctx);
      const dataset = chart.data.datasets[0].data;
      const labels = chart.data.labels;

      let yValue = interpolateValues(chart, xValue) || 0;

      annotateWithVertical(chart, xValue, yValue);
    });
  }

  /////////////// Functions ///////////////

  function makeChart(ctx, chart_config) {
    console.log(chart_config);
    return new Chart(ctx, {
      type: "line",
      data: {
        labels: chart_config.x.values,
        datasets: [
          {
            label: chart_config.y.label,
            data: chart_config.y.values,
            borderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
          },
        ],
      },
      options: {
        animations: false,
        cubicInterpolationMode: "default",
        aspectRatio: ctx.clientWidth / (0.3 * window.innerHeight),
        responsive: true,
        plugins: {
          legend: {
            display: false,
          },
          title: {
            display: true,
            text: chart_config.title,
            font: {
              size: 18,
            },
          },
          annotation: {
            annotations: {},
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: chart_config.y.label,
              font: { size: 14, weight: "bold" },
            },
          },
          x: {
            beginAtZero: true,
            title: {
              display: true,
              text: chart_config.x.label,
              font: { size: 14, weight: "bold" },
            },
          },
        },
      },
    });
  }

  // Linear interpolation to find the corresponding y value
  function interpolateValues(chart, xValue) {
    console.log(`Interpolating for x=${xValue}`);
    const dataset = chart.data.datasets[0].data;
    console.log(chart.data.datasets[0].data);
    const labels = chart.data.labels;
    console.log(chart.data.labels);
    let yValue = null;
    for (let i = 0; i < dataset.length - 1; i++) {
      console.log(labels[i], labels[i + 1]);
      if (xValue >= labels[i] && xValue <= labels[i + 1]) {
        const x0 = labels[i];
        const x1 = labels[i + 1];
        const y0 = dataset[i];
        const y1 = dataset[i + 1];
        console.log(`Using points (${x0}, ${y0}) and (${x1}, ${y1}) for interpolation.`);
        // Linear interpolation formula
        yValue = y0 + ((y1 - y0) * (xValue - x0)) / (x1 - x0);
        break;
      }
    }
    console.log(`Interpolated y=${yValue}`);
    return yValue;
  }

  // Adds a vertical line to the plot at the specified xValue.
  // TODO: switch this to a shaded box instead of lines.
  function annotateWithVertical(chart, xValue, yValue) {
    console.log(`Annotating with x=${xValue}, y=${yValue}`);
    chart.options.plugins.annotation = {
      annotations: {
        box1: {
          type: "box",
          xMin: 0,
          xMax: xValue / 10,
          yMin: 0,
          yMax: yValue,
          backgroundColor: "rgba(255, 0, 0, 0.3)",
          borderColor: "rgba(255, 0, 0, 0.7)",
          borderWidth: 2,
        },
      },
    };
    chart.update();
    updateDisplays(xValue, yValue);
  }

  // Update the displayed x and y values
  function updateDisplays(xValue, yValue) {
    let x_precision = 2;
    let y_precision = 2;
    if (typeof chart_config[chart_name].x.precision === "number") {
      x_precision = -Math.log10(chart_config[chart_name].x.precision);
    }
    if (typeof chart_config[chart_name].y.precision === "number") {
      y_precision = -Math.log10(chart_config[chart_name].y.precision);
    }
    if (chart_config[chart_name].total.precision) {
      total_precision = -Math.log10(chart_config[chart_name].total.precision);
    } else {
      total_precision = Math.max(x_precision, y_precision);
    }
    let area_of_rectangle =
      (Math.round(xValue * 10 ** x_precision) / 10 ** x_precision) *
      (Math.round(yValue * 10 ** y_precision) / 10 ** y_precision);

    let x_text = `X Value: ${xValue.toFixed(x_precision)}`;
    if (chart_config[chart_name].x.units) {
      if (CURRENCY_SYMBOLS.includes(chart_config[chart_name].x.units.trim())) {
        // Currency symbols go before the number.
        x_text = `X Value: ${chart_config[chart_name].x.units}${xValue.toFixed(
          x_precision
        )}`;
      } else {
        x_text += ` ${chart_config[chart_name].x.units}`;
      }
      x_text = `Y Value: ${yValue.toFixed(y_precision)}`;
    }
    xValueDisplay.textContent = x_text;

    let y_text = `Y Value: ${yValue.toFixed(y_precision)}`;
    if (chart_config[chart_name].y.units) {
      if (chart_config[chart_name].y.units) {
        if (
          CURRENCY_SYMBOLS.includes(chart_config[chart_name].y.units.trim())
        ) {
          // Currency symbols go before the number.
          y_text = `Y Value: ${
            chart_config[chart_name].y.units
          }${yValue.toFixed(y_precision)}`;
        } else {
          y_text += ` ${chart_config[chart_name].y.units}`;
        }
      }
    }
    yValueDisplay.textContent = y_text;

    // Only show currency symbol if there are no x units.
    if (chart_config[chart_name].y.units) {
      if (
        CURRENCY_SYMBOLS.includes(chart_config[chart_name].y.units.trim()) &&
        (!chart_config[chart_name].x.units ||
          QUANTITY_WORDS.includes(
            chart_config[chart_name].x.units.trim().toLowerCase()
          ))
      ) {
        // Currency symbols go before the number.
        areaUnderCurveDisplay.textContent = `Area Of Rectangle: ${
          chart_config[chart_name].y.units
        }${area_of_rectangle.toFixed(total_precision)}`;
      } else {
        areaUnderCurveDisplay.textContent = `Area Of Rectangle: ${area_of_rectangle.toFixed(
          precision
        )} ${chart_config[chart_name].y.units}`;
      }
    }
    // console.log(`X Value: ${xValue.toFixed(precision)}, Y Value: ${yValue.toFixed(precision)}`);
  }

  // Handlers taken from https://stackoverflow.com/a/59110888/1330737
  // Thanks to user MartinCR https://stackoverflow.com/users/5058026/martin-cr

  function down_handler(event) {
    document.getElementById(chart_name).getContext("2d");
    const canvas = document.getElementById(chart_name);
    // check for data point near event location
    const points = myChart.getElementsAtEventForMode(
      event,
      "nearest",
      { intersect: true },
      false
    );
    if (points.length > 0) {
      // grab nearest point, start dragging
      activePoint = points[0];
      canvas.onpointermove = move_handler;
    }
  }

  function up_handler(event) {
    const canvas = document.getElementById(chart_name);
    // release grabbed point, stop dragging
    activePoint = null;
    canvas.onpointermove = null;
  }

  function move_handler(event) {
    const canvas = document.getElementById(chart_name);
    // locate grabbed point in chart data
    if (activePoint != null) {
      let data = myChart.data;
      let datasetIndex = activePoint.datasetIndex;

      // read mouse position
      const helpers = Chart.helpers;
      let position = helpers.getRelativePosition(event, myChart);

      // convert mouse position to chart y axis value
      let chartArea = myChart.chartArea;
      let yAxis = myChart.scales["y"];
      let yValue = map(
        position.y,
        chartArea.bottom,
        chartArea.top,
        yAxis.min,
        yAxis.max
      );
      yValue = enforceRestrictions(
        yValue,
        data.datasets[datasetIndex].data,
        chart_config[chart_name].restrictions
      );

      // update y value of active data point
      data.datasets[datasetIndex].data[activePoint.index] = yValue;
      myChart.update();
      // Update the annotation
      annotateWithVertical(
        myChart,
        Number(slider.value),
        interpolateValues(myChart, Number(slider.value))
      );
      // Update the corresponding input field
      value_inputs[activePoint.index].value = yValue.toFixed(2);
    }
  }

  function enforceRestrictions(value, data, restrictions) {
    // Don't drag below 0
    if (restrictions.no_negative_values) {
      if (value < 0) {
        value = 0;
      }
    }
    if (restrictions.monotonic_decreasing) {
      // Don't drag above previous point
      if (activePoint.index > 0) {
        let previousYValue = data[activePoint.index - 1];
        if (value > previousYValue) {
          value = previousYValue;
        }
      }
      //Don't drag below next point
      if (activePoint.index < data.length - 1) {
        let nextYValue = data[activePoint.index + 1];
        if (value < nextYValue) {
          value = nextYValue;
        }
      }
    } else if (restrictions.monotonic_increasing) {
      // Don't drag below previous point
      if (activePoint.index > 0) {
        let previousYValue = data[activePoint.index - 1];
        if (value < previousYValue) {
          value = previousYValue;
        }
      }
      //Don't drag above next point
      if (activePoint.index < data.length - 1) {
        let nextYValue = data[activePoint.index + 1];
        if (value > nextYValue) {
          value = nextYValue;
        }
      }
    }
    return value;
  }

  // map value to other coordinate system
  function map(value, start1, stop1, start2, stop2) {
    return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));
  }
})();
