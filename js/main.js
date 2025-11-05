(() => {
  const ctx = document.getElementById(chart_name);
  const slider = document.getElementById("x-value-slider");
  const xValueDisplay = document.getElementById("x-value-display");
  const yValueDisplay = document.getElementById("y-value-display");
  const areaUnderCurveDisplay = document.getElementById("area-under-curve-display");

  let value_inputs = document.querySelectorAll(".y-values input");

  //////////// Initial Setup ////////////

  // Set initial values from the chart_config variable.
  value_inputs.forEach((el, index) => {
    el.value = chart_config[chart_name].y_values[index];
    el.setAttribute("aria-label", `y value at x=${chart_config[chart_name].x_values[index]}`);
  });

  makeChart(ctx, chart_config[chart_name]);

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
    new Chart(ctx, {
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
  function annotate_with_vertical(chart, xValue, yValue) {
    chart.options.plugins.annotation = {
      annotations: {
        line1: {
          type: "line",
          xMin: xValue / 2, // I have no idea why we need this.
          xMax: xValue / 2,
          yMin: 0,
          yMax: yValue,
          borderColor: "red",
          borderWidth: 2,
        },
        line2: {
          type: "line",
          xMin: 0,
          xMax: xValue / 2,
          yMin: yValue,
          yMax: yValue,
          borderColor: "red",
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
    console.log(`X Value: ${xValue.toFixed(precision)}, Y Value: ${yValue.toFixed(precision)}`);
  }
})();
