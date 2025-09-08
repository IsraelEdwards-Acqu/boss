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

window.getInnerHTML = function (elementId) {
    const el = document.getElementById(elementId);
    return el ? el.innerHTML : '';
};

window.printReceiptContent = function (elementId) {
    const el = document.getElementById(elementId);
    if (!el) {
        alert("❌ Receipt element not found: " + elementId);
        return;
    }

    const receiptHtml = el.outerHTML;
    const win = window.open('', '_blank', 'width=400,height=600');
    if (!win) {
        alert("Popup blocked. Please allow popups for this site.");
        return;
    }

    const html = `
<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <title>Receipt</title>
    <style>
        body { font-family: monospace; width: 80mm; padding: 10px; }
        img { display: block; margin: 0 auto; }
        hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
        .text-center { text-align: center; }
        .text-end { text-align: right; }
        .small { font-size: 10px; }
        .text-muted { color: #555; }
    </style>
</head>
<body>
    ${receiptHtml}
</body>
</html>`;

    win.document.open();
    win.document.write(html);
    win.document.close();

    win.onload = function () {
        win.focus();
        win.print();
        win.onafterprint = function () {
            win.close();
        };
    };
};