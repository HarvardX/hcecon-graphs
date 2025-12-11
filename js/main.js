"use strict";
(async () => {
  // Global-ish variables
  let activePoint = null;
  // prettier-ignore
  const CURRENCY_SYMBOLS = ["$", "¢", "€", "£", "¥", "₹", "₩", "₽", "₺", "₪", "₫", "฿", "₴", "₦", "₱"];
  // prettier-ignore
  const QUANTITY_WORDS = ["units", "items", "widgets", "things", "count"];

  // Make sure the length of the chart_config object matches the
  // number of relevant charts. If not, wait until it does.
  let num_charts = document.querySelectorAll(".hx-chartjs").length;
  let count = 0;
  if (Object.keys(chart_config).length !== num_charts) {
    let waiter = setInterval(function () {
      num_charts = document.querySelectorAll(".hx-chartjs").length;
      if (Object.keys(chart_config).length === num_charts) {
        clearInterval(waiter);
        main();
      }
      count += 1;
      if (count > 100) {
        // You get 10 seconds to load the charts.
        console.error("Error: Chart configuration did not load in time.");
        clearInterval(waiter);
        return;
      }
    }, 100);
  } else {
    main();
  }

  async function main() {
    let chart_names = Object.keys(chart_config);
    for (let name of chart_names) {
      // Make sure the config contains the chart's own name
      chart_config[name]["name"] = name;
      console.log(chart_config[name]);

      let validated = validateInitialValues(chart_config[name]);
      if (!validated) {
        return;
      }
      loadLibraries(chart_config[name]);
    }
  }

  /** Script loading
  // Loads the other scripts from the "media" section of all places,
  // because then we can ensure they load in order.
  // This gets skipped if we're testing things outside the LXP.
  */
  async function loadLibraries(config) {
    // Insert the scripts via creating script tags
    if (
      window.location.href.includes("lxp.huit.harvard.edu") ||
      window.location.href.includes("harvardonline.harvard.edu")
    ) {
      // If the scripts are already loaded, skip loading them again.
      // `script_load_order` is defined in the javascript section of the TE.
      let num_scripts_needed = script_load_order.length;
      for (let script of script_load_order) {
        let script_check = document.querySelector(`script[src*="${script}"]`);
        if (script_check) {
          num_scripts_needed -= 1;
        }
      }
      if (num_scripts_needed === 0) {
        return true;
      }

      let media_object = window.lxp.te[config.te_id].media;
      let media_names = Object.keys(media_object);
      let reverse_lookup = {};
      media_names.forEach((name) => {
        reverse_lookup[media_object[name].filename] = name;
      });
      let scripts = [];

      script_load_order.forEach((name) => {
        if (name in reverse_lookup) {
          scripts.push(media_object[reverse_lookup[name]].publicUrl);
        } else {
          console.error(`Error: Script ${name} not found in media object.`);
          return false;
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

    // Wait for the Chart.js and chart annotation libraries to load
    if (
      window.location.href.includes("lxp.huit.harvard.edu") ||
      window.location.href.includes("harvardonline.harvard.edu")
    ) {
      let count = 0;
      let waiter = setInterval(function () {
        if (typeof Chart !== "undefined") {
          clearInterval(waiter);
          let annotation_waiter = setInterval(function () {
            try {
              if (Chart.registry.plugins.items.annotation !== undefined) {
                if (config.name !== "undefined") {
                  if (typeof Chart !== "undefined") {
                    clearInterval(annotation_waiter);
                    letsGo(chart_config[config.name]);
                    return true;
                  }
                }
              } else {
                console.log(
                  "Waiting for Chart.js annotation library to load..."
                );
              }
            } catch (e) {
              console.log("Error: " + e);
            }
          }, 100);
        } else {
          console.log("Waiting for Chart.js to load...");
        }
        count += 1;
        if (count > 100) {
          console.error(
            "Error: Chart.js annotation library did not load in time."
          );
          clearInterval(waiter);
          return false;
        }
      }, 100);
    } else {
      return true;
    }
  }

  /**
   * Sets up input fields and the slider,
   * then passes to the chart initialization function.
   */
  function letsGo(config) {
    const ctx = document.querySelector("#" + config.name);
    // Create input fields for each y value
    let y_value_container = document.querySelector(".y-values");
    let value_inputs = [];
    config.y.values.forEach((value, index) => {
      let input = document.createElement("input");
      input.type = "number";
      input.value = value;
      input.setAttribute("placeholder", "0");
      input.setAttribute(
        "aria-label",
        `y value at x=${config.x.values[index]}`
      );
      input.value = value;
      if (!config.editable) {
        input.disabled = true;
      }
      y_value_container.appendChild(input);
      value_inputs.push(input);
    });

    // Create slider for x value selection, if we're using a slider.
    let slider;
    if (config.slider_features.use_slider) {
      let slider_container = document.querySelector(".chart-controls");
      let max_value = Math.max(...config.x.values);
      let min_value = Math.min(...config.x.values);
      slider = document.createElement("input");
      slider.type = "range";
      slider.classList.add("x-value-slider");
      slider.max = max_value;
      slider.min = min_value;
      slider.step = Math.round(max_value - min_value) / 100;
      if (config.slider_features.custom_start) {
        slider.value = config.slider_features.custom_start_value;
      } else {
        slider.value = (max_value + min_value) / 2;
      }
      slider_container.prepend(document.createElement("br"));
      slider_container.prepend(slider);
    }

    initializeChart(config, value_inputs, slider);
  }

  /**
   * Sets up the chart and its listeners.
   * @param {*} slider: the slider element, if it exists.
   */
  function initializeChart(ctx, config, value_inputs, slider) {
    myChart = makeChart(ctx, config);

    // If the chart is editable,
    // set pointer event handlers for canvas element
    if (config.editable) {
      ctx.onpointerdown = function (event) {
        return down_handler(event, config);
      };
      ctx.onpointerup = function (event) {
        return up_handler(event, config);
      };
      ctx.onpointermove = null;
      setInputListeners(ctx, config, value_inputs);
    }

    if (config.slider_features.use_slider) {
      setSliderListener(ctx, config);
      annotateWithVertical(
        config,
        Number(slider.value),
        interpolateValues(Chart.getChart(ctx), Number(slider.value))
      );
    }
  }

  /**
   * Checks for monotnicity, negative values,
   * and unequal lengths of x and y arrays.
   * @returns {boolean} whether the initial values are valid.
   */
  function validateInitialValues(config) {
    if (config.restrictions.no_negative_values) {
      if (Math.min(...config.y.values) < 0) {
        alert("Error: y.values must not contain negative values.");
        return false;
      }
    }

    if (config.y.values.length !== config.x.values.length) {
      alert("Error: You must provide equal numbers of x and y values.");
      return false;
    }

    let temp = Array.from(config.y.values);
    temp.sort(function (a, b) {
      return a - b;
    });
    if (
      JSON.stringify(temp) !== JSON.stringify(config.y.values) &&
      config.restrictions.monotonic_increasing
    ) {
      console.error(
        "Error: y.values must be in increasing order if you want monotonic increasing."
      );
      return false;
    }
    temp = Array.from(config.y.values);
    temp.sort(function (a, b) {
      return b - a;
    });
    if (
      JSON.stringify(temp) !== JSON.stringify(config.y.values) &&
      config.restrictions.monotonic_decreasing
    ) {
      console.error(
        "Error: y.values must be in decreasing order if you want monotonic decreasing."
      );
      return false;
    }
    return true;
  }

  /**
   * Sets up event listeners for the y value inputs
   */
  function setInputListeners(ctx, config, value_inputs) {
    // Update chart when y value inputs change
    value_inputs.forEach((el, index) => {
      el.addEventListener("input", function () {
        const chart = Chart.getChart(ctx);
        chart.data.datasets[0].data[index].y = Number(this.value) || 0;
        chart.update();
        if (config.slider_features.use_slider) {
          let slider = ctx.parentElement.querySelector(".x-value-slider");
          annotateWithVertical(
            config,
            Number(slider.value),
            interpolateValues(chart, Number(slider.value))
          );
        }
      });
    });
  }

  /**
   * Sets up event listeners for the slider
   */
  function setSliderListener(ctx, config) {
    // Update the displayed x and y values based on the slider position
    let slider = ctx.parentElement.querySelector(".x-value-slider");
    slider.addEventListener("input", function () {
      const xValue = Number(this.value);

      const chart = Chart.getChart(ctx);
      const dataset = chart.data.datasets[0].data;
      const labels = chart.data.labels;

      let yValue = interpolateValues(chart, xValue) || 0;

      annotateWithVertical(config, xValue, yValue);
    });
  }

  /**
   * Generates a new Chart.js chart within the ctx canvas element.
   * @param {*} ctx
   * @param {*} config
   * @returns
   */
  function makeChart(ctx, config) {
    let data = config.x.values.map((x, i) => ({
      x: x,
      y: config.y.values[i],
    }));
    let start_x_at_zero = Math.min(...config.x.values) === 0;
    let start_y_at_zero = Math.min(...config.y.values) === 0;
    console.log(data);
    console.log(config);
    return new Chart(ctx, {
      type: "line",
      data: {
        // labels: config.x.values,
        datasets: [
          {
            label: config.y.label,
            data: data,
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
            text: config.title,
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
            min: Math.min(...config.y.values),
            ticks: {
              beginAtZero: start_y_at_zero,
            },
            title: {
              display: true,
              text: config.y.label,
              font: { size: 14, weight: "bold" },
            },
          },
          x: {
            min: Math.min(...config.x.values),
            ticks: {
              beginAtZero: start_x_at_zero,
            },
            type: "linear",
            title: {
              display: true,
              text: config.x.label,
              font: { size: 14, weight: "bold" },
            },
          },
        },
      },
    });
  }

  /** Linear interpolation to find the corresponding y value */
  function interpolateValues(chart, xValue) {
    let dataset = chart.data.datasets[0].data;
    let x_values = dataset.map((d) => d.x);
    let y_values = dataset.map((d) => d.y);
    let yValue = null;
    for (let i = 0; i < dataset.length - 1; i++) {
      if (xValue >= x_values[i] && xValue <= x_values[i + 1]) {
        const x0 = x_values[i];
        const x1 = x_values[i + 1];
        const y0 = y_values[i];
        const y1 = y_values[i + 1];
        // Linear interpolation formula
        yValue = y0 + ((y1 - y0) * (xValue - x0)) / (x1 - x0);
        break;
      }
    }
    return yValue;
  }

  /** Adds a vertical line to the plot at the specified xValue. */
  function annotateWithVertical(config, xValue, yValue) {
    const chart = Chart.getChart(config.name);
    if (config.slider_features.annotation_type === "none") {
      return;
    }
    const x_axis = config.x.values;
    if (config.slider_features.annotation_type === "line") {
      chart.options.plugins.annotation = {
        annotations: {
          line1: {
            type: "line",
            xMin: xValue,
            xMax: xValue,
            yMin: 0,
            yMax: yValue,
            borderColor: "rgba(255, 0, 0, 1)",
            borderWidth: 2,
          },
        },
      };
    } else if (config.slider_features.annotation_type === "box") {
      chart.options.plugins.annotation = {
        annotations: {
          box1: {
            type: "box",
            xMin: 0,
            xMax: xValue,
            yMin: 0,
            yMax: yValue,
            backgroundColor: "rgba(255, 0, 0, 0.3)",
            borderColor: "rgba(255, 0, 0, 0.7)",
            borderWidth: 2,
          },
        },
      };
    }
    chart.update();
    updateDisplays(config, xValue, yValue);
  }

  /** Updates the displayed x and y values, and the area
   * of the rectangle annotation if we're using that.
   */
  function updateDisplays(config, xValue, yValue) {
    let xValueDisplay = document
      .querySelector(`#${config.name}`)
      .parentElement.querySelector(".x-value-display");
    let yValueDisplay = document
      .querySelector(`#${config.name}`)
      .parentElement.querySelector(".y-value-display");
    let areaUnderCurveDisplay = document
      .querySelector(`#${config.name}`)
      .parentElement.querySelector(".area-under-curve-display");
    let x_precision = 2;
    let y_precision = 2;
    let total_precision = 2;

    if (typeof config.x.precision === "number") {
      x_precision = -Math.log10(config.x.precision);
    }
    if (typeof config.y.precision === "number") {
      y_precision = -Math.log10(config.y.precision);
    }
    if (config.total.precision) {
      total_precision = -Math.log10(config.total.precision);
    } else {
      total_precision = Math.max(x_precision, y_precision);
    }
    let area_of_rectangle =
      (Math.round(xValue * 10 ** x_precision) / 10 ** x_precision) *
      (Math.round(yValue * 10 ** y_precision) / 10 ** y_precision);

    let x_text = `X Value: ${xValue.toFixed(x_precision)}`;
    if (config.x.units) {
      if (CURRENCY_SYMBOLS.includes(config.x.units.trim())) {
        // Currency symbols go before the number.
        x_text = `X Value: ${config.x.units}${xValue.toFixed(x_precision)}`;
      } else {
        x_text += ` ${config.x.units}`;
      }
      x_text = `Y Value: ${yValue.toFixed(y_precision)}`;
    }
    xValueDisplay.textContent = x_text;

    let y_text = `Y Value: ${yValue.toFixed(y_precision)}`;
    if (config.y.units) {
      if (config.y.units) {
        if (CURRENCY_SYMBOLS.includes(config.y.units.trim())) {
          // Currency symbols go before the number and we always do 2 decimal places.
          y_text = `Y Value: ${config.y.units}${yValue.toFixed(2)}`;
        } else {
          y_text += ` ${config.y.units}`;
        }
      }
    }
    yValueDisplay.textContent = y_text;

    // Only show currency symbol if there are no x units.
    if (!config.total.show_total) {
      return;
    }

    let total_text = "";
    if (config.y.units) {
      if (
        CURRENCY_SYMBOLS.includes(config.y.units.trim()) &&
        (!config.x.units ||
          QUANTITY_WORDS.includes(config.x.units.trim().toLowerCase()))
      ) {
        // Currency symbols go before the number, and we always do 2 decimal places.
        total_text = `Area Of Rectangle: ${
          config.y.units
        }${area_of_rectangle.toFixed(2)}`;
      } else {
        total_text = `Area Of Rectangle: ${area_of_rectangle.toFixed(
          total_precision
        )} ${config.y.units}`;
      }
    }
    areaUnderCurveDisplay.textContent = total_text;
  }

  //////////////////////////////////////////////////////////////////
  // Handlers taken from https://stackoverflow.com/a/59110888/1330737
  // Thanks to user MartinCR https://stackoverflow.com/users/5058026/martin-cr
  //////////////////////////////////////////////////////////////////

  function down_handler(event, config) {
    document.getElementById(config.name).getContext("2d");
    const canvas = document.getElementById(config.name);
    const myChart = Chart.getChart(config.name);
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
      canvas.onpointermove = (event) => move_handler(event, config);
    }
  }

  function up_handler(event, config) {
    const canvas = document.getElementById(config.name);
    // release grabbed point, stop dragging
    activePoint = null;
    canvas.onpointermove = null;
  }

  function move_handler(event, config) {
    const canvas = document.getElementById(config.name);
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
        activePoint,
        config.restrictions
      );

      // update y value of active data point
      data.datasets[datasetIndex].data[activePoint.index].y = yValue;
      myChart.update();
      let ctx = document.getElementById(config.name);
      // Update the annotation
      if (config.slider_features.use_slider) {
        let slider = ctx.parentElement.querySelector(".x-value-slider");
        annotateWithVertical(
          config,
          Number(slider.value),
          interpolateValues(myChart, Number(slider.value))
        );
      }
      // Update the corresponding input field
      let value_inputs = ctx.parentElement.querySelectorAll(".y-values input");
      value_inputs[activePoint.index].value = yValue.toFixed(2);
    }
  }

  //////////////////////

  /**
   * Enforces restrictions on the y values:
   * monotonicity and no negative values if specified.
   * @param {*} value
   * @param {*} data
   * @param {*} restrictions
   * @returns
   */
  function enforceRestrictions(value, data, activePoint, restrictions) {
    let y_values = data.map((d) => d.y);
    // Don't drag below 0
    if (restrictions.no_negative_values) {
      if (value < 0) {
        value = 0;
      }
    }
    if (restrictions.monotonic_decreasing) {
      // Don't drag above previous point
      if (activePoint.index > 0) {
        let previousYValue = y_values[activePoint.index - 1];
        if (value > previousYValue) {
          value = previousYValue;
        }
      }
      //Don't drag below next point
      if (activePoint.index < y_values.length - 1) {
        let nextYValue = y_values[activePoint.index + 1];
        if (value < nextYValue) {
          value = nextYValue;
        }
      }
    } else if (restrictions.monotonic_increasing) {
      // Don't drag below previous point
      if (activePoint.index > 0) {
        let previousYValue = y_values[activePoint.index - 1];
        if (value < previousYValue) {
          value = previousYValue;
        }
      }
      //Don't drag above next point
      if (activePoint.index < y_values.length - 1) {
        let nextYValue = y_values[activePoint.index + 1];
        if (value > nextYValue) {
          value = nextYValue;
        }
      }
    }
    return value;
  }

  /** Mouse position conversion */
  function map(value, start1, stop1, start2, stop2) {
    return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));
  }
})();
