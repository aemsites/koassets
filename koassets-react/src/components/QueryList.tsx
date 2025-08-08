import React, { useEffect, useRef } from 'react';
import type { QueryListProps } from '../types';
import Query from './Query';

const QueryList: React.FC<QueryListProps> = ({ querys, loading }) => {
    const querysEndRef = useRef<HTMLDivElement>(null);
    const querysContainerRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        // Using both methods for better compatibility across browsers
        if (querysEndRef.current) {
            querysEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }

        if (querysContainerRef.current) {
            querysContainerRef.current.scrollTop = querysContainerRef.current.scrollHeight;
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [querys]);

    return (
        <div className="querys" ref={querysContainerRef}>
            {querys.map((msg, index) => (
                <Query key={index} query={msg} />
            ))}
            {loading.chat && (
                <div className="animation-3dots">
                    <div className="dot"></div>
                    <div className="dot"></div>
                    <div className="dot"></div>
                </div>
            )}
            <div ref={querysEndRef} />
        </div>
    );
};

export default QueryList; 