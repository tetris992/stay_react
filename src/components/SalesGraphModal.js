// src/components/SalesGraphModal.js

import React from 'react';
import Modal from 'react-modal';
import { Bar, Line } from 'react-chartjs-2';
import PropTypes from 'prop-types';
import { FaTimes, FaPrint, FaDownload } from 'react-icons/fa'; // FaDownload 추가
import { format } from 'date-fns';
import './SalesGraphModal.css';

// 추가: jsPDF와 html2canvas 임포트
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

// Chart.js 기본 플러그인 등록
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

// 모달 루트 설정
Modal.setAppElement('#root');

function SalesGraphModal({
  isOpen,
  onRequestClose,
  dailySales, // { labels: string[], values: number[] }
  monthlySales, // (사용하지 않음, 남겨둠)
  monthlyDailyBreakdown = [],
  selectedDate,
  dailySalesByOTA = {}, // { [category]: number[] } – 날짜별(OTA/현장예약/대실) 판매 건수
  maxRooms, // 호텔의 최대 객실수 (y축 최대값)
}) {
  // -------------------------
  // (1) 날짜별 판매/남은 객실수 스택형 막대그래프 관련 코드
  // -------------------------
  const labels = dailySales.labels || [];
  const safeDailySalesByOTA =
    dailySalesByOTA && typeof dailySalesByOTA === 'object'
      ? dailySalesByOTA
      : {};
  const otaCategories = Object.keys(safeDailySalesByOTA);
  const categoryColors = {
    Yanolja: '#001F3F', // 야놀자: 진한 남색
    GoodHotel: '#FF0000', // 여기어때호텔: 붉은색
    GoodMotel: '#B22222', // 여기어때모텔: 약간 톤 다운된 붉은색 (firebrick)
    Booking: '#3F4F61', // 부킹: 야놀자보다 낮은 채도의 남색
    Agoda: '#87CEEB', // 아고다: 하늘색 (sky blue)
    Expedia: '#000000', // 익스피디아: 검은색
    CoolStay: '#FFC107', // 쿨스테이: 꿀벌 노란색 (amber)
    현장예약: '#8A2BE2', // 기타: 기존 색상 유지
    대실: '#2E8B57', // 기타: 기존 색상 유지
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

  // -------------------------
  // (2) 월간 일 매출 라인 차트 관련 코드
  // -------------------------
  const safeMonthlyDailyBreakdown = Array.isArray(monthlyDailyBreakdown)
    ? monthlyDailyBreakdown
    : [];

  const cumulativeSales = safeMonthlyDailyBreakdown.reduce((acc, curr, idx) => {
    if (idx === 0) {
      acc.push(curr);
    } else {
      acc.push(acc[idx - 1] + curr);
    }
    return acc;
  }, []);

  const totalMonthlySales = safeMonthlyDailyBreakdown.reduce(
    (sum, curr) => sum + curr,
    0
  );
  const averageDailySales =
    safeMonthlyDailyBreakdown.length > 0
      ? totalMonthlySales / safeMonthlyDailyBreakdown.length
      : 0;

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
        data: safeMonthlyDailyBreakdown,
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

  // -------------------------
  // 인쇄 및 PDF 다운로드 핸들러
  // -------------------------
  const handlePrint = () => {
    window.print();
  };

  // PDF 다운로드 핸들러 (html2canvas와 jsPDF 사용)
  const handleDownloadPdf = async () => {
    const modalElement = document.querySelector('.sales-graph-modal');
    if (modalElement) {
      try {
        const canvas = await html2canvas(modalElement, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        // 이미지의 종횡비 유지하며 전체 페이지에 맞춤
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
      {/* 모달 닫기 버튼 */}
      <button className="close-button" onClick={onRequestClose}>
        <FaTimes />
      </button>

      {/* 인쇄 버튼 */}
      <button className="print-button" onClick={handlePrint}>
        <FaPrint />
      </button>

      {/* PDF 다운로드 버튼 (인쇄 버튼 옆에 배치) */}
      <button className="download-pdf-button" onClick={handleDownloadPdf}>
        <FaDownload />
      </button>

      <h2>매출 보드 - {formattedMonthYear}</h2>

      {/* (1) 날짜별 판매/남은 객실수 스택형 막대그래프 */}
      <div className="chart-container">
        <Bar data={barData} options={barOptions} />
      </div>

      {/* (2) 월간 일 매출 라인 차트 (누적매출 및 평균 매출 점선 포함) */}
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
  monthlyDailyBreakdown: PropTypes.arrayOf(PropTypes.number).isRequired,
  selectedDate: PropTypes.instanceOf(Date).isRequired,
  dailySalesByOTA: PropTypes.objectOf(PropTypes.arrayOf(PropTypes.number)),
  maxRooms: PropTypes.number.isRequired,
};

export default SalesGraphModal;
