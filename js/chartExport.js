window.chartExport = {
    exportChart: function (chartId) {
        const chart = Chart.getChart(chartId);
        if (!chart) return null;

        const image = chart.toBase64Image();
        const link = document.createElement('a');
        link.href = image;
        link.download = 'weekly-sales-chart.png';
        link.click();
    }
};
