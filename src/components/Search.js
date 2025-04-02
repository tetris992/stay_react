import React from 'react';
import './Search.css';

const Search = ({ searchCriteria, setSearchCriteria, handleSearchSubmit }) => {
  return (
    <form className="search-form" onSubmit={handleSearchSubmit}>
      <input
        type="text"
        placeholder="검색 (이름, 예약번호, 메모)"
        value={searchCriteria.name}
        onChange={(e) =>
          setSearchCriteria({ ...searchCriteria, name: e.target.value })
        }
        aria-label="예약 검색 입력"
        className="search-input"
      />
    </form>
  );
};

export default Search;
