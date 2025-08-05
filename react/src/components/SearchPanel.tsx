import React from 'react';
import type { SearchPanelProps } from '../types';
import ActionDropdown from './ActionDropdown';
import './SearchPanel.css';

const SearchPanel: React.FC<SearchPanelProps> = ({
    totalCount,
    selectedCount,
    displayedCount,
    onSelectAll,
    onToggleMobileFilter,
    onBulkAddToCart,
    onBulkShare,
    onBulkAddToCollection,
    onSortByTopResults,
    onSortByDateCreated,
    onSortByLastModified,
    onSortBySize,
    onSortDirectionAscending,
    onSortDirectionDescending,
    selectedSortType,
    selectedSortDirection,
    onSortTypeChange,
    onSortDirectionChange,
    showFullDetails = true,
    onShowFullDetailsChange
}) => {
    const handleToggleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onShowFullDetailsChange?.(e.target.checked);
    };

    return (
        <>
            {/* Search Primary Panel */}
            <div className="search-primary-panel">
                <div className="primary-panel-container">
                    {/* Left side */}
                    <div className="left-panel-group">
                        <ActionDropdown
                            className="SortCards"
                            items={['Top Results', 'Date Created', 'Last Modified', 'Size']}
                            handlers={[onSortByTopResults, onSortByDateCreated, onSortByLastModified, onSortBySize]}
                            show={true}
                            label={undefined}
                            selectedItem={selectedSortType}
                            onSelectedItemChange={onSortTypeChange}
                        />
                        <ActionDropdown
                            className="SortDirection"
                            items={['Ascending', 'Descending']}
                            handlers={[onSortDirectionAscending, onSortDirectionDescending]}
                            show={true}
                            label={undefined}
                            selectedItem={selectedSortDirection}
                            onSelectedItemChange={onSortDirectionChange}
                        />

                        {/* Show Full Details Toggle */}
                        <div className="cmp-title" id="showfulldetails">
                            <h1>Show full details<label className="switch"><input type="checkbox" checked={showFullDetails} onChange={handleToggleChange} /><span className="slider round"></span></label></h1>
                        </div>
                    </div>

                    {/* Right side: Filter button */}
                    <div className="right-panel-group">
                        <button
                            className="filter-button"
                            type="button"
                            onClick={onToggleMobileFilter}
                        >
                            <img
                                src="icons/Filter-search.svg"
                                alt="Filter"
                                className="filter-icon"
                            />
                            Filter
                        </button>
                    </div>
                </div>
            </div>

            {/* Search Secondary Panel */}
            <div className="search-secondary-panel">
                <div className="secondary-panel-container">
                    {/* Left side: Total, Select All, Actions */}
                    <div className="left-panel-group">
                        {/* Total Count */}
                        <div className="search-statistics">
                            <div className="total-statistic">
                                <span className="total-count">{totalCount}</span>
                                <span className="total-label">Total</span>
                            </div>
                        </div>

                        {/* Select All */}
                        <div className="dropdown-select-section">
                            <div className="dropdown-select-all">
                                <input
                                    type="checkbox"
                                    id="dropdown-select-all"
                                    checked={selectedCount > 0 && selectedCount === displayedCount}
                                    onChange={(e) => onSelectAll(e.target.checked)}
                                />
                                <label htmlFor="dropdown-select-all">
                                    Select All {selectedCount > 0 && <span className="dropdown-count">({selectedCount})</span>}
                                </label>
                            </div>
                        </div>

                        {/* Actions Button */}
                        <ActionDropdown
                            className="dropdown-actions-section"
                            items={['Add to cart', 'Share', 'Add to collection']}
                            handlers={[onBulkAddToCart, onBulkShare, onBulkAddToCollection]}
                            show={selectedCount > 0}
                            label="Actions"
                            selectedItem={undefined}
                        />
                    </div>

                    {/* Right side: (empty for now) */}
                    <div className="right-panel-group">
                        {/* Future content can go here */}
                    </div>
                </div>
            </div>
        </>
    );
};

export default SearchPanel; 