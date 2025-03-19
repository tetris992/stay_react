import React from 'react';
import Modal from 'react-modal';
import { Bar, Line } from 'react-chartjs-2';
import PropTypes from 'prop-types';
import { FaTimes, FaPrint, FaDownload } from 'react-icons/fa';
import { format } from 'date-fns';
import './SalesGraphModal.css';

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

Modal.setAppElement('#root');

function SalesGraphModal({
  isOpen,
  onRequestClose,
  dailySales,
  monthlySales,
  monthlyDailyBreakdown = [],
  selectedDate,
  dailySalesByOTA = {},
  maxRooms,
}) {
  const labels = dailySales.labels || [];
  const safeDailySalesByOTA =
    dailySalesByOTA && typeof dailySalesByOTA === 'object'
      ? dailySalesByOTA
      : {};
  const otaCategories = Object.keys(safeDailySalesByOTA);
  const categoryColors = {
    Yanolja: '#001F3F',
    GoodHotel: '#FF0000',
    GoodMotel: '#B22222',
    Booking: '#3F4F61',
    Agoda: '#87CEEB',
    Expedia: '#000000',
    CoolStay: '#FFC107',
    현장숙박: '#8A2BE2',
    현장대실: '#2E8B57',
    기타: '#AAAAAA',
  };

  const totals = labels.map((_, idx) => {
    let sum = 0;
    otaCategories.forEach((category) => {
      const data = safeDailySalesByOTA[category] || [];
      sum += data[idx] || 0;
    });
    return sum;
  });

  const otaDatasets = otaCategories.map((category) => ({
    label: category,
    data: safeDailySalesByOTA[category] || [],
    backgroundColor: categoryColors[category] || '#AAAAAA',
  }));

  const remainingDataset = {
    label: '남은 객실',
    data: totals.map((total) => Math.max(0, maxRooms - total)),
    backgroundColor: 'white',
  };

  const combinedDatasets = [...otaDatasets, remainingDataset];

  const barData = {
    labels: labels,
    datasets: combinedDatasets,
  };

  const barXAxisTicks = {
    color: (context) => {
      const label = context.tick.label;
      const parts = label.split('-');
      if (parts.length === 2) {
        const month = parseInt(parts[0], 10) - 1;
        const day = parseInt(parts[1], 10);
        const year = selectedDate.getFullYear();
        const dateObj = new Date(year, month, day);
        const dow = dateObj.getDay();
        return dow === 0 || dow === 6 ? 'red' : '#666';
      }
      return '#666';
    },
  };

  const barOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          boxWidth: 12,
          usePointStyle: false,
        },
      },
      title: {
        display: true,
        text: '날짜별 판매/남은 객실수',
      },
      tooltip: {
        callbacks: {
          label: (context) =>
            `${context.dataset.label}: ${context.parsed.y} 객실`,
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        title: { display: true, text: '날짜' },
        ticks: barXAxisTicks,
      },
      y: {
        stacked: true,
        beginAtZero: true,
        max: maxRooms,
        ticks: {
          callback: (value) => `${value} 객실`,
        },
        title: { display: true, text: '객실 수' },
      },
    },
  };

  const safeMonthlyDailyBreakdown = Array.isArray(monthlyDailyBreakdown)
    ? monthlyDailyBreakdown
    : [];

  const dailyTotals = safeMonthlyDailyBreakdown.map((day) => day.Total || 0);

  const cumulativeSales = dailyTotals.reduce((acc, curr, idx) => {
    if (idx === 0) {
      acc.push(curr);
    } else {
      acc.push(acc[idx - 1] + curr);
    }
    return acc;
  }, []);

  const totalMonthlySales = dailyTotals.reduce((sum, curr) => sum + curr, 0);
  const averageDailySales =
    dailyTotals.length > 0 ? totalMonthlySales / dailyTotals.length : 0;

  const lineLabels = safeMonthlyDailyBreakdown.map((_, idx) => `${idx + 1}일`);

  const lineXAxisTicks = {
    color: (context) => {
      const label = context.tick.label;
      const dayStr = label.replace('일', '');
      const day = parseInt(dayStr, 10);
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const dateObj = new Date(year, month, day);
      const dow = dateObj.getDay();
      return dow === 0 || dow === 6 ? 'red' : '#666';
    },
  };

  const monthlyDailyLineData = {
    labels: lineLabels,
    datasets: [
      {
        label: '일 매출',
        data: dailyTotals,
        borderColor: '#FF6384',
        backgroundColor: '#FF6384',
        fill: false,
        yAxisID: 'y1',
      },
      {
        label: '누적 매출',
        data: cumulativeSales,
        borderColor: '#36A2EB',
        backgroundColor: '#36A2EB',
        fill: false,
        yAxisID: 'y2',
      },
      {
        label: '평균 매출',
        data: lineLabels.map(() => averageDailySales),
        borderColor: 'rgba(0,0,0,0.3)',
        borderDash: [5, 5],
        borderWidth: 1,
        fill: false,
        pointRadius: 0,
        yAxisID: 'y1',
      },
    ],
  };

  const monthlyDailyLineOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          boxWidth: 12,
        },
      },
      title: {
        display: true,
        text: '월간 일 매출 추세 (오른쪽: 누적 매출)',
      },
    },
    scales: {
      x: {
        ticks: lineXAxisTicks,
      },
      y1: {
        beginAtZero: true,
        ticks: {
          callback: (value) => '₩' + value.toLocaleString(),
        },
        title: { display: true, text: '일 매출 (₩)' },
      },
      y2: {
        beginAtZero: true,
        position: 'right',
        grid: { drawOnChartArea: false },
        ticks: {
          callback: (value) => '₩' + value.toLocaleString(),
        },
        title: { display: true, text: '누적 매출 (₩)' },
      },
    },
  };

  const handlePrint = async () => {
    const modalElement = document.querySelector('.sales-graph-modal');
    if (modalElement) {
      try {
        const canvas = await html2canvas(modalElement, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
          <html>
            <head>
              <title>매출 그래프 인쇄</title>
              <style>
                body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
                img { max-width: 100%; height: auto; }
              </style>
            </head>
            <body>
              <img src="${imgData}" onload="window.print(); window.close();" />
            </body>
          </html>
        `);
        printWindow.document.close();
      } catch (error) {
        console.error('인쇄 준비 중 오류 발생:', error);
        alert('인쇄 중 오류가 발생했습니다. PDF 다운로드를 이용해 주세요.');
      }
    } else {
      console.error('모달 요소를 찾을 수 없습니다.');
      alert('모달 요소를 찾을 수 없습니다. 다시 시도해 주세요.');
    }
  };

  const handleDownloadPdf = async () => {
    const modalElement = document.querySelector('.sales-graph-modal');
    if (modalElement) {
      try {
        const canvas = await html2canvas(modalElement, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save('sales_graph.pdf');
      } catch (error) {
        console.error('PDF 생성 실패:', error);
      }
    }
  };

  const formattedMonthYear = format(selectedDate, 'yyyy년 MM월');

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      contentLabel="매출 그래프 보기"
      className="sales-graph-modal"
      overlayClassName="sales-graph-modal-overlay"
    >
      <button className="close-button" onClick={onRequestClose}>
        <FaTimes />
      </button>
      <button className="print-button" onClick={handlePrint}>
        <FaPrint />
      </button>
      <button className="download-pdf-button" onClick={handleDownloadPdf}>
        <FaDownload />
      </button>
      <h2>매출 보드 - {formattedMonthYear}</h2>
      <div className="chart-container">
        <Bar data={barData} options={barOptions} />
      </div>
      <div className="chart-container">
        <Line data={monthlyDailyLineData} options={monthlyDailyLineOptions} />
      </div>
    </Modal>
  );
}

SalesGraphModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onRequestClose: PropTypes.func.isRequired,
  dailySales: PropTypes.shape({
    labels: PropTypes.arrayOf(PropTypes.string).isRequired,
    values: PropTypes.arrayOf(PropTypes.number).isRequired,
  }).isRequired,
  monthlySales: PropTypes.shape({
    labels: PropTypes.arrayOf(PropTypes.string),
    values: PropTypes.arrayOf(PropTypes.number),
  }),
  monthlyDailyBreakdown: PropTypes.arrayOf(
    PropTypes.shape({
      Total: PropTypes.number,
      Cash: PropTypes.number,
      Card: PropTypes.number,
      OTA: PropTypes.number,
      Pending: PropTypes.number,
      현장숙박: PropTypes.number,
      현장대실: PropTypes.number,
    })
  ).isRequired,
  selectedDate: PropTypes.instanceOf(Date).isRequired,
  dailySalesByOTA: PropTypes.objectOf(PropTypes.arrayOf(PropTypes.number)),
  maxRooms: PropTypes.number.isRequired,
};

export default SalesGraphModal;
