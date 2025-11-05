(() => {
  const ctx = document.getElementById("myChart");
  const slider = document.getElementById("x-value-slider");
  let value_inputs = document.querySelectorAll(".y-values input");
  let initial_values = Array.from(value_inputs).map((input) => Number(input.value) || 0);

  // Chart at 80% viewport height
  new Chart(ctx, {
    type: "line",
    data: {
      labels: [0, 2, 4, 6, 8, 10],
      datasets: [
        {
          label: "y values",
          data: initial_values,
          borderWidth: 1,
        },
      ],
    },
    options: {
      animations: false,
      cubicInterpolationMode: "default",
      aspectRatio: ctx.clientWidth / (0.2 * window.innerHeight),
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
        },
        x: {
          beginAtZero: true,
          min: 0,
          max: 10,
        },
      },
    },
  });

  // Add vertical line annotation at the slider's initial position
  annotate_with_vertical(
    Chart.getChart(ctx),
    Number(slider.value),
    interpolateValues(Chart.getChart(ctx), Number(slider.value))
  );

  // Update the chart when input values change
  const inputs = ["y0", "y2", "y4", "y6", "y8", "y10"];
  inputs.forEach((id, index) => {
    document.getElementById(id).addEventListener("input", function () {
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
  const xValueDisplay = document.getElementById("x-value-display");
  const yValueDisplay = document.getElementById("y-value-display");
  slider.addEventListener("input", function () {
    const xValue = Number(this.value);

    const chart = Chart.getChart(ctx);
    const dataset = chart.data.datasets[0].data;
    const labels = chart.data.labels;

    let yValue = interpolateValues(chart, xValue) || 0;
    annotate_with_vertical(chart, xValue, yValue);
    updateDisplays(xValue, yValue);
  });

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
  }

  // Update the displayed x and y values
  function updateDisplays(xValue, yValue) {
    xValueDisplay.textContent = `X Value: ${xValue.toFixed(2)}`;
    yValueDisplay.textContent = `Y Value: ${yValue.toFixed(2)}`;
    console.log(`X Value: ${xValue.toFixed(2)}, Y Value: ${yValue.toFixed(2)}`);
  }
})();
