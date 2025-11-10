(() => {
  const ctx = document.getElementById(chart_name);
  const slider = document.getElementById("x-value-slider");
  const xValueDisplay = document.getElementById("x-value-display");
  const yValueDisplay = document.getElementById("y-value-display");
  const areaUnderCurveDisplay = document.getElementById("area-under-curve-display");
  var activePoint = null;

  let value_inputs = document.querySelectorAll(".y-values input");

  //////////// Initial Setup ////////////

  // Set initial values from the chart_config variable.
  value_inputs.forEach((el, index) => {
    el.value = chart_config[chart_name].y_values[index];
    el.setAttribute("aria-label", `y value at x=${chart_config[chart_name].x_values[index]}`);
  });
  const myChart = makeChart(ctx, chart_config[chart_name]);
  // set pointer event handlers for canvas element
  ctx.onpointerdown = down_handler;
  ctx.onpointerup = up_handler;
  ctx.onpointermove = null;

  annotate_with_vertical(
    Chart.getChart(ctx),
    Number(slider.value),
    interpolateValues(Chart.getChart(ctx), Number(slider.value))
  );

  /////////////// Event Listeners ///////////////

  // Update chart when y value inputs change
  value_inputs.forEach((el, index) => {
    el.addEventListener("input", function () {
      const chart = Chart.getChart(ctx);
      chart.data.datasets[0].data[index] = Number(this.value) || 0;
      chart.update();
      annotate_with_vertical(
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
    annotate_with_vertical(chart, xValue, yValue);
  });

  /////////////// Functions ///////////////

  function makeChart(ctx, chart_config) {
    console.log(chart_config);
    return new Chart(ctx, {
      type: "line",
      data: {
        labels: chart_config.x_values,
        datasets: [
          {
            label: chart_config.y_label,
            data: chart_config.y_values,
            borderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
          },
        ],
      },
      options: {
        animations: false,
        cubicInterpolationMode: "default",
        aspectRatio: ctx.clientWidth / (0.2 * window.innerHeight),
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
              text: chart_config.y_label,
              font: { size: 14, weight: "bold" },
            },
          },
          x: {
            beginAtZero: true,
            min: 0,
            max: 10,
            title: {
              display: true,
              text: chart_config.x_label,
              font: { size: 14, weight: "bold" },
            },
          },
        },
      },
    });
  }

  // Linear interpolation to find the corresponding y value
  function interpolateValues(chart, xValue) {
    const dataset = chart.data.datasets[0].data;
    const labels = chart.data.labels;
    let yValue = null;
    for (let i = 0; i < labels.length - 1; i++) {
      if (xValue >= labels[i] && xValue <= labels[i + 1]) {
        const x0 = labels[i];
        const x1 = labels[i + 1];
        const y0 = dataset[i];
        const y1 = dataset[i + 1];
        // Linear interpolation formula
        yValue = y0 + ((y1 - y0) * (xValue - x0)) / (x1 - x0);
        break;
      }
    }
    return yValue;
  }

  // Adds a vertical line to the plot at the specified xValue.
  // TODO: switch this to a shaded box instead of lines.
  function annotate_with_vertical(chart, xValue, yValue) {
    chart.options.plugins.annotation = {
      annotations: {
        box1: {
          type: "box",
          xMin: 0,
          xMax: xValue / 2,
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
    let area_of_rectangle = xValue * yValue;
    let precision = 1;
    xValueDisplay.textContent = `X Value: ${xValue.toFixed(precision)}`;
    yValueDisplay.textContent = `Y Value: ${yValue.toFixed(precision)}`;
    areaUnderCurveDisplay.textContent = `Area Of Rectangle: ${area_of_rectangle.toFixed(
      precision
    )}`;
    // console.log(`X Value: ${xValue.toFixed(precision)}, Y Value: ${yValue.toFixed(precision)}`);
  }

  // Handlers taken from https://stackoverflow.com/a/59110888/1330737
  // Thanks to user MartinCR https://stackoverflow.com/users/5058026/martin-cr

  function down_handler(event) {
    document.getElementById(chart_name).getContext("2d");
    const canvas = document.getElementById(chart_name);
    // check for data point near event location
    const points = myChart.getElementsAtEventForMode(event, "nearest", { intersect: true }, false);
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
      let yValue = map(position.y, chartArea.bottom, chartArea.top, yAxis.min, yAxis.max);
      yValue = enforceRestrictions(yValue, data.datasets[datasetIndex].data, chart_config[chart_name].restrictions);

      // update y value of active data point
      data.datasets[datasetIndex].data[activePoint.index] = yValue;
      myChart.update();
      // Update the annotation
      annotate_with_vertical(
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
