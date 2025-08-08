import React, { useEffect, useMemo, useState } from 'react';
import type { ActionDropdownProps } from '../types';
import './ActionDropdown.css';

const ActionDropdown: React.FC<ActionDropdownProps> = ({
    className = '',
    items,
    handlers,
    show,
    label,
    selectedItem,
    onSelectedItemChange
}) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

    // Generate unique ID based on className or fallback to random ID
    const dropdownId = useMemo(() => {
        const baseId = className ? className.replace(/\s+/g, '-').toLowerCase() : 'dropdown';
        return `${baseId}-actions-${Math.random().toString(36).substr(2, 9)}`;
    }, [className]);

    // Handle clicking outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (isDropdownOpen) {
                const dropdown = document.getElementById(dropdownId);
                if (dropdown && !dropdown.contains(target)) {
                    // Update DOM styles to close dropdown
                    const menu = dropdown.querySelector('.menu') as HTMLElement;
                    if (menu) {
                        menu.style.display = 'none';
                        dropdown.classList.remove('open');
                    }
                    setIsDropdownOpen(false);
                }
            }
        };

        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isDropdownOpen, dropdownId]);

    const handleDropdownClick = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();

        const dropdown = e.currentTarget;
        const menu = dropdown.querySelector('.menu') as HTMLElement;

        if (menu) {
            if (isDropdownOpen) {
                menu.style.display = 'none';
                dropdown.classList.remove('open');
                setIsDropdownOpen(false);
            } else {
                menu.style.display = 'block';
                dropdown.classList.add('open');
                setIsDropdownOpen(true);
            }
        }
    };

    const handleDropdownItemClick = (e: React.MouseEvent<HTMLDivElement>, action: () => void, itemText: string) => {
        e.preventDefault();
        e.stopPropagation();

        // Update selected item
        onSelectedItemChange?.(itemText);

        // Call the action
        action();

        // Close the dropdown
        const dropdown = document.getElementById(dropdownId);
        const menu = dropdown?.querySelector('.menu') as HTMLElement;
        if (menu && dropdown) {
            menu.style.display = 'none';
            dropdown.classList.remove('open');
        }
        setIsDropdownOpen(false);
    };

    if (!show) {
        return null;
    }

    return (
        <div className={`dropdown-actions-section ${className}`}>
            <div
                className="ui simple dropdown item"
                id={dropdownId}
                onClick={handleDropdownClick}
            >
                <span className="dropdown-label">{selectedItem || label}</span>
                <i className="dropdown icon"></i>
                <div className="menu">
                    {items.map((item, index) => (
                        <div
                            key={index}
                            className={`item ${selectedItem === item ? 'selected' : ''}`}
                            onClick={(e) => handleDropdownItemClick(e, handlers[index], item)}
                        >
                            {item}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ActionDropdown; 