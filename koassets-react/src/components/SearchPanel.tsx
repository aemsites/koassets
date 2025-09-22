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
    isMobileFilterOpen,
    onBulkAddToCart,
    // onBulkDownload,
    // onBulkShare,
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
    showFullDetails,
    onShowFullDetailsChange,
    viewType,
    onViewTypeChange,
    selectAuthorized,
    onSelectAuthorized,
    isRightsSearch = false
}) => {
    const handleToggleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onShowFullDetailsChange?.(e.target.checked);
    };

    const handleGridViewClick = () => {
        onViewTypeChange?.('grid');
    };

    const handleListViewClick = () => {
        onViewTypeChange?.('list');
    };

    return (
        <>
            {/* Search Primary Panel */}
            <div className="search-primary-panel">
                <div className="primary-panel-container">
                    {/* Left side */}
                    <div className="left-panel-group">
                        <ActionDropdown
                            className="SortCards sort-dropdown-disabled"
                            items={['Top Results', 'Date Created', 'Last Modified', 'Size']}
                            handlers={[onSortByTopResults, onSortByDateCreated, onSortByLastModified, onSortBySize]}
                            show={true}
                            label={undefined}
                            selectedItem={selectedSortType}
                            onSelectedItemChange={onSortTypeChange}
                        />
                        <ActionDropdown
                            className="SortDirection sort-dropdown-disabled"
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
                        <div className="card-view-container">
                            <button
                                className={`grid-view-btn ${viewType === 'grid' ? 'active' : ''}`}
                                type="button"
                                title="Grid View"
                                onClick={handleGridViewClick}
                            >
                                <img src={`${import.meta.env.BASE_URL}icons/gridview.svg`} alt="Grid View" />
                            </button>
                            <button
                                className={`list-view-btn ${viewType === 'list' ? 'active' : ''}`}
                                type="button"
                                title="List View"
                                onClick={handleListViewClick}
                            >
                                <img src={`${import.meta.env.BASE_URL}icons/listview.svg`} alt="List View" />
                            </button>
                        </div>

                        <button
                            className="filter-button"
                            type="button"
                            onClick={onToggleMobileFilter}
                        >
                            <img
                                src={`${import.meta.env.BASE_URL}icons/Filter-search.svg`}
                                alt="Filter"
                                className="filter-icon"
                            />
                            {isMobileFilterOpen ? 'Hide Filter' : 'Show Filter'}
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
                        <div className="select-section">
                            {isRightsSearch && (
                                <div className="select-authorized">
                                    <input
                                        type="checkbox"
                                        id="select-authorized"
                                        checked={selectAuthorized || false}
                                        onChange={(e) => onSelectAuthorized?.(e.target.checked)}
                                    />
                                    <label htmlFor="select-authorized">
                                        Show only authorized assets
                                    </label>
                                </div>
                            )}
                            <div className="select-all">
                                <input
                                    type="checkbox"
                                    id="select-all"
                                    checked={selectedCount > 0 && selectedCount === displayedCount}
                                    onChange={(e) => onSelectAll(e.target.checked)}
                                />
                                <label htmlFor="select-all">
                                    Select All {selectedCount > 0 && <span className="dropdown-count">({selectedCount})</span>}
                                </label>
                            </div>
                        </div>

                        {/* Actions Button */}
                        <ActionDropdown
                            className="dropdown-actions-section"
                            items={['Add to cart', 'Add to Collection']} // , 'Download'
                            handlers={[onBulkAddToCart, onBulkAddToCollection]} // , onBulkDownload
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