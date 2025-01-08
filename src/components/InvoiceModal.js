// src/components/InvoiceModal.js

import React, { useState } from 'react';
import Modal from 'react-modal';
import PropTypes from 'prop-types';
import { FaDownload, FaPrint, FaTimes, FaEdit, FaSave } from 'react-icons/fa';
import './InvoiceModal.css';
import InvoiceTemplate from './InvoiceTemplate';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';


const InvoiceModal = ({
  isOpen,
  onRequestClose,
  invoiceRef,
  reservationNo,
  reservation,
  hotelAddress,
  phoneNumber,
  email,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editedReservation, setEditedReservation] = useState({
    ...reservation,
  });

  // 인보이스 다운로드 핸들러
  const handleDownload = async () => {
    try {
      const input = invoiceRef.current;
      const canvas = await html2canvas(input);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF();

      const imgWidth = 210; 
      const pageHeight = 295; 
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // 예약자 이름 가져오기
      const customerName = editedReservation.customerName || 'Invoice';
      const sanitizedCustomerName = customerName
        .replace(/[^a-z0-9가-힣]+/gi, '_')
        .toLowerCase();

      // 파일명 설정
      const fileName = `Invoice_${sanitizedCustomerName}.pdf`;

      pdf.save(fileName);
      onRequestClose();
    } catch (error) {
      console.error('인보이스 다운로드 실패:', error);
      alert(t('invoice.downloadFailed')); 
    }
  };

  // 인보이스 프린트 핸들러
  const handlePrint = () => {
    const input = invoiceRef.current;
    const printContents = input.innerHTML;
    const originalContents = document.body.innerHTML;

    document.body.innerHTML = printContents;
    window.print();
    document.body.innerHTML = originalContents;
    window.location.reload(); 
  };

  // 수정 모드 토글 핸들러
  const toggleEditMode = () => {
    setIsEditing((prev) => !prev);
  };

  // 수정 완료 후 저장 핸들러
  const handleSave = () => {
    // 실제 저장 로직을 추가해야 합니다. (예: API 호출)
    // 예시:
    // updateReservation(reservation._id, editedReservation, hotelId)
    //   .then(() => {
    //     alert(t('invoice.saveSuccess'));
    //     onRequestClose();
    //   })
    //   .catch((error) => {
    //     console.error('수정 실패:', error);
    //     alert(t('invoice.saveFailed'));
    //   });

    // 여기서는 단순히 모드 토글만 수행
    setIsEditing(false);
    onRequestClose();
  };

  // 핸들링 함수: InvoiceTemplate에서 변경된 내용을 받아 상태 업데이트
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
        <h2>{t('')}</h2>
        <div className="modal-language-switcher">
          {' '}
          {/* 추가된 라인 */}
          <LanguageSwitcher /> {/* 기존 LanguageSwitcher 재사용 */}
        </div>
        <button
          onClick={() => {
            setIsEditing(false); 
            onRequestClose();
          }}
          className="close-button"
          aria-label={t('invoice.close')}
        >
          <FaTimes size={20} />
        </button>
      </div>
      <div className="modal-body">
        <div ref={invoiceRef} className="invoice-content">
          <InvoiceTemplate
            reservation={editedReservation}
            hotelAddress={hotelAddress || t('invoice.infoUnavailable')} 
            phoneNumber={phoneNumber || t('invoice.infoUnavailable')} 
            email={email || t('invoice.infoUnavailable')} 
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
        <button
          onClick={handleDownload}
          className="modal-button"
          aria-label={t('invoice.download')}
        >
          <FaDownload /> {t('invoice.download')}
        </button>
        <button
          onClick={handlePrint}
          className="modal-button"
          aria-label={t('invoice.print')}
        >
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
  hotelAddress: PropTypes.string.isRequired, 
  phoneNumber: PropTypes.string.isRequired, 
  email: PropTypes.string.isRequired, 
};

export default InvoiceModal;
