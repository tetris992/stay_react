// src/components/CanceledReservationsModal.js

import React, { useEffect, useState, useRef } from 'react';
import Modal from 'react-modal';
import { fetchCanceledReservations } from '../api/api';
import CanceledReservationsTemplate from './CanceledReservationsTemplate';
import './CanceledReservationsModal.css';
import { FaDownload, FaPrint } from 'react-icons/fa';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const CanceledReservationsModal = ({ isOpen, onRequestClose, hotelId }) => {
  const [canceledReservations, setCanceledReservations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const componentRef = useRef();

  useEffect(() => {
    if (isOpen && hotelId) {
      fetchCanceledReservations(hotelId)
        .then((data) => {
          setCanceledReservations(data);
        })
        .catch((error) => {
          console.error('취소 예약 로드 실패:', error);
        });
    }
  }, [isOpen, hotelId]);

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

        pdf.save(`canceled-reservations-${hotelId}.pdf`);
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
      className="canceled-modal"
      overlayClassName="canceled-modal-overlay"
      contentLabel="취소된 예약 정보"
    >
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar />

      <div className="modal-header">
        <button className="modal-close-button" onClick={onRequestClose}>
          &times;
        </button>
        <div className="modal-actions">
          <button
            className="modal-action-button"
            onClick={handleDownloadPDF}
            aria-label="취소 예약 리스트 다운로드"
            disabled={isLoading}
          >
            <FaDownload />
            {isLoading && <span className="loading-spinner"></span>}
          </button>
          <button
            className="modal-action-button"
            onClick={handlePrint}
            aria-label="취소 예약 리스트 인쇄"
          >
            <FaPrint />
          </button>
        </div>
      </div>

      <div id="canceled-reservations-content" ref={componentRef}>
        <CanceledReservationsTemplate reservations={canceledReservations} />
      </div>
    </Modal>
  );
};

export default CanceledReservationsModal;
