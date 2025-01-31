// src/components/DailySalesModal.js

import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import Modal from 'react-modal';
import DailySalesTemplate from './DailySalesTemplate';
import './DailySalesModal.css';
import { FaDownload, FaPrint } from 'react-icons/fa';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const DailySalesModal = ({
  isOpen,
  onRequestClose,
  dailySalesReport,
  dailyTotal,
  monthlySales,
  selectedDate,
  totalRooms,
  occupancyRate,
  remainingRooms,
  dailyAverageRoomPrice,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const componentRef = useRef();

  const handleDownloadPDF = () => {
    setIsLoading(true);
    const input = componentRef.current;
    if (!input) {
      setIsLoading(false);
      return;
    }

    html2canvas(input, { scale: 2 })
      .then((canvas) => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pdfWidth;
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
          position -= pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pdfHeight;
        }

        pdf.save(`sales-report-${format(selectedDate, 'yyyy-MM-dd')}.pdf`);
        toast.success('PDF 다운로드가 완료되었습니다!');
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('PDF 다운로드 실패:', error);
        toast.error('PDF 다운로드에 실패했습니다.');
        setIsLoading(false);
      });
  };

  // InvoiceModal과 동일한 프린트 로직
  const handlePrint = () => {
    const input = componentRef.current;
    const printContents = input.innerHTML;
    const originalContents = document.body.innerHTML;

    document.body.innerHTML = printContents;
    window.print();
    document.body.innerHTML = originalContents;
    window.location.reload();
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      contentLabel="매출 정보"
      className="sales-modal"
      overlayClassName="sales-modal-overlay"
    >
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar />

      <div className="modal-header">
        <button
          className="modal-close-button"
          onClick={onRequestClose}
          aria-label="매출 정보 닫기"
        >
          &times;
        </button>
        <div className="modal-actions">
          <button
            className="modal-action-button"
            onClick={handleDownloadPDF}
            aria-label="매출 리포트 다운로드"
            disabled={isLoading}
          >
            <FaDownload />
            {isLoading && <span className="loading-spinner"></span>}
          </button>
          <button
            className="modal-action-button"
            onClick={handlePrint}
            aria-label="매출 리포트 인쇄"
          >
            <FaPrint />
          </button>
        </div>
      </div>

      <div id="daily-sales-content" ref={componentRef}>
        <DailySalesTemplate
          dailySalesReport={dailySalesReport}
          dailyTotal={dailyTotal}
          monthlySales={monthlySales}
          selectedDate={selectedDate}
          totalRooms={totalRooms}
          remainingRooms={remainingRooms}
          occupancyRate={occupancyRate} // 전달
          dailyAverageRoomPrice={dailyAverageRoomPrice}
        />
      </div>
    </Modal>
  );
};

DailySalesModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onRequestClose: PropTypes.func.isRequired,
  dailySalesReport: PropTypes.array.isRequired,
  dailyTotal: PropTypes.number.isRequired,
  monthlySales: PropTypes.number.isRequired,
  selectedDate: PropTypes.instanceOf(Date).isRequired,
  totalRooms: PropTypes.number.isRequired,
  remainingRooms: PropTypes.number.isRequired,
  avgMonthlyRoomPrice: PropTypes.number.isRequired,
};

export default DailySalesModal;
