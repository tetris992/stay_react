// src/components/Search.js

import React from 'react';
import './Search.css';
// import { FaSearch } from 'react-icons/fa';

const Search = ({
  searchCriteria,
  setSearchCriteria,
  handleSearchSubmit,
}) => {

  return (
<form className="search-form" onSubmit={handleSearchSubmit}>
  {/* <FaSearch className="search-icon" aria-hidden="true" /> */} 
  <input
    type="text"
    placeholder="검색 (이름, 예약번호)"
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
