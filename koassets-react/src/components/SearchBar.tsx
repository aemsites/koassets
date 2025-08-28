import React from 'react';
import type { SearchBarProps } from '../types';
import { QUERY_TYPES } from '../types';
import './SearchBar.css';

const SearchBar: React.FC<SearchBarProps> = ({
    query,
    setQuery,
    sendQuery,
    selectedQueryType,
    setSelectedQueryType,
    inputRef
}) => {
    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedQueryType(e.target.value);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            sendQuery(query);
        }
    };

    const handleSearchClick = () => {
        sendQuery(query);
    };

    return (
        <div className="query-input-container">
            <div className="query-input-bar">
                <div className="query-dropdown">
                    <select value={selectedQueryType} onChange={handleSelectChange}>
                        <option value={QUERY_TYPES.ASSETS}>{QUERY_TYPES.ASSETS}</option>
                    </select>
                </div>
                <div className="query-input-wrapper">
                    <span className="query-search-icon">
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                    </span>
                    <input
                        type="text"
                        className="query-input"
                        value={query}
                        onChange={handleInputChange}
                        onKeyPress={handleKeyPress}
                        placeholder="What are you looking for?"
                        autoFocus
                        ref={inputRef}
                    />
                </div>
                <button className="query-search-btn" onClick={handleSearchClick} aria-label="Search">
                    Search
                </button>
            </div>
        </div>
    );
};

export default SearchBar; 