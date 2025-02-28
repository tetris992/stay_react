import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import PropTypes from 'prop-types';
import { FaDownload, FaPrint, FaTimes, FaEdit, FaSave } from 'react-icons/fa';
import './InvoiceModal.css';
import InvoiceTemplate from './InvoiceTemplate';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import { fetchUserInfo } from '../api/api';

const InvoiceModal = ({
  isOpen,
  onRequestClose,
  invoiceRef,
  reservationNo,
  reservation,
  hotelId,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editedReservation, setEditedReservation] = useState({
    ...reservation,
    reservationNo:
      reservationNo || reservation.reservationNo || reservation._id || '',
  });

  const [hotelInfo, setHotelInfo] = useState({
    hotelName: '',
    address: '',
    phoneNumber: '',
    email: '',
  });

  // 호텔 설정 API 호출 후 로컬스토리지 저장
  useEffect(() => {
    const localKey = `hotelInfo_${hotelId}`;
    const storedInfo = localStorage.getItem(localKey);

    if (storedInfo) {
      setHotelInfo(JSON.parse(storedInfo));
    }

    // API를 항상 최신 정보를 가져오기 위해 호출
    const hotel_UserInfo = async () => {
      try {
        const userInfo = await fetchUserInfo(hotelId);
        const info = {
          hotelName: userInfo.hotelName || '호텔 이름 없음',
          address: userInfo.address || '주소 정보 없음',
          phoneNumber: userInfo.phoneNumber || '전화번호 정보 없음',
          email: userInfo.email || '이메일 정보 없음',
        };
        setHotelInfo(info);
        localStorage.setItem(localKey, JSON.stringify(info));
        console.log('API로 호텔 회원정보 갱신됨:', info);
      } catch (error) {
        console.error('호텔 정보 불러오기 실패:', error);
      }
    };

    hotel_UserInfo();
  }, [hotelId]);

  const handleDownload = async () => {
    const input = invoiceRef.current;
    const canvas = await html2canvas(input, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save(`Invoice_${editedReservation.customerName || 'Guest'}.pdf`);
    onRequestClose();
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank'); // 새 창 열기
    const printContents = `
      <html>
        <head>
          <title>Print Invoice</title>
          <style>
            @media print {
              @page {
                size: A4;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 0;
                width: 210mm;
                height: 297mm;
                font-family: Arial, sans-serif;
              }
              .invoice-template {
                width: 100%;
                height: 100%;
              }
              .invoice-header, .invoice-details, .invoice-nightly-rates, .invoice-single-rate, .invoice-footer {
                margin: 0;
                padding: 10px;
              }
              table {
                width: 100%;
                border-collapse: collapse;
              }
              th, td {
                border: 1px solid #000;
                padding: 8px;
                text-align: left;
              }
            }
            /* 기본 스타일 유지 */
            .invoice-content {
              width: 210mm;
              height: 297mm;
            }
          </style>
        </head>
        <body>${invoiceRef.current.innerHTML}</body>
      </html>
    `;
  
    printWindow.document.open();
    printWindow.document.write(printContents);
    printWindow.document.close();
  
    printWindow.print();
    printWindow.close(); // 인쇄 후 새 창 닫기
  
    onRequestClose(); // 모달 닫기
  };

  const toggleEditMode = () => setIsEditing(!isEditing);

  const handleSave = () => {
    setIsEditing(false);
    onRequestClose();
  };

  const handleChange = (field, value) => {
    setEditedReservation((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={() => {
        setIsEditing(false);
        onRequestClose();
      }}
      contentLabel={t('invoice.modalTitle')}
      className="invoice-modal-content"
      overlayClassName="invoice-modal-overlay"
    >
      <div className="modal-header">
        <h6>{t('hotel.invoice')}</h6>
        <LanguageSwitcher />
        <button onClick={onRequestClose} className="close-button">
          <FaTimes size={20} />
        </button>
      </div>

      <div className="modal-body">
        <div ref={invoiceRef} className="invoice-content">
          <InvoiceTemplate
            reservation={editedReservation}
            hotelSettings={hotelInfo}
            hotelAddress={hotelInfo.address}
            phoneNumber={hotelInfo.phoneNumber}
            email={hotelInfo.email}
            isEditing={isEditing}
            toggleEditMode={toggleEditMode}
            handleSave={handleSave}
            handleChange={handleChange}
          />
        </div>
      </div>

      <div className="modal-footer">
        {!isEditing ? (
          <button onClick={toggleEditMode} className="modal-button">
            <FaEdit /> {t('invoice.edit')}
          </button>
        ) : (
          <button onClick={handleSave} className="modal-button">
            <FaSave /> {t('invoice.save')}
          </button>
        )}
        <button onClick={handleDownload} className="modal-button">
          <FaDownload /> {t('invoice.download')}
        </button>
        <button onClick={handlePrint} className="modal-button">
          <FaPrint /> {t('invoice.print')}
        </button>
      </div>
    </Modal>
  );
};

InvoiceModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onRequestClose: PropTypes.func.isRequired,
  invoiceRef: PropTypes.object.isRequired,
  reservationNo: PropTypes.string.isRequired,
  reservation: PropTypes.object.isRequired,
  hotelId: PropTypes.string.isRequired,
};

export default InvoiceModal;
