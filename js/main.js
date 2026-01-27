"use strict";
(async () => {
  // Don't run twice. Running once will handle all charts.
  if (typeof window.hcecon_graphs_loaded !== "undefined") {
    return;
  }
  window.hcecon_graphs_loaded = true;

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
  let waiter = setInterval(function () {
    console.log("Setting waiter for chart configuration...");
    console.log(Object.keys(chart_config).length, num_charts);
    if (Object.keys(chart_config).length === num_charts) {
      console.log(chart_config);
      clearInterval(waiter);
      main();
      return;
    }
    count += 1;
    console.log(count);
    if (count > 100) {
      // You get 10 seconds to load the charts.
      console.error("Error: Chart configuration did not load in time.");
      clearInterval(waiter);
      return;
    }
  }, 100);

  /** Just kickoff.
   * Gets config, validates x/y values, and sends to script loader,
   * which will continue execution from there.
   */
  function main() {
    console.log("main");
    let chart_names = Object.keys(chart_config);
    for (let name of chart_names) {
      // Make sure the config contains the chart's own name
      chart_config[name]["name"] = name;
      console.log(chart_config[name]);

      let validated = validateInitialValues(chart_config[name]);
      if (!validated) {
        console.log("Initial values not valid, skipping chart " + name);
        continue;
      }
    }
    loadLibraries(chart_config);
  }

  /** Script loading
   * Loads the other scripts from the "media" section of all places,
   * because then we can ensure they load in order.
   * This gets skipped if we're testing things outside the LXP.
   * Then waits for them to load before continuing.
   * This works *specifically* with Chart.js and its annotation plugin.
   *
   * @param {object} chart_config the full chart configuration object defined in the TE.
   */
  function loadLibraries(chart_config) {
    console.log(chart_config);
    // Insert the scripts via creating script tags
    if (
      window.location.href.includes("lxp.huit.harvard.edu") ||
      window.location.href.includes("harvardonline.harvard.edu")
    ) {
      for (let config in chart_config) {
        let c = chart_config[config]; // Just shortening the variable name.
        console.log(c.name);
        console.log(c.te_id);
        console.log(window.lxp.te);
        console.log(Object.keys(window.lxp.te));
        let media_object = window.lxp.te[c.te_id].media;
        let media_names = Object.keys(media_object);
        let reverse_lookup = {};
        media_names.forEach((name) => {
          reverse_lookup[media_object[name].filename] = name;
        });

        script_load_order.forEach((name) => {
          // Is there already a script with this name?
          let existing_script = document.querySelector(`script[src*="${name}"]`);
          if (existing_script) {
            console.log(`Script ${name} already loaded.`);
          } else {
            if (name in reverse_lookup) {
              let scriptTag = document.createElement("script");
              scriptTag.src = media_object[reverse_lookup[name]].publicUrl;
              scriptTag.async = false;
              document.head.appendChild(scriptTag);
            } else {
              console.error(`Error: Script ${name} not found in media object.`);
            }
          }
        });

        // Wait for the Chart.js and chart annotation libraries to load
        let count = 0;
        let chart_waiter = setInterval(function () {
          if (typeof Chart !== "undefined") {
            clearInterval(chart_waiter);
            console.log("Chart.js loaded.");
            let count = 0;
            let annotation_waiter = setInterval(function () {
              try {
                if (Chart.registry.plugins.items.annotation !== undefined) {
                  if (c.name !== "undefined") {
                    clearInterval(annotation_waiter);
                    letsGo(c);
                    return true;
                  }
                } else {
                  console.log("Waiting for Chart.js annotation library to load...");
                }
              } catch (e) {
                console.log("Error: " + e);
              }
              count += 1;
              if (count > 100) {
                console.error("Error: Chart.js annotation library did not load in time.");
                clearInterval(annotation_waiter);
                return false;
              }
            }, 100);
          } else {
            console.log("Waiting for Chart.js to load...");
          }
          count += 1;
          if (count > 100) {
            console.error("Error: Chart.js annotation library did not load in time.");
            clearInterval(chart_waiter);
            return false;
          }
        }, 100);
      }
    } else {
      for (let c in chart_config) {
        letsGo(chart_config[c]);
      }
    }
  }

  /**
   * Sets up input fields and the slider,
   * then passes to the chart initialization function.
   *
   * @param {*} config a single chart's configuration object.
   */
  function letsGo(config) {
    const ctx = document.querySelector("#" + config.name);
    const container_div = ctx.parentElement;
    // console.log(container_div);
    container_div.style.backgrounColor = "red";
    // Create input fields for each y value
    let y_value_container = container_div.querySelector(".y-values");
    let value_inputs = [];
    config.y.values.forEach((value, index) => {
      let input = document.createElement("input");
      input.type = "number";
      input.value = value;
      input.setAttribute("placeholder", "0");
      input.setAttribute("aria-label", `y value at x=${config.x.values[index]}`);
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
      let slider_container = container_div.querySelector(".chart-controls");
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
   * @param {*} config a single chart's configuration object.
   * @param {*} value_inputs the array of y value input elements.
   * @param {*} slider the slider element.
   */
  function initializeChart(config, value_inputs, slider) {
    const ctx = document.querySelector("#" + config.name);
    const myChart = makeChart(ctx, config);

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
        interpolateValues(Chart.getChart(ctx), Number(slider.value)),
      );
    }
  }

  /**
   * Checks for monotnicity, negative values,
   * and unequal lengths of x and y arrays.
   * @param {*} config a single chart's configuration object.
   * @returns {boolean} whether the initial values are valid.
   */
  function validateInitialValues(config) {
    if (config.restrictions.no_negative_values) {
      if (Math.min(...config.y.values) < 0) {
        alert("Error in " + config.name + ": y.values must not contain negative values.");
        return false;
      }
    }

    if (config.y.values.length !== config.x.values.length) {
      alert("Error in " + config.name + ": You must provide equal numbers of x and y values.");
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
        "Error in " +
          config.name +
          ": y.values must be in increasing order if you want monotonic increasing.",
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
        "Error in " +
          config.name +
          ": y.values must be in decreasing order if you want monotonic decreasing.",
      );
      return false;
    }
    return true;
  }

  /**
   * Sets up event listeners for the y value inputs.
   * @param {*} ctx the canvas element.
   * @param {*} config the chart configuration object.
   * @param {*} value_inputs the array of y value input elements.
   */
  function setInputListeners(ctx, config, value_inputs) {
    // Update chart when y value inputs change
    value_inputs.forEach((el, index) => {
      el.addEventListener("input", function () {
        const chart = Chart.getChart(ctx);
        const container_div = ctx.parentElement;
        let yValue = Number(this.value) || 0;
        let yAxis = chart.scales["y"];
        chart.data.datasets[0].data[index].y = yValue;

        // If the y value is higher than the max, lift the limit on the max.
        if (yValue > yAxis.max) {
          delete chart.options.scales.y.max;
          chart.update();
        }

        // If the y value is lower than the min, lift the limit on the min.
        if (yValue < yAxis.min) {
          if (config.restrictions.no_negative_values && yValue <= 0) {
            chart.options.scales.y.min = 0;
          } else {
            delete chart.options.scales.y.min;
          }
          chart.update();
        }

        chart.update();
        if (config.slider_features.use_slider) {
          let slider = container_div.querySelector(".x-value-slider");
          annotateWithVertical(
            config,
            Number(slider.value),
            interpolateValues(chart, Number(slider.value)),
          );
        }
      });
    });
  }

  /**
   * Sets up event listeners for the slider
   * @param {*} ctx the canvas element.
   * @param {*} config the chart configuration object.
   */
  function setSliderListener(ctx, config) {
    // Update the displayed x and y values based on the slider position
    let slider = ctx.parentElement.querySelector(".x-value-slider");
    slider.addEventListener("input", function () {
      const chart = Chart.getChart(ctx);
      const xValue = Number(this.value);
      const yValue = interpolateValues(chart, xValue) || 0;
      annotateWithVertical(config, xValue, yValue);
    });
  }

  /**
   * Generates a new Chart.js chart within the ctx canvas element.
   * @param {*} ctx
   * @param {*} config
   * @returns {Chart} the created Chart.js chart object
   */
  function makeChart(ctx, config) {
    let data = config.x.values.map((x, i) => ({
      x: x,
      y: config.y.values[i],
    }));
    const start_x_at_zero = Math.min(...config.x.values) === 0;
    const start_y_at_zero = Math.min(...config.y.values) === 0;
    // Setting an arbitrary minimum y box height, because otherwise
    // when everything starts at 0 we end up with distances like 10^-17
    let y_box_height = config.minimum_height || 1;
    if (Math.max(...config.y.values) > y_box_height) {
      y_box_height = Math.max(...config.y.values);
    }

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
            max: y_box_height,
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

  /**
   * Linear interpolation to find the corresponding y value
   * @param {Chart} chart the Chart.js chart object
   * @param {number} xValue the x value to interpolate for
   * @returns {number} the interpolated y value
   */
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

  /**
   * Adds a vertical line to the plot at the specified xValue.
   * @param {*} config the chart configuration object.
   * @param {number} xValue the x value to annotate
   * @param {number} yValue the corresponding y value at xValue,
   *   usually generated by interpolateValues()
   */
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
   * @param {*} config the chart configuration object.
   * @param {number} xValue the current x value.
   * @param {number} yValue the current y value.
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

    let x_label = config.x.label || "X Value";
    let x_text = withUnits(x_label, xValue, config.x.units, x_precision);
    xValueDisplay.textContent = x_text;

    let y_label = config.y.label || "Y Value";
    let y_text = withUnits(y_label, yValue, config.y.units, y_precision);
    yValueDisplay.textContent = y_text;

    let total_label = config.total.label || "Area Of Rectangle";
    let total_text = withUnits(total_label, area_of_rectangle, config.total.units, total_precision);
    areaUnderCurveDisplay.textContent = total_text;
  }

  /**
   * Creates things like "Price: $10.00" or "Quantity: 5 gloops".
   * Currency symbols go before the number,
   * quantity words like "units" or "count" don't get included.
   * @param {string} label
   * @param {number} value
   * @param {string} units
   * @param {number} precision
   * @returns
   */
  function withUnits(label, value, units, precision) {
    let text = "";
    // console.log(`withUnits: ${label}, ${value}, ${units}, ${precision}`);
    if (units) {
      if (CURRENCY_SYMBOLS.includes(units.trim())) {
        // Currency symbols go before the number.
        text = `${label}: ${units}${value.toFixed(precision)}`;
      } else {
        if (QUANTITY_WORDS.includes(units.trim().toLowerCase())) {
          // Quantity words like "units" don't get added after the number.
          text = `${label}: ${value.toFixed(precision)}`;
        } else {
          text = `${label}: ${value.toFixed(precision)} ${units}`;
        }
      }
    } else {
      text = `${label}: ${value.toFixed(precision)}`;
    }
    return text;
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
    const points = myChart.getElementsAtEventForMode(event, "nearest", { intersect: true }, false);
    if (points.length > 0) {
      // grab nearest point, start dragging
      activePoint = points[0];
      canvas.onpointermove = (event) => move_handler(event, config, myChart);
    }
  }

  function up_handler(event, config) {
    const canvas = document.getElementById(config.name);
    // release grabbed point, stop dragging
    activePoint = null;
    canvas.onpointermove = null;
  }

  function move_handler(event, config, myChart) {
    // locate grabbed point in chart data
    if (activePoint == null) {
      return;
    }

    let data = myChart.data;
    let datasetIndex = activePoint.datasetIndex;

    // read mouse position
    const helpers = Chart.helpers;
    let position = helpers.getRelativePosition(event, myChart);

    // convert mouse position to chart y axis value
    let chartArea = myChart.chartArea;
    let yAxis = myChart.scales["y"];
    let yValue = map(position.y, chartArea.bottom, chartArea.top, yAxis.min, yAxis.max);
    yValue = enforceRestrictions(
      yValue,
      data.datasets[datasetIndex].data,
      activePoint,
      config.restrictions,
    );

    // Prevent tiny drags near 0 that result in values like 10^-17
    const original_y = config.y.values[activePoint.index];
    const y_range = Math.abs(Math.max(...config.y.values) - Math.min(...config.y.values));
    let y_box_height = 1; // default
    if (config.restrictions?.minimum_height) {
      y_box_height = config.restrictions.minimum_height;
    }
    if (y_range > y_box_height) {
      y_box_height = y_range;
    }
    let minimum_drag_distance = y_box_height * 0.01;
    if (Math.abs(yValue - original_y) < minimum_drag_distance) {
      return;
    }

    // If the y value is higher than the max, lift the limit on the max.
    if (yValue > yAxis.max) {
      delete myChart.options.scales.y.max;
      myChart.update();
    }

    // If the y value is lower than the min, lift the limit on the min.
    if (yValue < yAxis.min) {
      if (config.restrictions.no_negative_values && yValue <= 0) {
        myChart.options.scales.y.min = 0;
      } else {
        delete myChart.options.scales.y.min;
      }
      myChart.update();
    }

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
        interpolateValues(myChart, Number(slider.value)),
      );
    }
    // Update the corresponding input field
    let value_inputs = ctx.parentElement.querySelectorAll(".y-values input");
    value_inputs[activePoint.index].value = yValue.toFixed(2);
  }

  //////////////////////

  /**
   * Enforces restrictions on the y values:
   * monotonicity and no negative values if specified.
   * @param {*} value
   * @param {*} data
   * @param {*} restrictions
   * @returns {number} the adjusted y value
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
